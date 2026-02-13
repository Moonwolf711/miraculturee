import type { FastifyInstance } from 'fastify';
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  UpgradeToArtistSchema,
} from '@miraculturee/shared';
import { AuthService } from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.prisma, app);

  // Stricter rate limits for auth endpoints (brute force protection)
  const authRateLimit = { max: 10, timeWindow: '1 minute' };
  const resetRateLimit = { max: 5, timeWindow: '1 minute' };

  app.post('/register', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const body = RegisterSchema.parse(req.body);
    const tokens = await authService.register(body.email, body.password, body.name, body.role);
    return reply.code(201).send(tokens);
  });

  app.post('/login', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const tokens = await authService.login(body.email, body.password);
    return reply.send(tokens);
  });

  app.post('/refresh', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const body = RefreshSchema.parse(req.body);
    const tokens = await authService.refresh(body.refreshToken);
    return reply.send(tokens);
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, city: true, emailVerified: true, createdAt: true },
    });
    return user;
  });

  // --- Upgrade to Artist ---

  app.post('/upgrade-to-artist', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = UpgradeToArtistSchema.parse(req.body);
    const user = await app.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role === 'ARTIST') return reply.code(400).send({ error: 'Already an artist' });

    // Upgrade role and create artist profile in a transaction
    const [updated] = await app.prisma.$transaction([
      app.prisma.user.update({ where: { id: user.id }, data: { role: 'ARTIST' } }),
      app.prisma.artist.create({
        data: {
          userId: user.id,
          stageName: body.stageName,
          genre: body.genre ?? null,
          bio: body.bio ?? null,
        },
      }),
    ]);

    // Re-issue tokens with the new ARTIST role
    const payload = { id: updated.id, email: updated.email, role: updated.role };
    const accessToken = app.jwt.sign(payload);
    const refreshToken = app.jwt.sign(payload, { expiresIn: '7d' });
    await app.prisma.user.update({ where: { id: updated.id }, data: { refreshToken } });

    return reply.send({ accessToken, refreshToken });
  });

  // --- Password Reset ---

  app.post('/forgot-password', { config: { rateLimit: resetRateLimit } }, async (req, reply) => {
    const { email } = ForgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email);
    // Always return 200 to prevent email enumeration
    return reply.send({ message: 'If that email exists, we sent a reset link.' });
  });

  app.post('/reset-password', { config: { rateLimit: resetRateLimit } }, async (req, reply) => {
    const { token, password } = ResetPasswordSchema.parse(req.body);
    const tokens = await authService.resetPassword(token, password);
    return reply.send(tokens);
  });

  // --- Email Verification ---

  app.post('/verify-email', async (req, reply) => {
    const { token } = VerifyEmailSchema.parse(req.body);
    await authService.verifyEmail(token);
    return reply.send({ message: 'Email verified successfully.' });
  });

  app.post('/resend-verification', { preHandler: [app.authenticate] }, async (req, reply) => {
    await authService.sendVerificationEmail(req.user.id);
    return reply.send({ message: 'Verification email sent.' });
  });
}
