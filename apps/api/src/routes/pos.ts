import type { FastifyInstance } from 'fastify';
import { CreatePaymentSchema, UuidParamSchema } from '@miraculturee/shared';

export async function posRoutes(app: FastifyInstance) {
  // Authenticated: create payment intent
  app.post('/payment', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreatePaymentSchema.parse(req.body);
    const result = await app.pos.createPayment({
      amountCents: body.amountCents,
      currency: body.currency,
      metadata: { ...body.metadata, userId: req.user.id },
    });
    return reply.code(201).send(result);
  });

  // Authenticated: confirm payment
  app.post('/payment/:id/confirm', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const result = await app.pos.confirmPayment(id);
    return reply.send(result);
  });
}
