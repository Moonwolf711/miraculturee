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
