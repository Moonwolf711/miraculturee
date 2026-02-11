import type { FastifyInstance } from 'fastify';
import { TicketPurchaseSchema } from '@miraculturee/shared';
import { TicketService } from '../services/ticket.service.js';

export async function ticketRoutes(app: FastifyInstance) {
  const ticketService = new TicketService(app.prisma, app.pos);

  // Authenticated: purchase a direct ticket
  // Returns a clientSecret for the frontend to complete payment via Stripe Elements
  app.post('/purchase', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = TicketPurchaseSchema.parse(req.body);

    // Verify CAPTCHA
    const captchaValid = await app.captcha.verify(body.captchaToken, req.ip);
    if (!captchaValid) {
      throw Object.assign(
        new Error('CAPTCHA verification failed. Please try again.'),
        { statusCode: 400 },
      );
    }

    const result = await ticketService.purchase(
      req.user.id,
      body.eventId,
      req.ip,
      body.deviceFingerprint,
    );
    return reply.code(201).send(result);
  });
}
