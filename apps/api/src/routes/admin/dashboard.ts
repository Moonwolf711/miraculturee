/**
 * Admin dashboard routes — users list + analytics
 */

import type { FastifyInstance } from 'fastify';
import { hash } from 'bcrypt';
import { randomBytes } from 'crypto';

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
   * PUT /admin/users/:id/role
   * Update a user's role
   */
  app.put('/users/:id/role', async (req) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: string };
    const validRoles = ['FAN', 'LOCAL_FAN', 'ARTIST', 'ADMIN', 'DEVELOPER'];
    if (!role || !validRoles.includes(role)) {
      throw Object.assign(new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`), { statusCode: 400 });
    }
    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    const updated = await app.prisma.user.update({
      where: { id },
      data: { role: role as any },
      select: { id: true, email: true, name: true, role: true },
    });
    return updated;
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
   * POST /admin/artists/:id/email
   * Send a custom email to an artist
   */
  app.post('/artists/:id/email', async (req) => {
    const { id } = req.params as { id: string };
    const { subject, message } = req.body as { subject: string; message: string };
    if (!subject || !message) {
      throw Object.assign(new Error('Subject and message are required'), { statusCode: 400 });
    }
    const artist = await app.prisma.artist.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });
    if (!artist) {
      throw Object.assign(new Error('Artist not found'), { statusCode: 404 });
    }
    if (!app.emailService) {
      throw Object.assign(new Error('Email service not configured'), { statusCode: 503 });
    }
    await app.emailService.sendAdminEmail(artist.user.email, { subject, message });
    return { success: true };
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

  /**
   * POST /admin/outreach-blast
   * Send outreach/invite emails to a list of external users.
   * Expects: { users: [{ email, name }], source?: string, dryRun?: boolean }
   * Does NOT create accounts — just sends the marketing email.
   */
  app.post('/outreach-blast', async (req) => {
    const body = req.body as {
      users: { email: string; name: string }[];
      source?: string;
      dryRun?: boolean;
    };

    if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
      return { error: 'users array is required', sent: 0 };
    }

    const source = body.source || 'Wooking For Love';
    const dryRun = body.dryRun === true;
    const results = { sent: 0, skipped: 0, errors: 0, dryRun, total: body.users.length, details: [] as string[] };

    if (!app.emailService && !dryRun) {
      return { error: 'Email service not configured (RESEND_API_KEY missing)', sent: 0 };
    }

    for (const entry of body.users) {
      const email = entry.email?.trim().toLowerCase();
      const name = entry.name?.trim() || email?.split('@')[0] || 'there';

      if (!email || !email.includes('@')) {
        results.skipped++;
        continue;
      }

      if (dryRun) {
        results.sent++;
        if (results.sent <= 5) results.details.push(`Would send to: ${name} <${email}>`);
        continue;
      }

      try {
        await app.emailService!.sendOutreachInvite(email, name, source);
        results.sent++;
        // Rate limit: ~2/sec to stay within Resend limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        results.errors++;
        results.details.push(`Failed: ${email} — ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    return results;
  });

  /**
   * POST /admin/import-users
   * Bulk pre-create accounts from an external platform (e.g. WFL casting portal).
   * Expects: { users: [{ email, name }], source: string, sendEmail?: boolean }
   * Skips existing emails. Creates with random password — user resets via forgot-password.
   */
  app.post('/import-users', async (req) => {
    const body = req.body as {
      users: { email: string; name: string }[];
      source?: string;
      sendEmail?: boolean;
    };

    if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
      return { error: 'users array is required', imported: 0, skipped: 0 };
    }

    const source = body.source || 'Wooking For Love';
    const sendEmail = body.sendEmail !== false;
    const results = { imported: 0, skipped: 0, errors: 0, details: [] as string[] };

    for (const entry of body.users) {
      const email = entry.email?.trim().toLowerCase();
      const name = entry.name?.trim();

      if (!email || !name) {
        results.errors++;
        results.details.push(`Skipped: missing email or name`);
        continue;
      }

      // Check if already exists
      const existing = await app.prisma.user.findUnique({ where: { email } });
      if (existing) {
        results.skipped++;
        results.details.push(`Skipped: ${email} (already exists)`);
        continue;
      }

      try {
        // Create with random password — user will reset via forgot-password
        const randomPassword = randomBytes(32).toString('hex');
        const passwordHash = await hash(randomPassword, 10);

        await app.prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: 'FAN',
          },
        });

        results.imported++;
        results.details.push(`Imported: ${email}`);

        // Send welcome email
        if (sendEmail && app.emailService) {
          void app.emailService.sendWelcomeImport(email, { userName: name, source });
        }
      } catch (err) {
        results.errors++;
        results.details.push(`Error: ${email} — ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    return results;
  });
}
