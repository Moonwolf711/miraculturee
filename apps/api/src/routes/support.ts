import type { FastifyInstance } from 'fastify';
import { SupportPurchaseSchema } from '@miraculturee/shared';
import { SupportService } from '../services/support.service.js';

export async function supportRoutes(app: FastifyInstance) {
  const supportService = new SupportService(app.prisma, app.pos);

  // Authenticated: purchase support tickets
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

  // Webhook: confirm payment (called by Stripe)
  app.post('/webhook', async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) return reply.code(400).send({ error: 'Missing signature' });

    try {
      const event = app.pos.parseWebhook(req.body as string, signature) as any;

      if (event.type === 'payment_intent.succeeded') {
        const metadata = event.data.object.metadata;
        if (metadata.type === 'support_purchase') {
          await supportService.confirmPurchase(metadata.supportTicketId, event.data.object.id);
        }
      }

      return reply.send({ received: true });
    } catch {
      return reply.code(400).send({ error: 'Webhook verification failed' });
    }
  });
}
