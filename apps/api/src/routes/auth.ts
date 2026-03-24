import type { FastifyInstance } from 'fastify';
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
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
      select: {
        id: true, email: true, name: true, role: true, city: true,
        emailVerified: true, createdAt: true, totpEnabled: true,
        _count: { select: { passkeys: true, socialLogins: true } },
      },
    });
    if (!user) return null;
    const { _count, ...rest } = user;
    return { ...rest, passkeyCount: _count.passkeys, socialLoginCount: _count.socialLogins };
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

  // --- Admin Password Reset (temporary, secured by ADMIN_SEED_KEY) ---

  app.post('/admin-reset-password', async (req, reply) => {
    const { email, password, seedKey } = req.body as { email: string; password: string; seedKey: string };
    const expectedKey = process.env.ADMIN_SEED_KEY || process.env.JWT_SECRET;
    if (!seedKey || seedKey !== expectedKey) return reply.code(403).send({ error: 'Unauthorized' });

    const { hash } = await import('bcrypt');
    const passwordHash = await hash(password, 10);
    const user = await app.prisma.user.update({
      where: { email },
      data: { passwordHash },
      select: { id: true, email: true, role: true },
    });
    return { success: true, user };
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

  // --- Logout (server-side refresh token invalidation) ---

  app.post('/logout', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      await app.prisma.user.updateMany({
        where: { refreshToken },
        data: { refreshToken: null },
      });
    }
    return reply.send({ message: 'Logged out' });
  });

  // Public endpoint: which social login providers are configured
  app.get('/providers', async () => ({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    facebook: !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
    apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID),
    tidal: !!(process.env.TIDAL_CLIENT_ID && process.env.TIDAL_CLIENT_SECRET),
  }));

}
