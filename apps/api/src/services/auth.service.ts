import { hash, compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { TokenPair, UserPayload } from '@miraculturee/shared';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://miracultureeweb-production.up.railway.app';

const SALT_ROUNDS = 10;

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
    this.sendVerificationEmail(user.id);

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken },
    });
    if (!user) {
      throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
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
    this.app.emailService?.sendPasswordReset(email, { userName: user.name, resetLink });
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
    this.app.emailService?.sendEmailVerification(user.email, { userName: user.name, verifyLink });
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  }
}
