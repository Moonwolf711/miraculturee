import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ArtistIdParamSchema = z.object({
  artistId: z.string().uuid(),
});

export async function managerDashboardRoutes(app: FastifyInstance) {
  // ─── Helper: get all ArtistManager records for the authenticated user ───

  async function getManagedArtistIds(userId: string): Promise<string[]> {
    const records = await app.prisma.artistManager.findMany({
      where: { userId },
      select: { artistId: true },
    });
    return records.map((r) => r.artistId);
  }

  /** Verify the authenticated user is a manager for the given artist. */
  async function requireManagerOf(userId: string, artistId: string) {
    const record = await app.prisma.artistManager.findUnique({
      where: { artistId_userId: { artistId, userId } },
    });
    return record;
  }

  // ─── GET /manager/profile ───
  // Return the manager's profile for all managed artists (uses first record).

  app.get('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const records = await app.prisma.artistManager.findMany({
      where: { userId: req.user.id },
      orderBy: { addedAt: 'asc' },
      take: 1,
    });
    if (records.length === 0) {
      return reply.code(404).send({ error: 'No manager profile found' });
    }
    const r = records[0];
    return {
      displayName: r.displayName,
      bio: r.bio,
      profileImageUrl: r.profileImageUrl,
    };
  });

  // ─── PUT /manager/profile ───
  // Update the manager's profile across all managed artist records.

  const UpdateManagerProfileSchema = z.object({
    displayName: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    profileImageUrl: z.string().url().optional().nullable(),
  });

  app.put('/profile', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = UpdateManagerProfileSchema.parse(req.body);

    if (!body.displayName && body.bio === undefined && body.profileImageUrl === undefined) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const records = await app.prisma.artistManager.findMany({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (records.length === 0) {
      return reply.code(404).send({ error: 'No manager profile found' });
    }

    // Update all ArtistManager records for this user (consistent profile across artists)
    await app.prisma.artistManager.updateMany({
      where: { userId: req.user.id },
      data: {
        ...(body.displayName !== undefined && { displayName: body.displayName }),
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.profileImageUrl !== undefined && { profileImageUrl: body.profileImageUrl }),
      },
    });

    return { success: true };
  });

  // ─── GET /manager/dashboard ───
  // Aggregate stats across all artists this user manages.

  app.get('/dashboard', { preHandler: [app.authenticate] }, async (req, reply) => {
    const artistIds = await getManagedArtistIds(req.user.id);

    if (artistIds.length === 0) {
      return {
        managedArtists: 0,
        totalCampaigns: 0,
        totalFundedCents: 0,
        totalEvents: 0,
        upcomingEvents: [],
      };
    }

    const [campaignAgg, eventCount, upcomingEvents] = await Promise.all([
      app.prisma.campaign.aggregate({
        where: { artistId: { in: artistIds } },
        _count: { id: true },
        _sum: { fundedCents: true },
      }),
      app.prisma.event.count({
        where: { artistId: { in: artistIds } },
      }),
      app.prisma.event.findMany({
        where: {
          artistId: { in: artistIds },
          date: { gte: new Date() },
          status: { not: 'CANCELLED' },
        },
        include: { artist: { select: { stageName: true } } },
        orderBy: { date: 'asc' },
        take: 10,
      }),
    ]);

    return {
      managedArtists: artistIds.length,
      totalCampaigns: campaignAgg._count.id,
      totalFundedCents: campaignAgg._sum.fundedCents ?? 0,
      totalEvents: eventCount,
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        venueName: e.venueName,
        date: e.date.toISOString(),
        status: e.status,
        artistStageName: e.artist.stageName,
      })),
    };
  });

  // ─── GET /manager/artists ───
  // List all managed artists with per-artist stats.

  app.get('/artists', { preHandler: [app.authenticate] }, async (req, reply) => {
    const managerRecords = await app.prisma.artistManager.findMany({
      where: { userId: req.user.id },
      include: {
        artist: {
          select: {
            id: true,
            stageName: true,
            genre: true,
            isVerified: true,
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    });

    if (managerRecords.length === 0) {
      return { artists: [] };
    }

    // Gather per-artist campaign and event counts in parallel
    const artists = await Promise.all(
      managerRecords.map(async (mr) => {
        const [campaignAgg, upcomingEventCount] = await Promise.all([
          app.prisma.campaign.aggregate({
            where: {
              artistId: mr.artistId,
              status: { notIn: ['DRAFT', 'ENDED'] },
            },
            _count: { id: true },
            _sum: { fundedCents: true },
          }),
          app.prisma.event.count({
            where: {
              artistId: mr.artistId,
              date: { gte: new Date() },
              status: { not: 'CANCELLED' },
            },
          }),
        ]);

        return {
          artistId: mr.artist.id,
          stageName: mr.artist.stageName,
          genre: mr.artist.genre,
          isVerified: mr.artist.isVerified,
          permission: mr.permission,
          activeCampaigns: campaignAgg._count.id,
          totalFundedCents: campaignAgg._sum.fundedCents ?? 0,
          upcomingEvents: upcomingEventCount,
        };
      }),
    );

    return { artists };
  });

  // ─── GET /manager/artists/:artistId/campaigns ───
  // List campaigns for a specific managed artist.

  app.get(
    '/artists/:artistId/campaigns',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { artistId } = ArtistIdParamSchema.parse(req.params);

      const managerRecord = await requireManagerOf(req.user.id, artistId);
      if (!managerRecord) {
        return reply.code(403).send({ error: 'You are not a manager for this artist' });
      }

      const campaigns = await app.prisma.campaign.findMany({
        where: { artistId },
        include: {
          event: {
            select: { title: true, date: true, venueName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        campaigns: campaigns.map((c) => ({
          id: c.id,
          headline: c.headline,
          status: c.status,
          fundedCents: c.fundedCents,
          goalCents: c.goalCents,
          event: {
            title: c.event.title,
            date: c.event.date.toISOString(),
            venueName: c.event.venueName,
          },
        })),
      };
    },
  );

  // ─── GET /manager/artists/:artistId/events ───
  // List events for a specific managed artist.

  app.get(
    '/artists/:artistId/events',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { artistId } = ArtistIdParamSchema.parse(req.params);

      const managerRecord = await requireManagerOf(req.user.id, artistId);
      if (!managerRecord) {
        return reply.code(403).send({ error: 'You are not a manager for this artist' });
      }

      const events = await app.prisma.event.findMany({
        where: { artistId },
        orderBy: { date: 'desc' },
      });

      return {
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          venueName: e.venueName,
          date: e.date.toISOString(),
          status: e.status,
          ticketPriceCents: e.ticketPriceCents,
          totalTickets: e.totalTickets,
        })),
      };
    },
  );
}
