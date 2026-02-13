/**
 * Admin routes for Stripe Issuing and ticket acquisition management.
 *
 * Endpoints:
 *   POST /admin/issuing/cardholder         — Create the MiraCulture cardholder (one-time)
 *   GET  /admin/issuing/pending             — Events needing ticket acquisition
 *   GET  /admin/issuing/acquisitions        — List all acquisitions
 *   POST /admin/issuing/acquire             — Create acquisition + virtual card for an event
 *   GET  /admin/issuing/acquisitions/:id/card — Get card details for manual purchase
 *   POST /admin/issuing/acquisitions/:id/complete — Mark acquisition as done
 *   POST /admin/issuing/acquisitions/:id/fail     — Mark acquisition as failed
 */

import type { FastifyInstance } from 'fastify';
import { TicketAcquisitionService } from '../../services/ticket-acquisition.service.js';

export default async function issuingRoutes(app: FastifyInstance) {
  const getService = () => new TicketAcquisitionService(app.prisma, app.pos);

  /**
   * POST /admin/issuing/cardholder
   * Create the MiraCulture business cardholder in Stripe Issuing.
   * Only needs to be called once — store the returned cardholder ID.
   */
  app.post('/cardholder', async (req, reply) => {
    const { name, email, line1, city, state, postalCode } = req.body as any;

    if (!name || !email || !line1 || !city || !state || !postalCode) {
      return reply.code(400).send({ error: 'All address fields are required' });
    }

    const result = await app.pos.createCardholder({
      name,
      email,
      billingAddress: {
        line1,
        city,
        state,
        postal_code: postalCode,
        country: 'US',
      },
    });

    return reply.send({
      success: true,
      cardholder: result,
      note: 'Save the cardholder ID — use it when creating virtual cards.',
    });
  });

  /**
   * GET /admin/issuing/pending
   * List events that have funded support tickets but need real ticket acquisition.
   */
  app.get('/pending', async (_req, reply) => {
    const service = getService();
    const pending = await service.getPendingEvents();
    return reply.send({ events: pending });
  });

  /**
   * GET /admin/issuing/acquisitions
   * List all ticket acquisitions.
   */
  app.get('/acquisitions', async (req, reply) => {
    const { status, limit = '50', offset = '0' } = req.query as any;
    const service = getService();
    const result = await service.listAcquisitions({
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    return reply.send(result);
  });

  /**
   * POST /admin/issuing/acquire
   * Create a ticket acquisition for an event and optionally generate a virtual card.
   *
   * Body: { eventId, ticketCount, cardholderId?, purchaseUrl? }
   */
  app.post('/acquire', async (req, reply) => {
    const { eventId, ticketCount, cardholderId, purchaseUrl } = req.body as any;

    if (!eventId || !ticketCount) {
      return reply.code(400).send({ error: 'eventId and ticketCount are required' });
    }

    const event = await app.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ error: 'Event not found' });

    const totalAmountCents = event.ticketPriceCents * ticketCount;
    const service = getService();

    const acquisition = await service.createAcquisition({
      eventId,
      ticketCount,
      totalAmountCents,
      purchaseUrl,
      cardholderId: cardholderId || process.env.STRIPE_ISSUING_CARDHOLDER_ID,
    });

    return reply.send({ success: true, acquisition });
  });

  /**
   * GET /admin/issuing/acquisitions/:id/card
   * Get full virtual card details (number, exp, cvc) for manual purchase.
   * SENSITIVE — only expose to authenticated admins.
   */
  app.get('/acquisitions/:id/card', async (req, reply) => {
    const { id } = req.params as { id: string };
    const service = getService();
    const result = await service.getCardDetailsForAcquisition(id);
    return reply.send(result);
  });

  /**
   * POST /admin/issuing/acquisitions/:id/complete
   * Mark an acquisition as completed after buying venue tickets.
   *
   * Body: { confirmationRef }
   */
  app.post('/acquisitions/:id/complete', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { confirmationRef } = req.body as any;

    if (!confirmationRef) {
      return reply.code(400).send({ error: 'confirmationRef is required (venue order number)' });
    }

    const service = getService();
    const acquisition = await service.completeAcquisition(id, confirmationRef);
    return reply.send({ success: true, acquisition });
  });

  /**
   * POST /admin/issuing/acquisitions/:id/fail
   * Mark an acquisition as failed.
   *
   * Body: { errorMessage }
   */
  app.post('/acquisitions/:id/fail', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { errorMessage } = req.body as any;

    const service = getService();
    const acquisition = await service.failAcquisition(id, errorMessage || 'Manual failure');
    return reply.send({ success: true, acquisition });
  });
}
