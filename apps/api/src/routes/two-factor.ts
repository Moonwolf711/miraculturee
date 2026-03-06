import type { FastifyInstance } from 'fastify';
import {
  TotpVerifySchema,
  TwoFactorLoginSchema,
  PasskeyRegisterSchema,
  PasskeyDeleteSchema,
} from '@miraculturee/shared';
import { AuthService } from '../services/auth.service.js';
import { WebAuthnService } from '../services/webauthn.service.js';

export async function twoFactorRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.prisma, app);
  const webauthnService = new WebAuthnService(app.prisma, app);

  const authRateLimit = { max: 10, timeWindow: '1 minute' };

  // --- TOTP 2FA Login Step (unauthenticated) ---

  app.post('/2fa/verify', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const { tempToken, code } = TwoFactorLoginSchema.parse(req.body);
    const tokens = await authService.verifyTwoFactor(tempToken, code);
    return reply.send(tokens);
  });

  // --- TOTP Setup (authenticated) ---

  app.post('/2fa/setup', { preHandler: [app.authenticate] }, async (req, reply) => {
    const result = await authService.setupTotp(req.user.id);
    return reply.send(result);
  });

  app.post('/2fa/enable', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { code } = TotpVerifySchema.parse(req.body);
    await authService.enableTotp(req.user.id, code);
    return reply.send({ success: true });
  });

  app.post('/2fa/disable', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { code } = TotpVerifySchema.parse(req.body);
    await authService.disableTotp(req.user.id, code);
    return reply.send({ success: true });
  });

  app.get('/2fa/status', { preHandler: [app.authenticate] }, async (req) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { totpEnabled: true },
    });
    return { totpEnabled: user?.totpEnabled ?? false };
  });

  // --- WebAuthn Passkey Registration (authenticated) ---

  app.post('/passkeys/register/options', { preHandler: [app.authenticate] }, async (req, reply) => {
    const options = await webauthnService.generateRegOptions(req.user.id);
    return reply.send(options);
  });

  app.post('/passkeys/register/verify', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = req.body as Record<string, any>;
    const { friendlyName } = PasskeyRegisterSchema.parse({ friendlyName: body.friendlyName });
    const { friendlyName: _, ...webauthnBody } = body;
    const result = await webauthnService.verifyRegResponse(req.user.id, friendlyName, webauthnBody);
    return reply.send(result);
  });

  app.get('/passkeys', { preHandler: [app.authenticate] }, async (req) => {
    return webauthnService.listPasskeys(req.user.id);
  });

  app.delete('/passkeys/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { passkeyId } = PasskeyDeleteSchema.parse({ passkeyId: (req.params as any).id });
    await webauthnService.deletePasskey(req.user.id, passkeyId);
    return reply.send({ success: true });
  });

  // --- WebAuthn Passkey Authentication (unauthenticated) ---

  app.post('/passkeys/auth/options', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const email = (req.body as any)?.email;
    const options = await webauthnService.generateAuthOptions(email);
    return reply.send(options);
  });

  app.post('/passkeys/auth/verify', { config: { rateLimit: authRateLimit } }, async (req, reply) => {
    const tokens = await webauthnService.verifyAuthResponse(req.body);
    return reply.send(tokens);
  });
}
