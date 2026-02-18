import type { FastifyInstance } from 'fastify';
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  CampaignListSchema,
  UuidParamSchema,
} from '@miraculturee/shared';
import { ArtistService } from '../services/artist.service.js';
import { ArtistVerificationService } from '../services/artistVerification.js';
import { ArtistMatchingService } from '../services/artist-matching.service.js';

export async function artistRoutes(app: FastifyInstance) {
  const artistService = new ArtistService(app.prisma);
  const verificationService = new ArtistVerificationService(app.prisma);
  const matchingService = new ArtistMatchingService(app.prisma);

  /** Helper: get or auto-create artist profile for the authenticated user */
  async function getOrCreateArtist(userId: string) {
    let artist = await app.prisma.artist.findUnique({ where: { userId } });
    if (!artist) {
      const user = await app.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return null;
      [, artist] = await app.prisma.$transaction([
        app.prisma.user.update({ where: { id: user.id }, data: { role: 'ARTIST' } }),
        app.prisma.artist.create({ data: { userId: user.id, stageName: user.name } }),
      ]);
    }
    return artist;
  }

  app.get('/dashboard', { preHandler: [app.authenticate] }, async (req) => {
    return artistService.getDashboard(req.user.id);
  });

  app.get('/earnings', { preHandler: [app.authenticate] }, async (req) => {
    return artistService.getEarnings(req.user.id);
  });

  // --- Campaigns ---

  /** GET /artist/campaigns — list campaigns for the authenticated artist */
  app.get('/campaigns', { preHandler: [app.authenticate] }, async (req) => {
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
        goalCents: c.goalCents,
        fundedCents: c.fundedCents,
        goalReached: c.goalReached,
        bonusCents: c.bonusCents,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
    };
  });

  /** POST /artist/campaigns — create a campaign for one of the artist's events */
  app.post('/campaigns', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateCampaignSchema.parse(req.body);
    const artist = await getOrCreateArtist(req.user.id);
    if (!artist) return reply.code(404).send({ error: 'User not found' });

    // Verify the event belongs to this artist
    const event = await app.prisma.event.findFirst({
      where: { id: body.eventId, artistId: artist.id },
    });
    if (!event) return reply.code(404).send({ error: 'Event not found or not owned by you' });

    const goalCents = event.ticketPriceCents * 10;
    const discountCents = body.discountCents ?? 500;

    const campaign = await app.prisma.campaign.create({
      data: {
        artistId: artist.id,
        eventId: body.eventId,
        headline: body.headline,
        message: body.message,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        goalCents,
        discountCents,
      },
    });

    return reply.code(201).send(campaign);
  });

  /** GET /artist/campaigns/:id — get a single campaign */
  app.get('/campaigns/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
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
  app.put('/campaigns/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
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
  app.delete('/campaigns/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
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

  // --- Social Account Verification ---

  /** GET /artist/me/social-accounts — list connected social accounts */
  app.get('/me/social-accounts', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });
    const accounts = await verificationService.getSocialAccounts(artist.id);
    return {
      accounts,
      isVerified: artist.isVerified,
      verificationStatus: artist.verificationStatus,
    };
  });

  /** DELETE /artist/me/social-accounts/:provider — disconnect a social account */
  app.delete('/me/social-accounts/:provider', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { provider } = req.params as { provider: string };
    const upper = provider.toUpperCase();
    if (!['SPOTIFY', 'SOUNDCLOUD', 'INSTAGRAM', 'FACEBOOK'].includes(upper)) {
      return reply.code(400).send({ error: 'Invalid provider' });
    }
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });
    await verificationService.disconnectSocialAccount(artist.id, upper as any);
    return { success: true };
  });

  // --- Campaign-Gated: Matched Events & Claim ---

  /** GET /artist/matched-events — events matching this artist's name (via placeholder lookup) */
  app.get('/matched-events', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const matches = await matchingService.findMatchingEvents(artist.stageName, artist.id);
    return { matches };
  });

  /** POST /artist/claim/:eventId — artist claims an event and activates a campaign */
  app.post('/claim/:eventId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    // Enforce 2 campaigns per month limit
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const campaignsThisMonth = await app.prisma.campaign.count({
      where: {
        artistId: artist.id,
        createdAt: { gte: startOfMonth },
      },
    });
    if (campaignsThisMonth >= 2) {
      return reply.code(429).send({
        error: 'You can only activate 2 campaigns per month. Try again next month.',
        campaignsUsed: campaignsThisMonth,
        limit: 2,
      });
    }

    // Verify event exists and is AWAITING_ARTIST
    const event = await app.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true },
    });
    if (!event) return reply.code(404).send({ error: 'Event not found' });
    if (event.status !== 'AWAITING_ARTIST') {
      return reply.code(400).send({ error: 'Event is not awaiting an artist' });
    }

    // Verify name match (placeholder artist stageName vs real artist stageName)
    const placeholderName = event.artist.stageName.toLowerCase().trim();
    const realName = artist.stageName.toLowerCase().trim();
    if (placeholderName !== realName && !placeholderName.includes(realName) && !realName.includes(placeholderName)) {
      return reply.code(403).send({ error: 'Your artist name does not match this event' });
    }

    // All in one transaction: transfer event, create campaign, publish
    const goalCents = event.ticketPriceCents * 10;
    const result = await app.prisma.$transaction(async (tx) => {
      // Transfer event ownership to real artist
      const updatedEvent = await tx.event.update({
        where: { id: eventId },
        data: {
          artistId: artist.id,
          status: 'PUBLISHED',
        },
      });

      // Auto-create an ACTIVE campaign
      const campaign = await tx.campaign.create({
        data: {
          artistId: artist.id,
          eventId,
          headline: `${artist.stageName} is on MiraCulture!`,
          message: `Support ${artist.stageName} and get a chance at discounted tickets.`,
          status: 'ACTIVE',
          startAt: new Date(),
          endAt: event.date,
          goalCents,
          discountCents: 500,
        },
      });

      return { event: updatedEvent, campaign };
    });

    return reply.code(200).send({
      success: true,
      eventId: result.event.id,
      campaignId: result.campaign.id,
      status: result.event.status,
      campaignsUsedThisMonth: campaignsThisMonth + 1,
      campaignsRemaining: 2 - (campaignsThisMonth + 1),
    });
  });
}
