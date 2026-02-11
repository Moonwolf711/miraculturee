import type { FastifyInstance } from 'fastify';
import { RaffleEntrySchema, EventIdParamSchema, PoolIdParamSchema } from '@miraculturee/shared';
import { RaffleService } from '../services/raffle.service.js';

export async function raffleRoutes(app: FastifyInstance) {
  const raffleService = new RaffleService(app.prisma, app.pos, app.io);

  // Public: get raffle pools for event
  app.get('/:eventId/pools', async (req, reply) => {
    const { eventId } = EventIdParamSchema.parse(req.params);
    const pools = await raffleService.getPoolsByEvent(eventId);
    return pools.map((p) => ({
      id: p.id,
      tierCents: p.tierCents,
      status: p.status,
      totalEntries: p.entries.length,
      drawTime: p.scheduledDrawTime?.toISOString() ?? null,
    }));
  });

  // Authenticated: enter raffle
  app.post('/enter', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = RaffleEntrySchema.parse(req.body);
    const { poolId, lat, lng, captchaToken } = body;
    const ip = req.ip;

    // 1. Verify CAPTCHA
    const captchaValid = await app.captcha.verify(captchaToken, ip);
    if (!captchaValid) {
      throw Object.assign(
        new Error('CAPTCHA verification failed. Please try again.'),
        { statusCode: 400 }
      );
    }

    // 2. Check for VPN/Proxy
    const vpnCheck = await app.vpnDetection.checkIP(ip);
    if (vpnCheck.isVPN || vpnCheck.isProxy || vpnCheck.isTor) {
      // Log suspicious activity
      await app.prisma.suspiciousActivity.create({
        data: {
          userId: req.user.id,
          type: vpnCheck.isTor ? 'TOR_DETECTED' : vpnCheck.isVPN ? 'VPN_DETECTED' : 'PROXY_DETECTED',
          ip,
          riskScore: vpnCheck.riskScore,
          metadata: vpnCheck,
        },
      });

      throw Object.assign(
        new Error('VPN, proxy, or Tor connections are not allowed for raffle entries.'),
        { statusCode: 403 }
      );
    }

    // 3. Verify location (server-side geo-check)
    const geoCheck = await app.geoVerification.verifyLocation(lat, lng, ip);
    if (!geoCheck.verified) {
      // Log suspicious activity
      await app.prisma.suspiciousActivity.create({
        data: {
          userId: req.user.id,
          type: 'GEO_MISMATCH',
          ip,
          riskScore: Math.min(Math.floor(geoCheck.discrepancyKm), 100),
          metadata: geoCheck,
        },
      });

      throw Object.assign(
        new Error(
          `Location verification failed. Your IP location is ${geoCheck.discrepancyKm.toFixed(0)}km from your reported location.`
        ),
        { statusCode: 403 }
      );
    }

    // Use SERVER location for raffle validation (not client)
    const result = await raffleService.enter(
      req.user.id,
      poolId,
      geoCheck.serverLocation.lat,
      geoCheck.serverLocation.lng
    );

    return reply.code(201).send(result);
  });

  // Public: get draw results
  app.get('/:poolId/results', async (req) => {
    const { poolId } = PoolIdParamSchema.parse(req.params);
    return raffleService.getResults(poolId);
  });

  // Public: verify draw fairness
  app.get('/:poolId/verify', async (req) => {
    const { poolId } = PoolIdParamSchema.parse(req.params);
    return raffleService.verifyDraw(poolId);
  });

  // Admin: close pool and publish seed hash (before draw)
  app.post('/:poolId/close', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { poolId } = PoolIdParamSchema.parse(req.params);
    // TODO: Add admin role check
    await raffleService.closePool(poolId);
    return reply.code(200).send({ message: 'Pool closed and seed hash published' });
  });
}
