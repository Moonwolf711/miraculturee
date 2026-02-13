import type { FastifyInstance } from 'fastify';
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  CampaignListSchema,
  UuidParamSchema,
} from '@miraculturee/shared';
import { requireRole } from '../middleware/authenticate.js';
import { ArtistService } from '../services/artist.service.js';

export async function artistRoutes(app: FastifyInstance) {
  const artistService = new ArtistService(app.prisma);

  app.get('/dashboard', { preHandler: [requireRole('ARTIST')] }, async (req) => {
    return artistService.getDashboard(req.user.id);
  });

  app.get('/earnings', { preHandler: [requireRole('ARTIST')] }, async (req) => {
    return artistService.getEarnings(req.user.id);
  });

  // --- Campaigns ---

  /** GET /artist/campaigns — list campaigns for the authenticated artist */
  app.get('/campaigns', { preHandler: [requireRole('ARTIST')] }, async (req) => {
    const query = CampaignListSchema.parse(req.query);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return { campaigns: [], total: 0 };

    const where: Record<string, unknown> = { artistId: artist.id };
    if (query.status) where.status = query.status;

    const [campaigns, total] = await Promise.all([
      app.prisma.campaign.findMany({
        where,
        include: { event: { select: { title: true, date: true, venueName: true } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      app.prisma.campaign.count({ where }),
    ]);

    return {
      campaigns: campaigns.map((c) => ({
        id: c.id,
        eventId: c.eventId,
        eventTitle: c.event.title,
        eventDate: c.event.date.toISOString(),
        venueName: c.event.venueName,
        headline: c.headline,
        message: c.message,
        status: c.status,
        startAt: c.startAt?.toISOString() ?? null,
        endAt: c.endAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
    };
  });

  /** POST /artist/campaigns — create a campaign for one of the artist's events */
  app.post('/campaigns', { preHandler: [requireRole('ARTIST')] }, async (req, reply) => {
    const body = CreateCampaignSchema.parse(req.body);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    // Verify the event belongs to this artist
    const event = await app.prisma.event.findFirst({
      where: { id: body.eventId, artistId: artist.id },
    });
    if (!event) return reply.code(404).send({ error: 'Event not found or not owned by you' });

    const campaign = await app.prisma.campaign.create({
      data: {
        artistId: artist.id,
        eventId: body.eventId,
        headline: body.headline,
        message: body.message,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
      },
    });

    return reply.code(201).send(campaign);
  });

  /** GET /artist/campaigns/:id — get a single campaign */
  app.get('/campaigns/:id', { preHandler: [requireRole('ARTIST')] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const campaign = await app.prisma.campaign.findFirst({
      where: { id, artistId: artist.id },
      include: { event: { select: { title: true, date: true, venueName: true, venueCity: true } } },
    });
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });

    return campaign;
  });

  /** PUT /artist/campaigns/:id — update a campaign */
  app.put('/campaigns/:id', { preHandler: [requireRole('ARTIST')] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const body = UpdateCampaignSchema.parse(req.body);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const existing = await app.prisma.campaign.findFirst({
      where: { id, artistId: artist.id },
    });
    if (!existing) return reply.code(404).send({ error: 'Campaign not found' });

    const campaign = await app.prisma.campaign.update({
      where: { id },
      data: {
        ...(body.headline !== undefined && { headline: body.headline }),
        ...(body.message !== undefined && { message: body.message }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.startAt !== undefined && { startAt: body.startAt ? new Date(body.startAt) : null }),
        ...(body.endAt !== undefined && { endAt: body.endAt ? new Date(body.endAt) : null }),
      },
    });

    return campaign;
  });

  /** DELETE /artist/campaigns/:id — delete a draft campaign */
  app.delete('/campaigns/:id', { preHandler: [requireRole('ARTIST')] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const campaign = await app.prisma.campaign.findFirst({
      where: { id, artistId: artist.id },
    });
    if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });
    if (campaign.status === 'ACTIVE') {
      return reply.code(400).send({ error: 'Cannot delete an active campaign — end it first' });
    }

    await app.prisma.campaign.delete({ where: { id } });
    return { success: true };
  });
}
