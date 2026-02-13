/**
 * Admin routes for external event management
 */

import type { FastifyInstance } from 'fastify';
import { ExternalEventsQuerySchema, SyncLogsQuerySchema } from '@miraculturee/shared';
import { EventIngestionService } from '../../services/event-ingestion/ingestion.service.js';

export default async function externalEventsRoutes(app: FastifyInstance) {
  /**
   * POST /admin/external-events/sync
   * Trigger manual sync from all sources
   */
  app.post('/sync', async (req, reply) => {
    const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
    const edmtrainApiKey = process.env.EDMTRAIN_API_KEY;

    if (!ticketmasterApiKey && !edmtrainApiKey) {
      return reply.code(500).send({ error: 'No event API keys configured' });
    }

    const ingestionService = new EventIngestionService(
      app.prisma,
      app.log,
      {
        ...(ticketmasterApiKey && {
          ticketmaster: {
            apiKey: ticketmasterApiKey,
            countryCode: 'US',
            classificationName: 'music',
            daysAhead: 180,
            dmaIds: ['751', '803', '501', '602'],
          },
        }),
        ...(edmtrainApiKey && {
          edmtrain: {
            clientKey: edmtrainApiKey,
            // Denver, NYC, LA, Chicago, SF, Miami, Atlanta, Detroit
            locationIds: [76, 70, 73, 71, 72, 87, 84, 102],
          },
        }),
      },
    );

    const results = await ingestionService.syncAll();

    // Auto-publish discovered events to main Event table
    const publishResult = await ingestionService.publishExternalEvents();

    return reply.send({
      success: true,
      results,
      published: publishResult,
    });
  });

  /**
   * POST /admin/external-events/publish
   * Publish discovered external events to main Event table
   */
  app.post('/publish', async (req, reply) => {
    const ingestionService = new EventIngestionService(app.prisma, app.log, {});
    const result = await ingestionService.publishExternalEvents();
    return reply.send({ success: true, ...result });
  });

  /**
   * GET /admin/external-events
   * List external events with filters
   */
  app.get('/', async (req, reply) => {
    const parsed = ExternalEventsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }
    const { source, status, city, limit, offset } = parsed.data;

    const where: Record<string, unknown> = {};
    if (source) where.source = source;
    if (status) where.status = status;
    if (city) where.venueCity = { contains: city, mode: 'insensitive' };

    const events = await app.prisma.externalEvent.findMany({
      where,
      orderBy: { eventDate: 'asc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        externalId: true,
        source: true,
        sourceUrl: true,
        title: true,
        artistName: true,
        venueName: true,
        venueCity: true,
        venueState: true,
        eventDate: true,
        minPriceCents: true,
        maxPriceCents: true,
        currency: true,
        genre: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    });

    const total = await app.prisma.externalEvent.count({ where });

    return reply.send({
      events,
      total,
      limit,
      offset,
    });
  });

  /**
   * GET /admin/external-events/:id
   * Get details of a specific external event
   */
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const event = await app.prisma.externalEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }

    return reply.send(event);
  });

  /**
   * GET /admin/sync-logs
   * Get recent sync logs
   */
  app.get('/sync-logs', async (req, reply) => {
    const parsed = SyncLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0].message });
    }
    const { source, limit } = parsed.data;

    const where: Record<string, unknown> = {};
    if (source) where.source = source;

    const logs = await app.prisma.eventSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return reply.send({ logs });
  });
}
