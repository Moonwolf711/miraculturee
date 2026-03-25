import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UuidParamSchema } from '@miraculturee/shared';

// ─── Zod Schemas ───

const SocialLinksSchema = z.object({
  instagram: z.string().max(100).optional(),
  twitter: z.string().max(100).optional(),
  tiktok: z.string().max(100).optional(),
  spotify: z.string().max(200).optional(),
  soundcloud: z.string().max(200).optional(),
  youtube: z.string().max(200).optional(),
  website: z.string().url().optional(),
}).optional();

const FollowerCountSchema = z.object({
  instagram: z.number().int().min(0).optional(),
  twitter: z.number().int().min(0).optional(),
  tiktok: z.number().int().min(0).optional(),
  spotify: z.number().int().min(0).optional(),
  soundcloud: z.number().int().min(0).optional(),
}).optional();

const LocalArtistSearchSchema = z.object({
  city: z.string().optional(),
  state: z.string().min(2).max(2).optional(),
  genre: z.string().optional(),
  available: z.enum(['true', 'false']).optional(),
  sort: z.enum(['recent', 'shows', 'popular']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const CreateLocalArtistSchema = z.object({
  stageName: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
  bio: z.string().max(3000).optional(),
  profileImageUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  genres: z.array(z.string().max(50)).max(15).optional(),
  instruments: z.array(z.string().max(50)).max(15).optional(),
  professionalType: z.string().max(60).optional(),
  yearsActive: z.number().int().min(0).max(80).optional(),
  bookingEmail: z.string().email().optional(),
  bookingRate: z.string().max(100).optional(),
  availableForBooking: z.boolean().optional(),
  epkUrl: z.string().url().optional(),
  socialLinks: SocialLinksSchema,
  followerCount: FollowerCountSchema,
});

const UpdateLocalArtistSchema = z.object({
  stageName: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(2).max(2).optional(),
  bio: z.string().max(3000).optional(),
  profileImageUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  genres: z.array(z.string().max(50)).max(15).optional(),
  instruments: z.array(z.string().max(50)).max(15).optional(),
  professionalType: z.string().max(60).optional(),
  yearsActive: z.number().int().min(0).max(80).optional(),
  bookingEmail: z.string().email().optional(),
  bookingRate: z.string().max(100).optional(),
  availableForBooking: z.boolean().optional(),
  epkUrl: z.string().url().optional(),
  socialLinks: SocialLinksSchema,
  followerCount: FollowerCountSchema,
});

const CreateReleaseSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.string().max(50), // Single, EP, Album, Mixtape, Remix
  platform: z.string().max(100).optional(),
  url: z.string().url().optional(),
  releaseDate: z.string().datetime().optional(),
  streamCount: z.number().int().min(0).optional(),
  coverImageUrl: z.string().optional(),
});

const UpdateReleaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.string().max(50).optional(),
  platform: z.string().max(100).optional(),
  url: z.string().url().optional(),
  releaseDate: z.string().datetime().optional(),
  streamCount: z.number().int().min(0).optional(),
  coverImageUrl: z.string().optional(),
});

const CreateShowSchema = z.object({
  venueName: z.string().min(1).max(200),
  venueCity: z.string().min(1).max(100),
  eventTitle: z.string().max(200).optional(),
  date: z.string().datetime(),
  role: z.string().min(1).max(60), // Headliner, Direct Support, Opener, Guest, Resident
  ticketsSold: z.number().int().min(0).optional(),
  totalAttendance: z.number().int().min(0).optional(),
  promoterName: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const UpdateShowSchema = z.object({
  venueName: z.string().min(1).max(200).optional(),
  venueCity: z.string().min(1).max(100).optional(),
  eventTitle: z.string().max(200).optional(),
  date: z.string().datetime().optional(),
  role: z.string().min(1).max(60).optional(),
  ticketsSold: z.number().int().min(0).optional(),
  totalAttendance: z.number().int().min(0).optional(),
  promoterName: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const CreateBookingRequestSchema = z.object({
  eventTitle: z.string().min(1).max(200),
  venueName: z.string().min(1).max(200),
  eventDate: z.string().datetime(),
  offeredRole: z.string().min(1).max(60),
  compensation: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
});

const RespondBookingSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED']),
});

// ─── Helpers ───

function calcProfileStrength(data: Record<string, unknown>): number {
  let score = 0;

  // stageName: 5
  if (data.stageName) score += 5;

  // profileImageUrl: 10
  if (data.profileImageUrl) score += 10;

  // bannerImageUrl: 5
  if (data.bannerImageUrl) score += 5;

  // bio: 10
  if (data.bio) score += 10;

  // city+state: 5
  if (data.city && data.state) score += 5;

  // genres (length > 0): 5
  if (Array.isArray(data.genres) && data.genres.length > 0) score += 5;

  // instruments (length > 0): 5
  if (Array.isArray(data.instruments) && data.instruments.length > 0) score += 5;

  // professionalType: 5
  if (data.professionalType) score += 5;

  // yearsActive: 5
  if (data.yearsActive != null) score += 5;

  // socialLinks (any set): 10
  if (data.socialLinks && typeof data.socialLinks === 'object') {
    const links = data.socialLinks as Record<string, unknown>;
    if (Object.values(links).some(Boolean)) score += 10;
  }

  // followerCount (any > 0): 5
  if (data.followerCount && typeof data.followerCount === 'object') {
    const counts = data.followerCount as Record<string, number>;
    if (Object.values(counts).some((v) => typeof v === 'number' && v > 0)) score += 5;
  }

  // bookingEmail: 5
  if (data.bookingEmail) score += 5;

  // releases (length > 0): 10
  if (Array.isArray(data.releases) && data.releases.length > 0) score += 10;

  // pastShows (length > 0): 15
  if (Array.isArray(data.pastShows) && data.pastShows.length > 0) score += 15;

  return Math.min(score, 100);
}

async function recalcShowStats(
  prisma: FastifyInstance['prisma'],
  artistProfileId: string,
) {
  const shows = await prisma.localArtistShow.findMany({
    where: { artistProfileId },
    select: { ticketsSold: true },
  });
  const totalShows = shows.length;
  const totalTicketsSold = shows.reduce(
    (sum, s) => sum + (s.ticketsSold ?? 0),
    0,
  );
  const avgTicketsPerShow =
    totalShows > 0 ? totalTicketsSold / totalShows : 0;

  await prisma.localArtistProfile.update({
    where: { id: artistProfileId },
    data: {
      totalShows,
      totalTicketsSold,
      avgTicketsPerShow: Math.round(avgTicketsPerShow * 10) / 10,
    },
  });
}

// ─── Routes ───

export async function localArtistRoutes(app: FastifyInstance) {
  // ─── Public: Browse local artists ───

  /** GET /local-artists — search/browse local artist profiles */
  app.get('/', async (req) => {
    const { city, state, genre, available, sort, page, limit } =
      LocalArtistSearchSchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (state) where.state = state.toUpperCase();
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (genre) where.genres = { has: genre };
    if (available !== undefined) where.availableForBooking = available === 'true';

    let orderBy: Record<string, string>[];
    switch (sort) {
      case 'shows':
        orderBy = [{ totalShows: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'popular':
        orderBy = [{ totalTicketsSold: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'recent':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    const [artists, total] = await Promise.all([
      app.prisma.localArtistProfile.findMany({
        where,
        select: {
          id: true,
          stageName: true,
          city: true,
          state: true,
          genres: true,
          professionalType: true,
          profileImageUrl: true,
          bannerImageUrl: true,
          verificationStatus: true,
          totalShows: true,
          totalTicketsSold: true,
          availableForBooking: true,
          yearsActive: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.localArtistProfile.count({ where }),
    ]);

    return { artists, total, page, limit };
  });

  /** GET /local-artists/:id — get full public profile */
  app.get('/:id', async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { id },
      select: {
        id: true,
        stageName: true,
        city: true,
        state: true,
        bio: true,
        profileImageUrl: true,
        bannerImageUrl: true,
        genres: true,
        instruments: true,
        professionalType: true,
        yearsActive: true,
        bookingEmail: true,
        bookingRate: true,
        availableForBooking: true,
        epkUrl: true,
        socialLinks: true,
        followerCount: true,
        verificationStatus: true,
        profileStrength: true,
        totalShows: true,
        totalTicketsSold: true,
        avgTicketsPerShow: true,
        lastBookedAt: true,
        createdAt: true,
        releases: {
          orderBy: { releaseDate: 'desc' },
        },
        pastShows: {
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!profile) return reply.code(404).send({ error: 'Local artist not found' });
    return profile;
  });

  // ─── Authenticated: Profile management ───

  /** GET /local-artists/profile/me — get own profile (dashboard) */
  app.get('/profile/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        releases: { orderBy: { releaseDate: 'desc' } },
        pastShows: { orderBy: { date: 'desc' } },
        bookingRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            requester: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });
    return profile;
  });

  /** POST /local-artists/profile — create EPK profile */
  app.post('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateLocalArtistSchema.parse(req.body);

    const existing = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (existing) return reply.code(409).send({ error: 'You already have a local artist profile' });

    const profileStrength = calcProfileStrength(body as Record<string, unknown>);

    const profile = await app.prisma.localArtistProfile.create({
      data: {
        userId: req.user.id,
        stageName: body.stageName,
        city: body.city,
        state: body.state.toUpperCase(),
        bio: body.bio,
        profileImageUrl: body.profileImageUrl,
        bannerImageUrl: body.bannerImageUrl,
        genres: body.genres ?? [],
        instruments: body.instruments ?? [],
        professionalType: body.professionalType,
        yearsActive: body.yearsActive,
        bookingEmail: body.bookingEmail,
        bookingRate: body.bookingRate,
        availableForBooking: body.availableForBooking ?? true,
        epkUrl: body.epkUrl,
        socialLinks: body.socialLinks ?? undefined,
        followerCount: body.followerCount ?? undefined,
        profileStrength,
      },
    });

    return reply.code(201).send(profile);
  });

  /** PUT /local-artists/profile — update own profile */
  app.put('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = UpdateLocalArtistSchema.parse(req.body);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
      include: { releases: true, pastShows: true },
    });
    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });

    const merged = { ...profile, ...body };
    const profileStrength = calcProfileStrength(merged as Record<string, unknown>);

    const updated = await app.prisma.localArtistProfile.update({
      where: { id: profile.id },
      data: {
        ...body,
        state: body.state?.toUpperCase(),
        genres: body.genres ?? undefined,
        instruments: body.instruments ?? undefined,
        socialLinks: body.socialLinks ?? undefined,
        followerCount: body.followerCount ?? undefined,
        profileStrength,
      },
    });

    return updated;
  });

  // ─── Releases CRUD ───

  /** POST /local-artists/releases — add a release */
  app.post('/releases', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateReleaseSchema.parse(req.body);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });

    const release = await app.prisma.localArtistRelease.create({
      data: {
        artistProfileId: profile.id,
        title: body.title,
        type: body.type,
        platform: body.platform,
        url: body.url,
        releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined,
        streamCount: body.streamCount,
        coverImageUrl: body.coverImageUrl,
      },
    });

    // Recalculate profile strength (releases count toward it)
    const releases = await app.prisma.localArtistRelease.findMany({
      where: { artistProfileId: profile.id },
    });
    const merged = { ...profile, releases };
    const profileStrength = calcProfileStrength(merged as Record<string, unknown>);
    await app.prisma.localArtistProfile.update({
      where: { id: profile.id },
      data: { profileStrength },
    });

    return reply.code(201).send(release);
  });

  /** PUT /local-artists/releases/:id — update a release */
  app.put('/releases/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const body = UpdateReleaseSchema.parse(req.body);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });

    const release = await app.prisma.localArtistRelease.findUnique({ where: { id } });
    if (!release) return reply.code(404).send({ error: 'Release not found' });
    if (release.artistProfileId !== profile.id) {
      return reply.code(403).send({ error: 'You do not own this release' });
    }

    const updated = await app.prisma.localArtistRelease.update({
      where: { id },
      data: {
        ...body,
        releaseDate: body.releaseDate ? new Date(body.releaseDate) : undefined,
      },
    });

    return updated;
  });

  /** DELETE /local-artists/releases/:id — delete a release */
  app.delete('/releases/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });

    const release = await app.prisma.localArtistRelease.findUnique({ where: { id } });
    if (!release) return reply.code(404).send({ error: 'Release not found' });
    if (release.artistProfileId !== profile.id) {
      return reply.code(403).send({ error: 'You do not own this release' });
    }

    await app.prisma.localArtistRelease.delete({ where: { id } });

    // Recalculate profile strength
    const releases = await app.prisma.localArtistRelease.findMany({
      where: { artistProfileId: profile.id },
    });
    const merged = { ...profile, releases };
    const profileStrength = calcProfileStrength(merged as Record<string, unknown>);
    await app.prisma.localArtistProfile.update({
      where: { id: profile.id },
      data: { profileStrength },
    });

    return { message: 'Release deleted' };
  });

  // ─── Shows CRUD ───

  /** POST /local-artists/shows — add a past show */
  app.post('/shows', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = CreateShowSchema.parse(req.body);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });

    const show = await app.prisma.localArtistShow.create({
      data: {
        artistProfileId: profile.id,
        venueName: body.venueName,
        venueCity: body.venueCity,
        eventTitle: body.eventTitle,
        date: new Date(body.date),
        role: body.role,
        ticketsSold: body.ticketsSold,
        totalAttendance: body.totalAttendance,
        promoterName: body.promoterName,
        notes: body.notes,
      },
    });

    // Recalculate show stats + profile strength
    await recalcShowStats(app.prisma, profile.id);
    const updatedProfile = await app.prisma.localArtistProfile.findUnique({
      where: { id: profile.id },
      include: { releases: true, pastShows: true },
    });
    if (updatedProfile) {
      const profileStrength = calcProfileStrength(updatedProfile as unknown as Record<string, unknown>);
      await app.prisma.localArtistProfile.update({
        where: { id: profile.id },
        data: { profileStrength },
      });
    }

    return reply.code(201).send(show);
  });

  /** PUT /local-artists/shows/:id — update a past show */
  app.put('/shows/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const body = UpdateShowSchema.parse(req.body);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });

    const show = await app.prisma.localArtistShow.findUnique({ where: { id } });
    if (!show) return reply.code(404).send({ error: 'Show not found' });
    if (show.artistProfileId !== profile.id) {
      return reply.code(403).send({ error: 'You do not own this show' });
    }

    const updated = await app.prisma.localArtistShow.update({
      where: { id },
      data: {
        ...body,
        date: body.date ? new Date(body.date) : undefined,
      },
    });

    // Recalculate show stats + profile strength
    await recalcShowStats(app.prisma, profile.id);
    const updatedProfile = await app.prisma.localArtistProfile.findUnique({
      where: { id: profile.id },
      include: { releases: true, pastShows: true },
    });
    if (updatedProfile) {
      const profileStrength = calcProfileStrength(updatedProfile as unknown as Record<string, unknown>);
      await app.prisma.localArtistProfile.update({
        where: { id: profile.id },
        data: { profileStrength },
      });
    }

    return updated;
  });

  /** DELETE /local-artists/shows/:id — delete a past show */
  app.delete('/shows/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);

    const profile = await app.prisma.localArtistProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return reply.code(404).send({ error: 'No local artist profile found' });

    const show = await app.prisma.localArtistShow.findUnique({ where: { id } });
    if (!show) return reply.code(404).send({ error: 'Show not found' });
    if (show.artistProfileId !== profile.id) {
      return reply.code(403).send({ error: 'You do not own this show' });
    }

    await app.prisma.localArtistShow.delete({ where: { id } });

    // Recalculate show stats + profile strength
    await recalcShowStats(app.prisma, profile.id);
    const updatedProfile = await app.prisma.localArtistProfile.findUnique({
      where: { id: profile.id },
      include: { releases: true, pastShows: true },
    });
    if (updatedProfile) {
      const profileStrength = calcProfileStrength(updatedProfile as unknown as Record<string, unknown>);
      await app.prisma.localArtistProfile.update({
        where: { id: profile.id },
        data: { profileStrength },
      });
    }

    return { message: 'Show deleted' };
  });

  // ─── Booking Requests ───

  /** POST /local-artists/:id/booking — send booking request to a local artist */
  app.post('/:id/booking', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const body = CreateBookingRequestSchema.parse(req.body);

    const profile = await app.prisma.localArtistProfile.findUnique({ where: { id } });
    if (!profile) return reply.code(404).send({ error: 'Local artist not found' });

    const booking = await app.prisma.bookingRequest.create({
      data: {
        localArtistId: id,
        requesterId: req.user.id,
        eventTitle: body.eventTitle,
        venueName: body.venueName,
        eventDate: new Date(body.eventDate),
        offeredRole: body.offeredRole,
        compensation: body.compensation,
        message: body.message,
      },
    });

    return reply.code(201).send(booking);
  });

  /** PUT /local-artists/booking/:id/respond — respond to a booking request */
  app.put('/booking/:id/respond', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = UuidParamSchema.parse(req.params);
    const { status } = RespondBookingSchema.parse(req.body);

    const booking = await app.prisma.bookingRequest.findUnique({
      where: { id },
      include: { localArtist: { select: { userId: true } } },
    });
    if (!booking) return reply.code(404).send({ error: 'Booking request not found' });
    if (booking.localArtist.userId !== req.user.id) {
      return reply.code(403).send({ error: 'Only the local artist can respond to booking requests' });
    }

    const updated = await app.prisma.bookingRequest.update({
      where: { id },
      data: {
        status,
        respondedAt: new Date(),
      },
    });

    return updated;
  });
}
