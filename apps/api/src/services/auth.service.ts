import { hash, compare } from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { TokenPair, UserPayload } from '@miraculturee/shared';

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
