/**
 * Admin routes for external event management
 */

import type { FastifyInstance } from 'fastify';
import { EventIngestionService } from '../../services/event-ingestion/ingestion.service.js';

export default async function externalEventsRoutes(app: FastifyInstance) {
  /**
   * POST /admin/external-events/sync
   * Trigger manual sync from all sources
   */
  app.post('/sync', async (req, reply) => {
    // TODO: Add admin authentication middleware
    
    const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
    if (!ticketmasterApiKey) {
      return reply.code(500).send({ error: 'TICKETMASTER_API_KEY not configured' });
    }

    const ingestionService = new EventIngestionService(
      app.prisma,
      app.log,
      {
        ticketmaster: {
          apiKey: ticketmasterApiKey,
          countryCode: 'US',
          classificationName: 'music',
          daysAhead: 90,
          // Denver, Los Angeles, New York, Chicago
          dmaIds: ['751', '803', '501', '602'],
        },
      },
    );

    const results = await ingestionService.syncAll();

    return reply.send({
      success: true,
      results,
    });
  });

  /**
   * GET /admin/external-events
   * List external events with filters
   */
  app.get('/', async (req, reply) => {
    // TODO: Add admin authentication middleware

    const { source, status, city, limit = '50', offset = '0' } = req.query as any;

    const where: any = {};
    if (source) where.source = source;
    if (status) where.status = status;
    if (city) where.venueCity = { contains: city, mode: 'insensitive' };

    const events = await app.prisma.externalEvent.findMany({
      where,
      orderBy: { eventDate: 'asc' },
      take: parseInt(limit),
      skip: parseInt(offset),
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
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  });

  /**
   * GET /admin/external-events/:id
   * Get details of a specific external event
   */
  app.get('/:id', async (req, reply) => {
    // TODO: Add admin authentication middleware

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
    // TODO: Add admin authentication middleware

    const { source, limit = '20' } = req.query as any;

    const where: any = {};
    if (source) where.source = source;

    const logs = await app.prisma.eventSyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: parseInt(limit),
    });

    return reply.send({ logs });
  });
}
