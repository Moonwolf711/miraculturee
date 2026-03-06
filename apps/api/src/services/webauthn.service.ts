import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { TokenPair, UserPayload, PasskeySummary } from '@miraculturee/shared';

const RP_NAME = 'MiraCulture';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'mira-culture.com';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'https://mira-culture.com';

/** TTL for pending challenges: 5 minutes. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface PendingChallenge {
  userId: string;
  expires: number;
}

export class WebAuthnService {
  private challenges = new Map<string, PendingChallenge>();

  constructor(
    private prisma: PrismaClient,
    private app: FastifyInstance,
  ) {}

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  async generateRegOptions(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const existingPasskeys = await this.prisma.passkey.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports
        ? (JSON.parse(pk.transports) as AuthenticatorTransportFuture[])
        : undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    this.storeChallenge(options.challenge, userId);

    return options;
  }

  async verifyRegResponse(
    userId: string,
    friendlyName: string,
    body: RegistrationResponseJSON,
  ): Promise<{ verified: true }> {
    const pending = this.consumeChallenge(userId);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: pending,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw Object.assign(new Error('Registration verification failed'), { statusCode: 400 });
    }

    const { credential } = verification.registrationInfo;

    await this.prisma.passkey.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        friendlyName: friendlyName || 'My Passkey',
        transports: body.response?.transports
          ? JSON.stringify(body.response.transports)
          : null,
      },
    });

    return { verified: true };
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  async generateAuthOptions(email?: string) {
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;
    let userId = '';

    if (email) {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (user) {
        userId = user.id;
        const passkeys = await this.prisma.passkey.findMany({
          where: { userId: user.id },
          select: { credentialId: true, transports: true },
        });

        allowCredentials = passkeys.map((pk) => ({
          id: pk.credentialId,
          transports: pk.transports
            ? (JSON.parse(pk.transports) as AuthenticatorTransportFuture[])
            : undefined,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // For discoverable credentials (no email), userId is empty string.
    this.storeChallenge(options.challenge, userId);

    return options;
  }

  async verifyAuthResponse(body: AuthenticationResponseJSON): Promise<TokenPair> {
    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId: body.id },
      include: { user: true },
    });

    if (!passkey) {
      throw Object.assign(new Error('Passkey not found'), { statusCode: 401 });
    }

    if (passkey.user.isBanned) {
      throw Object.assign(new Error('Account suspended. Contact support.'), { statusCode: 403 });
    }

    // Find a valid challenge: either one stored for this user or a discoverable one (empty userId).
    const challenge = this.consumeChallengeForAuth(passkey.userId);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
      },
    });

    if (!verification.verified) {
      throw Object.assign(new Error('Authentication verification failed'), { statusCode: 401 });
    }

    // Update counter to prevent replay attacks.
    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    return this.generateTokens(passkey.user);
  }

  // ---------------------------------------------------------------------------
  // Passkey management
  // ---------------------------------------------------------------------------

  async listPasskeys(userId: string): Promise<PasskeySummary[]> {
    const passkeys = await this.prisma.passkey.findMany({
      where: { userId },
      select: { id: true, friendlyName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return passkeys.map((pk) => ({
      id: pk.id,
      friendlyName: pk.friendlyName,
      createdAt: pk.createdAt.toISOString(),
    }));
  }

  async deletePasskey(userId: string, passkeyId: string): Promise<void> {
    const passkey = await this.prisma.passkey.findUnique({
      where: { id: passkeyId },
      select: { userId: true },
    });

    if (!passkey) {
      throw Object.assign(new Error('Passkey not found'), { statusCode: 404 });
    }

    if (passkey.userId !== userId) {
      throw Object.assign(new Error('Not authorized to delete this passkey'), { statusCode: 403 });
    }

    await this.prisma.passkey.delete({ where: { id: passkeyId } });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private storeChallenge(challenge: string, userId: string): void {
    this.pruneExpiredChallenges();
    this.challenges.set(challenge, {
      userId,
      expires: Date.now() + CHALLENGE_TTL_MS,
    });
  }

  /**
   * Consume a challenge for registration: finds and removes a challenge that
   * matches the given userId exactly.
   */
  private consumeChallenge(userId: string): string {
    for (const [challenge, pending] of this.challenges) {
      if (pending.userId === userId && pending.expires > Date.now()) {
        this.challenges.delete(challenge);
        return challenge;
      }
    }
    throw Object.assign(new Error('Challenge expired or not found'), { statusCode: 400 });
  }

  /**
   * Consume a challenge for authentication: matches either the user's ID or an
   * empty userId (discoverable credential flow).
   */
  private consumeChallengeForAuth(userId: string): string {
    for (const [challenge, pending] of this.challenges) {
      if (pending.expires <= Date.now()) continue;
      if (pending.userId === userId || pending.userId === '') {
        this.challenges.delete(challenge);
        return challenge;
      }
    }
    throw Object.assign(new Error('Challenge expired or not found'), { statusCode: 400 });
  }

  private pruneExpiredChallenges(): void {
    const now = Date.now();
    for (const [challenge, pending] of this.challenges) {
      if (pending.expires <= now) {
        this.challenges.delete(challenge);
      }
    }
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
