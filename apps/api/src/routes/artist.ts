import type { FastifyInstance } from 'fastify';
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  CampaignListSchema,
  UuidParamSchema,
  RequestPayoutSchema,
  computeArtistProgression,
  computeMaxTicketsForLevel,
} from '@miraculturee/shared';
import { ArtistService } from '../services/artist.service.js';
import { ArtistVerificationService } from '../services/artistVerification.js';
import { ArtistMatchingService } from '../services/artist-matching.service.js';

export async function artistRoutes(app: FastifyInstance) {
  const artistService = new ArtistService(app.prisma, app.pos);
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

  /** GET /artist/public/:id — public artist profile (no auth required) */
  app.get('/public/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const artist = await app.prisma.artist.findUnique({
      where: { id },
      include: {
        socialAccounts: {
          select: {
            provider: true,
            providerUsername: true,
            profileUrl: true,
            followerCount: true,
          },
        },
        events: {
          where: { status: { not: 'DRAFT' } },
          orderBy: { date: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            date: true,
            venueName: true,
            city: true,
            state: true,
            flyerImageUrl: true,
            status: true,
          },
        },
        campaigns: {
          where: { status: { in: ['ACTIVE', 'FUNDED', 'COMPLETED'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            goalAmount: true,
            currentAmount: true,
            ticketPrice: true,
          },
        },
      },
    });

    if (!artist || artist.isPlaceholder) {
      return reply.code(404).send({ error: 'Artist not found' });
    }

    // Return only public-safe fields
    return {
      id: artist.id,
      stageName: artist.stageName,
      bio: artist.bio,
      profileImageUrl: artist.profileImageUrl,
      bannerImageUrl: artist.bannerImageUrl,
      genres: artist.genres,
      instruments: artist.instruments,
      professionalType: artist.professionalType,
      yearsActive: artist.yearsActive,
      hometown: artist.hometown,
      city: artist.city,
      state: artist.state,
      socialLinks: artist.socialLinks,
      followerCount: artist.followerCount,
      isVerified: artist.isVerified,
      profileStrength: artist.profileStrength,
      successfulCampaigns: artist.successfulCampaigns,
      socialAccounts: artist.socialAccounts,
      events: artist.events,
      campaigns: artist.campaigns,
      createdAt: artist.createdAt,
    };
  });

  /** GET /artist/public — list all public artists */
  app.get('/public', async (req) => {
    const { limit = '20', offset = '0', genre, search } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {
      isPlaceholder: false,
      isVerified: true,
    };

    if (genre) {
      where.genres = { has: genre };
    }

    if (search) {
      where.stageName = { contains: search, mode: 'insensitive' };
    }

    const [artists, total] = await Promise.all([
      app.prisma.artist.findMany({
        where,
        orderBy: { successfulCampaigns: 'desc' },
        take: Math.min(Number(limit), 50),
        skip: Number(offset),
        select: {
          id: true,
          stageName: true,
          bio: true,
          profileImageUrl: true,
          genres: true,
          professionalType: true,
          city: true,
          state: true,
          isVerified: true,
          successfulCampaigns: true,
        },
      }),
      app.prisma.artist.count({ where }),
    ]);

    return { artists, total };
  });

  app.get('/dashboard', { preHandler: [app.authenticate] }, async (req) => {
    return artistService.getDashboard(req.user.id);
  });

  /** PUT /artist/profile — update artist's own profile */
  app.put('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    // Basic fields
    if (body.stageName !== undefined && typeof body.stageName === 'string' && body.stageName.trim()) {
      data.stageName = (body.stageName as string).trim();
    }
    if (body.genre !== undefined) data.genre = body.genre || null;
    if (body.bio !== undefined) data.bio = body.bio || null;
    if (body.profileImageUrl !== undefined) data.profileImageUrl = body.profileImageUrl || null;
    if (body.bannerImageUrl !== undefined) data.bannerImageUrl = body.bannerImageUrl || null;
    if (body.city !== undefined) data.city = body.city || null;
    if (body.state !== undefined) data.state = body.state || null;
    if (body.websiteUrl !== undefined) data.websiteUrl = body.websiteUrl || null;
    if (body.professionalType !== undefined) data.professionalType = body.professionalType || null;
    if (body.hometown !== undefined) data.hometown = body.hometown || null;

    // Numeric fields
    if (body.yearsActive !== undefined) {
      data.yearsActive = body.yearsActive ? Number(body.yearsActive) : null;
    }

    // Array fields
    if (body.genres !== undefined && Array.isArray(body.genres)) {
      data.genres = body.genres;
      // Backward compat: set genre to first entry
      data.genre = (body.genres as string[]).length > 0 ? (body.genres as string[])[0] : null;
    }
    if (body.instruments !== undefined && Array.isArray(body.instruments)) {
      data.instruments = body.instruments;
    }

    // JSON fields
    if (body.socialLinks !== undefined) data.socialLinks = body.socialLinks || null;
    if (body.followerCount !== undefined) data.followerCount = body.followerCount || null;

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    // Calculate profile strength
    const merged = { ...artist, ...data };
    let strength = 0;
    if (merged.stageName) strength += 15;
    if (merged.bio) strength += 15;
    if (merged.profileImageUrl) strength += 15;
    if (merged.bannerImageUrl) strength += 5;
    if (merged.professionalType) strength += 10;
    if (merged.hometown || merged.city) strength += 5;
    if (merged.state) strength += 5;
    if (Array.isArray(merged.genres) && (merged.genres as string[]).length > 0) strength += 10;
    if (Array.isArray(merged.instruments) && (merged.instruments as string[]).length > 0) strength += 5;
    if (merged.yearsActive != null) strength += 5;
    if (merged.socialLinks && typeof merged.socialLinks === 'object' && Object.values(merged.socialLinks as Record<string, unknown>).some(Boolean)) strength += 10;
    data.profileStrength = Math.min(strength, 100);

    const updated = await app.prisma.artist.update({ where: { id: artist.id }, data });
    return updated;
  });

  /** PUT /artist/events/:eventId — update event media */
  app.put('/events/:eventId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    const event = await app.prisma.event.findFirst({
      where: { id: eventId, artistId: artist.id },
    });
    if (!event) return reply.code(404).send({ error: 'Event not found or not owned by you' });

    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (body.flyerImageUrl !== undefined) data.flyerImageUrl = body.flyerImageUrl || null;
    if (body.flyerImage2Url !== undefined) data.flyerImage2Url = body.flyerImage2Url || null;
    if (body.promoVideoUrl !== undefined) data.promoVideoUrl = body.promoVideoUrl || null;
    if (body.eventSocialLinks !== undefined) data.eventSocialLinks = body.eventSocialLinks || null;
    if (body.eventHashtag !== undefined) data.eventHashtag = body.eventHashtag || null;
    if (body.lineupNotes !== undefined) data.lineupNotes = body.lineupNotes || null;

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const updated = await app.prisma.event.update({ where: { id: eventId }, data });
    return updated;
  });

  /** GET /artist/profile — get artist's own profile */
  app.get('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artist = await app.prisma.artist.findUnique({
      where: { userId: req.user.id },
      include: {
        socialAccounts: { select: { provider: true, providerUsername: true, followerCount: true } },
        _count: { select: { campaigns: true, events: true, managers: true } },
      },
    });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });
    return artist;
  });

  app.get('/earnings', { preHandler: [app.authenticate] }, async (req) => {
    return artistService.getEarnings(req.user.id);
  });

  // --- Payouts ---

  /** GET /artist/payouts — full payout summary with per-campaign breakdown */
  app.get('/payouts', { preHandler: [app.authenticate] }, async (req) => {
    return artistService.getPayoutSummary(req.user.id);
  });

  /** POST /artist/payouts/request — request payout for a specific campaign */
  app.post('/payouts/request', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = RequestPayoutSchema.parse(req.body);
    const result = await artistService.requestPayout(req.user.id, body.campaignId);
    return reply.code(200).send(result);
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
        include: {
          event: { select: { title: true, date: true, venueName: true } },
          agentCampaign: {
            select: {
              id: true,
              status: true,
              revenueSharePct: true,
              artistRating: true,
              agent: { select: { id: true, displayName: true, city: true, state: true, rating: true, profileImageUrl: true } },
            },
          },
        },
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
        agentCampaign: c.agentCampaign ? {
          id: c.agentCampaign.id,
          status: c.agentCampaign.status,
          revenueSharePct: c.agentCampaign.revenueSharePct,
          artistRating: c.agentCampaign.artistRating,
          agent: c.agentCampaign.agent,
        } : null,
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

    // Compute progression from successful campaigns count
    const successfulCampaigns = await app.prisma.campaign.count({
      where: { artistId: artist.id, goalReached: true },
    });
    const prog = computeArtistProgression(successfulCampaigns);

    // Artist can optionally choose a lower level (fewer tickets)
    const chosenLevel = body.campaignLevel ?? prog.level;
    if (chosenLevel > prog.level) {
      return reply.code(400).send({
        error: `You are level ${prog.level}. You cannot create a campaign at level ${chosenLevel}.`,
      });
    }

    const maxLocalTickets = computeMaxTicketsForLevel(chosenLevel);
    const goalCents = event.ticketPriceCents * maxLocalTickets;

    const campaign = await app.prisma.campaign.create({
      data: {
        artistId: artist.id,
        eventId: body.eventId,
        headline: body.headline,
        message: body.message,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        goalCents,
        discountCents: prog.discountCents,
        maxLocalTickets,
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

  /** GET /artist/matched-events — events matching this artist's verified name */
  app.get('/matched-events', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artist = await app.prisma.artist.findUnique({
      where: { userId: req.user.id },
      include: { socialAccounts: { select: { provider: true } } },
    });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    // Require Spotify verification — only Spotify proves artist identity
    const hasSpotify = artist.socialAccounts.some((a) => a.provider === 'SPOTIFY');
    if (!hasSpotify) {
      return { matches: [] };
    }

    const matches = await matchingService.findMatchingEvents(artist.stageName, artist.id);
    return { matches };
  });

  /** POST /artist/claim/:eventId — artist claims an event and activates a campaign */
  app.post('/claim/:eventId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const artist = await app.prisma.artist.findUnique({
      where: { userId: req.user.id },
      include: { socialAccounts: { select: { provider: true } } },
    });
    if (!artist) return reply.code(404).send({ error: 'Artist profile not found' });

    // Require Spotify verification — only Spotify proves artist identity
    const hasSpotify = artist.socialAccounts.some((a) => a.provider === 'SPOTIFY');
    if (!hasSpotify) {
      return reply.code(403).send({ error: 'Connect your Spotify account to verify your identity before claiming events.' });
    }

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

    // Compute progression from successful campaigns count
    const successfulCampaigns = await app.prisma.campaign.count({
      where: { artistId: artist.id, goalReached: true },
    });
    const prog = computeArtistProgression(successfulCampaigns);
    const maxLocalTickets = prog.maxTicketsForLevel;
    const goalCents = event.ticketPriceCents * maxLocalTickets;

    // All in one transaction: transfer event, create campaign, publish
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
          discountCents: prog.discountCents,
          maxLocalTickets,
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
