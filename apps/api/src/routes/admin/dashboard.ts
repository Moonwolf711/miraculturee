/**
 * Admin dashboard routes — users list + analytics
 */

import type { FastifyInstance } from 'fastify';

export default async function adminDashboardRoutes(app: FastifyInstance) {
  /**
   * GET /admin/users
   * List all users with pagination + search
   */
  app.get('/users', async (req) => {
    const { page = '1', limit = '50', search = '', role = '' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          city: true,
          emailVerified: true,
          createdAt: true,
          _count: {
            select: {
              supportTickets: true,
              raffleEntries: true,
              notifications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      app.prisma.user.count({ where }),
    ]);

    return { users, total, page: parseInt(page) || 1, totalPages: Math.ceil(total / take) };
  });

  /**
   * GET /admin/artists
   * List all artists with pagination + search + verification filter
   */
  app.get('/artists', async (req) => {
    const { page = '1', limit = '50', search = '', verification = '' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (search) {
      where.OR = [
        { stageName: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (verification === 'VERIFIED') {
      where.verificationStatus = 'VERIFIED';
    } else if (verification === 'UNVERIFIED') {
      where.verificationStatus = 'UNVERIFIED';
    }

    const [artists, total] = await Promise.all([
      app.prisma.artist.findMany({
        where,
        include: {
          user: {
            select: {
              id: true, email: true, name: true, role: true,
              isBanned: true, emailVerified: true,
            },
          },
          _count: {
            select: { socialAccounts: true, campaigns: true, events: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      app.prisma.artist.count({ where }),
    ]);

    // Count active campaigns per artist
    const artistIds = artists.map((a: any) => a.id);
    const activeCounts = artistIds.length > 0
      ? await app.prisma.campaign.groupBy({
          by: ['artistId'],
          where: { artistId: { in: artistIds }, status: 'ACTIVE' },
          _count: true,
        })
      : [];
    const activeMap = new Map(activeCounts.map((c: any) => [c.artistId, c._count]));

    const result = artists.map((a: any) => ({
      ...a,
      activeCampaigns: activeMap.get(a.id) || 0,
    }));

    return { artists: result, total, page: parseInt(page) || 1, totalPages: Math.ceil(total / take) };
  });

  /**
   * PUT /admin/artists/:id/verify
   * Admin-verify an artist
   */
  app.put('/artists/:id/verify', async (req) => {
    const { id } = req.params as { id: string };
    return app.prisma.artist.update({
      where: { id },
      data: { isVerified: true, verificationStatus: 'VERIFIED', verifiedAt: new Date() },
    });
  });

  /**
   * PUT /admin/artists/:id/reject
   * Unverify an artist
   */
  app.put('/artists/:id/reject', async (req) => {
    const { id } = req.params as { id: string };
    return app.prisma.artist.update({
      where: { id },
      data: { isVerified: false, verificationStatus: 'UNVERIFIED', verifiedAt: null },
    });
  });

  /**
   * PUT /admin/artists/:id/ban
   * Ban or unban an artist's user account
   */
  app.put('/artists/:id/ban', async (req) => {
    const { id } = req.params as { id: string };
    const { banned } = req.body as { banned: boolean };
    const artist = await app.prisma.artist.findUnique({ where: { id }, select: { userId: true } });
    if (!artist) {
      throw Object.assign(new Error('Artist not found'), { statusCode: 404 });
    }
    return app.prisma.user.update({
      where: { id: artist.userId },
      data: { isBanned: banned, bannedAt: banned ? new Date() : null },
    });
  });

  /**
   * PUT /admin/artists/:id
   * Edit artist profile (stageName, genre, bio)
   */
  app.put('/artists/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { stageName, genre, bio } = req.body as { stageName?: string; genre?: string; bio?: string };
    const data: any = {};
    if (stageName !== undefined) data.stageName = stageName;
    if (genre !== undefined) data.genre = genre;
    if (bio !== undefined) data.bio = bio;
    return app.prisma.artist.update({ where: { id }, data });
  });

  /**
   * GET /admin/analytics
   * Platform-wide stats
   */
  app.get('/analytics', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      usersLast30d,
      usersLast7d,
      totalEvents,
      upcomingEvents,
      totalSupport,
      supportRevenueCents,
      supportLast30d,
      totalRaffleEntries,
      totalDirectTickets,
      verifiedUsers,
      usersByRole,
      recentSignups,
    ] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      app.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      app.prisma.event.count(),
      app.prisma.event.count({ where: { date: { gte: now } } }),
      app.prisma.supportTicket.count({ where: { confirmed: true } }),
      app.prisma.supportTicket.aggregate({
        where: { confirmed: true },
        _sum: { totalAmountCents: true },
      }),
      app.prisma.supportTicket.count({
        where: { confirmed: true, createdAt: { gte: thirtyDaysAgo } },
      }),
      app.prisma.raffleEntry.count(),
      app.prisma.directTicket.count(),
      app.prisma.user.count({ where: { emailVerified: true } }),
      app.prisma.user.groupBy({ by: ['role'], _count: true }),
      app.prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        last30d: usersLast30d,
        last7d: usersLast7d,
        verified: verifiedUsers,
        byRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
      },
      events: {
        total: totalEvents,
        upcoming: upcomingEvents,
      },
      support: {
        totalTickets: totalSupport,
        revenueCents: supportRevenueCents._sum.totalAmountCents || 0,
        last30d: supportLast30d,
      },
      raffleEntries: totalRaffleEntries,
      directTickets: totalDirectTickets,
      recentSignups,
    };
  });
}
