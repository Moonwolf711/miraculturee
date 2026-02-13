import type { FastifyInstance } from 'fastify';
import { CreateEventSchema, EventSearchSchema, NearbyEventsSchema, UuidParamSchema } from '@miraculturee/shared';
import { requireRole } from '../middleware/authenticate.js';
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
    const [cities, genres] = await Promise.all([
      app.prisma.event.findMany({
        where: { status: 'PUBLISHED', date: { gte: new Date() } },
        select: { venueCity: true },
        distinct: ['venueCity'],
        orderBy: { venueCity: 'asc' },
      }),
      app.prisma.artist.findMany({
        where: { genre: { not: null }, events: { some: { status: 'PUBLISHED', date: { gte: new Date() } } } },
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

  // Artist: create event
  app.post('/', { preHandler: [requireRole('ARTIST')] }, async (req, reply) => {
    const body = CreateEventSchema.parse(req.body);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const event = await eventService.create(artist.id, body);
    return reply.code(201).send(event);
  });
}
