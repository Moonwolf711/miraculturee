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
    const result = await raffleService.enter(req.user.id, body.poolId, body.lat, body.lng);
    return reply.code(201).send(result);
  });

  // Public: get draw results
  app.get('/:poolId/results', async (req) => {
    const { poolId } = PoolIdParamSchema.parse(req.params);
    return raffleService.getResults(poolId);
  });
}
