import type { FastifyInstance } from 'fastify';
import { SupportPurchaseSchema } from '@miraculturee/shared';
import { SupportService } from '../services/support.service.js';

export async function supportRoutes(app: FastifyInstance) {
  const supportService = new SupportService(app.prisma, app.pos);

  // Authenticated: purchase support tickets
  // Returns a clientSecret for the frontend to complete payment via Stripe Elements
  app.post('/purchase', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = SupportPurchaseSchema.parse(req.body);
    const result = await supportService.purchase(
      req.user.id,
      body.eventId,
      body.ticketCount,
      body.message,
    );
    return reply.code(201).send(result);
  });
}
