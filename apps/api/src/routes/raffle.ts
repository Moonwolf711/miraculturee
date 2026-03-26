import type { FastifyInstance } from 'fastify';
import { RaffleEntrySchema, EventIdParamSchema, PoolIdParamSchema } from '@miraculturee/shared';
import { RaffleService } from '../services/raffle.service.js';

export async function raffleRoutes(app: FastifyInstance) {
  const raffleService = new RaffleService(app.prisma, app.pos, app.io);

  // Public: get raffle pools for event (includes unique entrant count)
  app.get('/:eventId/pools', async (req, reply) => {
    const { eventId } = EventIdParamSchema.parse(req.params);
    const pools = await raffleService.getPoolsByEvent(eventId);
    return pools.map((p) => ({
      id: p.id,
      tierCents: p.tierCents,
      status: p.status,
      totalEntries: p.entries.length,
      uniqueEntrants: p.uniqueEntrants,
      drawTime: p.scheduledDrawTime?.toISOString() ?? null,
    }));
  });

  // Authenticated: check if free first entry is available
  app.get('/free-entry', { preHandler: [app.authenticate] }, async (req) => {
    const available = await raffleService.isFreeEntryAvailable(req.user.id);
    return { freeEntryAvailable: available };
  });

  // Authenticated: enter raffle (paid or free first entry)
  app.post('/enter', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = RaffleEntrySchema.parse(req.body);
    const { poolId, lat, lng, captchaToken } = body;
    const useFreeEntry = (req.body as any).useFreeEntry === true;
    const ip = req.ip;

    // 0. Validate event timing — raffle runs independently from campaign donations
    const pool = await app.prisma.rafflePool.findUnique({
      where: { id: poolId },
      include: { event: true },
    });
    if (!pool) {
      throw Object.assign(new Error('Raffle pool not found.'), { statusCode: 404 });
    }
    // Entries accepted daily until the day of the show (midnight cutoff)
    const showDate = new Date(pool.event.date);
    showDate.setHours(0, 0, 0, 0);
    if (Date.now() >= showDate.getTime()) {
      throw Object.assign(
        new Error('Raffle entries are closed — it\'s the day of the show. Drawing will happen soon!'),
        { statusCode: 403 },
      );
    }

    // 1. Verify CAPTCHA (skip for free entries — less friction for new users)
    if (!useFreeEntry) {
      const captchaValid = await app.captcha.verify(captchaToken, ip);
      if (!captchaValid) {
        throw Object.assign(
          new Error('CAPTCHA verification failed. Please try again.'),
          { statusCode: 400 },
        );
      }
    }

    // 2. Check for VPN/Proxy
    const vpnCheck = await app.vpnDetection.checkIP(ip);
    if (vpnCheck.isVPN || vpnCheck.isProxy || vpnCheck.isTor) {
      await app.prisma.suspiciousActivity.create({
        data: {
          userId: req.user.id,
          type: vpnCheck.isTor ? 'TOR_DETECTED' : vpnCheck.isVPN ? 'VPN_DETECTED' : 'PROXY_DETECTED',
          ip,
          riskScore: vpnCheck.riskScore,
          metadata: vpnCheck as any,
        },
      });

      throw Object.assign(
        new Error('VPN, proxy, or Tor connections are not allowed for raffle entries.'),
        { statusCode: 403 },
      );
    }

    // 3. Verify location (server-side geo-check)
    const geoCheck = await app.geoVerification.verifyLocation(lat, lng, ip);
    if (!geoCheck.verified) {
      await app.prisma.suspiciousActivity.create({
        data: {
          userId: req.user.id,
          type: 'GEO_MISMATCH',
          ip,
          riskScore: Math.min(Math.floor(geoCheck.discrepancyKm), 100),
          metadata: geoCheck as any,
        },
      });

      throw Object.assign(
        new Error(
          `Location verification failed. Your IP location is ${geoCheck.discrepancyKm.toFixed(0)}km from your reported location.`,
        ),
        { statusCode: 403 },
      );
    }

    // Use SERVER location for raffle validation (not client)
    const result = await raffleService.enter(
      req.user.id,
      poolId,
      geoCheck.serverLocation.lat,
      geoCheck.serverLocation.lng,
      useFreeEntry,
    );

    return reply.code(201).send(result);
  });

  // Authenticated: check if the current user has entered a specific pool
  app.get('/:poolId/my-entry', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { poolId } = PoolIdParamSchema.parse(req.params);
    const entry = await app.prisma.raffleEntry.findFirst({
      where: { poolId, userId: req.user.id },
    });
    return reply.send({ hasEntry: !!entry, entryId: entry?.id ?? null });
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
    // Only ADMIN users can close raffle pools
    if (req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only administrators can close raffle pools' });
    }

    const { poolId } = PoolIdParamSchema.parse(req.params);
    await raffleService.closePool(poolId);
    return reply.code(200).send({ message: 'Pool closed and seed hash published' });
  });
}
