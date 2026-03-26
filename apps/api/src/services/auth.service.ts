import { hash, compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { TokenPair, TwoFactorRequired, TotpSetupResponse, UserPayload } from '@miraculturee/shared';
import { encrypt, decrypt } from '../lib/crypto.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';

const SALT_ROUNDS = 10;
const BACKUP_CODE_COUNT = 8;

export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private app: FastifyInstance,
  ) {}

  async register(email: string, password: string, name: string, role: string): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
    }

    const passwordHash = await hash(password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name, role: role as any },
    });

    // If artist, create artist profile
    if (role === 'ARTIST') {
      await this.prisma.artist.create({
        data: { userId: user.id, stageName: name },
      });
    }

    // Send verification email (fire and forget)
    void this.sendVerificationEmail(user.id);

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<TokenPair | TwoFactorRequired> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    if (user.isBanned) {
      throw Object.assign(new Error('Account suspended. Contact support.'), { statusCode: 403 });
    }

    if (user.totpEnabled) {
      const tempToken = this.app.jwt.sign(
        { id: user.id, purpose: '2fa' } as any,
        { expiresIn: '5m' },
      );
      return { requiresTwoFactor: true, tempToken };
    }

    return this.generateTokens(user);
  }

  async setupTotp(userId: string): Promise<TotpSetupResponse> {
    const { authenticator } = await import('otplib');
    const QRCode = await import('qrcode');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    if (user.totpEnabled) {
      throw Object.assign(new Error('TOTP is already enabled'), { statusCode: 400 });
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'MiraCulture', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Generate backup codes
    const backupCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      backupCodes.push(randomBytes(4).toString('hex'));
    }

    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => hash(code, SALT_ROUNDS)),
    );

    // Store encrypted secret and hashed backup codes (totpEnabled stays false until verified)
    const encryptedSecret = encrypt(secret);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptedSecret,
        totpBackupCodes: JSON.stringify(hashedBackupCodes),
      },
    });

    return { secret, qrCodeDataUrl: qrCodeUrl, backupCodes } as TotpSetupResponse & { secret: string };
  }

  async enableTotp(userId: string, code: string): Promise<void> {
    const { authenticator } = await import('otplib');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw Object.assign(new Error('TOTP setup not initiated'), { statusCode: 400 });
    }

    if (user.totpEnabled) {
      throw Object.assign(new Error('TOTP is already enabled'), { statusCode: 400 });
    }

    const secret = decrypt(user.totpSecret);
    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 401 });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
  }

  async disableTotp(userId: string, code: string): Promise<void> {
    const { authenticator } = await import('otplib');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw Object.assign(new Error('TOTP is not enabled'), { statusCode: 400 });
    }

    const secret = decrypt(user.totpSecret);
    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 401 });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: null,
      },
    });
  }

  async verifyTwoFactor(tempToken: string, code: string): Promise<TokenPair> {
    let decoded: { id: string; purpose: string };
    try {
      decoded = this.app.jwt.verify(tempToken) as { id: string; purpose: string };
    } catch {
      throw Object.assign(new Error('Invalid or expired 2FA token'), { statusCode: 401 });
    }

    if (decoded.purpose !== '2fa') {
      throw Object.assign(new Error('Invalid token purpose'), { statusCode: 401 });
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw Object.assign(new Error('User not found or TOTP not enabled'), { statusCode: 401 });
    }

    // Try TOTP code first (6-digit numeric)
    if (/^\d{6}$/.test(code)) {
      const { authenticator } = await import('otplib');
      const secret = decrypt(user.totpSecret);
      const isValid = authenticator.check(code, secret);
      if (isValid) {
        return this.generateTokens(user);
      }
    }

    // Try backup codes
    const backupCodes: string[] = user.totpBackupCodes ? JSON.parse(user.totpBackupCodes) : [];
    for (let i = 0; i < backupCodes.length; i++) {
      const isMatch = await compare(code, backupCodes[i]);
      if (isMatch) {
        // Remove the used backup code
        const updatedCodes = [...backupCodes];
        updatedCodes.splice(i, 1);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { totpBackupCodes: JSON.stringify(updatedCodes) },
        });
        return this.generateTokens(user);
      }
    }

    throw Object.assign(new Error('Invalid 2FA code'), { statusCode: 401 });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    // Decode the refresh token to get the user ID, then verify the hash
    let decoded: { id: string };
    try {
      decoded = this.app.jwt.verify(refreshToken) as { id: string };
    } catch {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.refreshToken) {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    // Compare the provided token against the stored hash
    const valid = await compare(refreshToken, user.refreshToken);
    if (!valid) {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
    }

    if (user.isBanned) {
      throw Object.assign(new Error('Account suspended. Contact support.'), { statusCode: 403 });
    }

    return this.generateTokens(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // Silent — prevent email enumeration

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
    void this.app.emailService?.sendPasswordReset(email, { userName: user.name, resetLink });
  }

  async resetPassword(token: string, newPassword: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { passwordResetToken: token } });
    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw Object.assign(new Error('Invalid or expired reset link'), { statusCode: 400 });
    }

    const passwordHash = await hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
    });

    return this.generateTokens(user);
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerified) return;

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: token, emailVerifyExpiry: expiry },
    });

    const verifyLink = `${FRONTEND_URL}/verify-email?token=${token}`;
    void this.app.emailService?.sendEmailVerification(user.email, { userName: user.name, verifyLink });
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { emailVerifyToken: token } });
    if (!user || !user.emailVerifyExpiry || user.emailVerifyExpiry < new Date()) {
      throw Object.assign(new Error('Invalid or expired verification link'), { statusCode: 400 });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null },
    });
  }

  private async generateTokens(user: { id: string; email: string; role: string }): Promise<TokenPair> {
    const payload: UserPayload = { id: user.id, email: user.email, role: user.role as any };

    const accessToken = this.app.jwt.sign(payload);
    const refreshToken = this.app.jwt.sign(payload, { expiresIn: '7d' });

    // Store a bcrypt hash of the refresh token — never store raw tokens
    const refreshTokenHash = await hash(refreshToken, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash },
    });

    return { accessToken, refreshToken };
  }
}
