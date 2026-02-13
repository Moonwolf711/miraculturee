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
import { PurchaseAgentService } from '../../services/purchase-agent.service.js';
import { BrowserPurchaseService } from '../../services/browser-purchase.service.js';
import { triggerPurchaseAgent } from '../../jobs/workers.js';

export default async function issuingRoutes(app: FastifyInstance) {
  const getService = () => new TicketAcquisitionService(app.prisma, app.pos);

  /**
   * GET /admin/issuing/setup-status
   * Check Stripe Issuing configuration and readiness for live purchases.
   * Returns what's configured, what's missing, and next steps.
   */
  app.get('/setup-status', async (_req, reply) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    const isLiveMode = stripeKey.startsWith('sk_live_');
    const isTestMode = stripeKey.startsWith('sk_test_');
    const cardholderId = process.env.STRIPE_ISSUING_CARDHOLDER_ID || '';
    const hasCardholder = cardholderId.length > 0;

    const cardholderStatus = hasCardholder ? 'configured' : 'not_configured';

    const steps: string[] = [];
    if (!isLiveMode) {
      steps.push('Switch STRIPE_SECRET_KEY to live mode (sk_live_...) — test mode cards cannot make real purchases');
      steps.push('Update STRIPE_PUBLISHABLE_KEY to live mode (pk_live_...) as well');
    }
    if (!hasCardholder) {
      steps.push('Create a cardholder via POST /admin/issuing/cardholder with business address');
      steps.push('Then set STRIPE_ISSUING_CARDHOLDER_ID env var with the returned ID');
    }
    if (!process.env.TICKETMASTER_API_KEY) {
      steps.push('Set TICKETMASTER_API_KEY env var for Ticketmaster event search');
    }
    if (!process.env.EVENTBRITE_API_TOKEN) {
      steps.push('Set EVENTBRITE_API_TOKEN env var for Eventbrite event search and API purchases');
    }

    const ready = isLiveMode && hasCardholder;

    return reply.send({
      ready,
      stripe: {
        mode: isLiveMode ? 'live' : isTestMode ? 'test' : 'unknown',
        liveMode: isLiveMode,
        note: isLiveMode
          ? 'Live mode — virtual cards can make real purchases'
          : 'Test mode — cards will be declined at real vendor checkouts',
      },
      cardholder: {
        configured: hasCardholder,
        id: hasCardholder ? cardholderId : null,
        status: cardholderStatus,
      },
      vendors: {
        ticketmaster: !!process.env.TICKETMASTER_API_KEY,
        eventbrite: !!process.env.EVENTBRITE_API_TOKEN,
      },
      nextSteps: steps.length > 0 ? steps : ['All configured — ready for automated purchases'],
    });
  });

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

  /* ─── Purchase Agent Controls ─── */

  /**
   * POST /admin/issuing/agent/run
   * Trigger a full purchase agent cycle (scans all events, buys tickets).
   * Runs asynchronously via BullMQ.
   */
  app.post('/agent/run', async (_req, reply) => {
    await triggerPurchaseAgent();
    return reply.send({
      success: true,
      message: 'Purchase agent cycle queued. Check /admin/issuing/acquisitions for results.',
    });
  });

  /**
   * POST /admin/issuing/agent/run/:eventId
   * Trigger the purchase agent for a specific event.
   */
  app.post('/agent/run/:eventId', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };

    const event = await app.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return reply.code(404).send({ error: 'Event not found' });

    await triggerPurchaseAgent(eventId);
    return reply.send({
      success: true,
      message: `Purchase agent queued for event "${event.title}". Check acquisitions for results.`,
    });
  });

  /**
   * POST /admin/issuing/agent/run-now
   * Run the purchase agent synchronously (blocks until complete).
   * Useful for testing — returns results immediately.
   */
  app.post('/agent/run-now', async (_req, reply) => {
    const agent = new PurchaseAgentService(app.prisma, app.pos);
    const result = await agent.runAcquisitionCycle();
    return reply.send({ success: true, result });
  });

  /**
   * POST /admin/issuing/agent/run-now/:eventId
   * Run the purchase agent synchronously for a single event.
   */
  app.post('/agent/run-now/:eventId', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const agent = new PurchaseAgentService(app.prisma, app.pos);
    const result = await agent.acquireSingleEvent(eventId);
    return reply.send({ success: true, result });
  });

  /* ─── Browser Purchase (Playwright) ─── */

  /**
   * POST /admin/issuing/browser-purchase/:id
   * Run Playwright browser automation for a specific acquisition.
   * The acquisition must already have a virtual card (status: CARD_CREATED).
   */
  app.post('/browser-purchase/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const acquisition = await app.prisma.ticketAcquisition.findUnique({
      where: { id },
      include: { event: { select: { title: true } } },
    });
    if (!acquisition) return reply.code(404).send({ error: 'Acquisition not found' });
    if (!acquisition.stripeCardId) {
      return reply.code(400).send({ error: 'No virtual card — create one first via POST /acquire' });
    }
    if (!acquisition.purchaseUrl) {
      return reply.code(400).send({ error: 'No purchase URL — cannot automate' });
    }

    const browserService = new BrowserPurchaseService(app.prisma, app.pos);
    const result = await browserService.purchaseTickets({
      acquisitionId: id,
      purchaseUrl: acquisition.purchaseUrl,
      ticketCount: acquisition.ticketCount,
      cardId: acquisition.stripeCardId,
      eventTitle: acquisition.event.title,
    });

    return reply.send({ success: result.success, result });
  });

  /* ─── n8n Webhook Integration ─── */

  /**
   * POST /admin/issuing/webhook/acquisition-status
   * Webhook for n8n to receive acquisition status updates.
   * n8n polls this or receives push notifications.
   */
  app.post('/webhook/acquisition-status', async (req, reply) => {
    const { acquisitionId, action, confirmationRef, errorMessage } = req.body as any;

    if (!acquisitionId || !action) {
      return reply.code(400).send({ error: 'acquisitionId and action required' });
    }

    const service = getService();

    switch (action) {
      case 'complete': {
        if (!confirmationRef) {
          return reply.code(400).send({ error: 'confirmationRef required for complete action' });
        }
        const completed = await service.completeAcquisition(acquisitionId, confirmationRef);
        return reply.send({ success: true, acquisition: completed });
      }

      case 'fail': {
        const failed = await service.failAcquisition(acquisitionId, errorMessage || 'n8n workflow failure');
        return reply.send({ success: true, acquisition: failed });
      }

      case 'status': {
        const acquisition = await app.prisma.ticketAcquisition.findUnique({
          where: { id: acquisitionId },
          include: { event: { select: { title: true, venueName: true, date: true } } },
        });
        return reply.send({ acquisition });
      }

      default:
        return reply.code(400).send({ error: `Unknown action: ${action}` });
    }
  });

  /**
   * GET /admin/issuing/webhook/pending-acquisitions
   * n8n polls this to find acquisitions needing attention.
   */
  app.get('/webhook/pending-acquisitions', async (_req, reply) => {
    const acquisitions = await app.prisma.ticketAcquisition.findMany({
      where: { status: { in: ['CARD_CREATED', 'PENDING'] } },
      include: {
        event: { select: { title: true, venueName: true, date: true, ticketPriceCents: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({
      count: acquisitions.length,
      acquisitions: acquisitions.map((a) => ({
        id: a.id,
        eventId: a.eventId,
        eventTitle: a.event.title,
        venueName: a.event.venueName,
        eventDate: a.event.date,
        ticketCount: a.ticketCount,
        totalAmountCents: a.totalAmountCents,
        purchaseUrl: a.purchaseUrl,
        hasCard: !!a.stripeCardId,
        cardLast4: a.cardLast4,
        status: a.status,
        createdAt: a.createdAt,
      })),
    });
  });
}
