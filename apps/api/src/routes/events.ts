import type { FastifyInstance } from 'fastify';
import { CreateEventSchema, EventSearchSchema, NearbyEventsSchema, UuidParamSchema } from '@miraculturee/shared';
import { EventService } from '../services/event.service.js';

export async function eventRoutes(app: FastifyInstance) {
  const eventService = new EventService(app.prisma);

  // Public: search events
  app.get('/', async (req) => {
    const query = EventSearchSchema.parse(req.query);
    return eventService.search(query);
  });

  // Public: distinct filter options (cities + genres)
  app.get('/filters', async () => {
    const statusFilter = { in: ['PUBLISHED', 'AWAITING_ARTIST'] as ('PUBLISHED' | 'AWAITING_ARTIST')[] };
    const [cities, genres] = await Promise.all([
      app.prisma.event.findMany({
        where: { status: statusFilter, date: { gte: new Date() } },
        select: { venueCity: true },
        distinct: ['venueCity'],
        orderBy: { venueCity: 'asc' },
      }),
      app.prisma.artist.findMany({
        where: { genre: { not: null }, events: { some: { status: statusFilter, date: { gte: new Date() } } } },
        select: { genre: true },
        distinct: ['genre'],
        orderBy: { genre: 'asc' },
      }),
    ]);
    return {
      cities: cities.map((c) => c.venueCity).filter(Boolean),
      genres: genres.map((g) => g.genre).filter(Boolean),
    };
  });

  // Public: nearby events
  app.get('/nearby', async (req) => {
    const query = NearbyEventsSchema.parse(req.query);
    return eventService.nearby(query);
  });

  // Public: get event by ID
  app.get('/:id', async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const event = await eventService.getById(id);
    if (!event) return reply.code(404).send({ error: 'Event not found' });
    return event;
  });

  // Authenticated: create event (auto-creates artist profile if needed)
  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateEventSchema.parse(req.body);

    // Auto-create artist profile if user doesn't have one
    let artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) {
      const user = await app.prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return reply.code(404).send({ error: 'User not found' });
      [, artist] = await app.prisma.$transaction([
        app.prisma.user.update({ where: { id: user.id }, data: { role: 'ARTIST' } }),
        app.prisma.artist.create({ data: { userId: user.id, stageName: user.name } }),
      ]);
    }

    const event = await eventService.create(artist.id, body);
    return reply.code(201).send(event);
  });
}
