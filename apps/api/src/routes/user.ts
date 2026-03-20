import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { UuidParamSchema } from '@miraculturee/shared';
import { z } from 'zod';

const NotificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  read: z.enum(['true', 'false']).optional(),
});

const TransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function userRoutes(app: FastifyInstance) {
  // All user routes require authentication
  app.addHook('preHandler', app.authenticate);

  // --- Profile ---

  app.put('/profile', async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
      city: z.string().max(100).optional(),
    }).parse(req.body);

    if (Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    // If changing email, check it's not taken
    if (body.email && body.email !== req.user.email) {
      const existing = await app.prisma.user.findUnique({ where: { email: body.email } });
      if (existing) return reply.code(409).send({ error: 'Email already in use' });
    }

    const updated = await app.prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email, emailVerified: false }),
        ...(body.city !== undefined && { city: body.city }),
      },
      select: { id: true, email: true, name: true, city: true, emailVerified: true },
    });

    // If email changed, send new verification email
    if (body.email && body.email !== req.user.email && app.emailService) {
      const { AuthService } = await import('../services/auth.service.js');
      const authService = new AuthService(app.prisma, app);
      void authService.sendVerificationEmail(updated.id);
    }

    return updated;
  });

  app.put('/password', async (req, reply) => {
    const body = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8).max(128),
    }).parse(req.body);

    const { compare, hash } = await import('bcrypt');
    const user = await app.prisma.user.findUnique({ where: { id: req.user.id }, select: { passwordHash: true } });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const valid = await compare(body.currentPassword, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: 'Current password is incorrect' });

    const passwordHash = await hash(body.newPassword, 10);
    await app.prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

    return { success: true, message: 'Password updated' };
  });

  // --- Dashboard ---

  app.get('/dashboard', async (req) => {
    const userId = req.user.id;

    const [
      raffleEntryCount,
      raffleWins,
      directTicketCount,
      supportTicketCount,
      totalSupportedCents,
      upcomingDirectTickets,
      upcomingPoolTickets,
    ] = await Promise.all([
      app.prisma.raffleEntry.count({ where: { userId } }),
      app.prisma.raffleEntry.count({ where: { userId, won: true } }),
      app.prisma.directTicket.count({ where: { ownerId: userId } }),
      app.prisma.supportTicket.count({ where: { userId } }),
      app.prisma.supportTicket.aggregate({
        where: { userId, confirmed: true },
        _sum: { totalAmountCents: true },
      }),
      app.prisma.directTicket.findMany({
        where: { ownerId: userId, status: { in: ['PENDING', 'CONFIRMED'] } },
        include: { event: { select: { id: true, title: true, date: true, venueName: true, venueCity: true } } },
        orderBy: { event: { date: 'asc' } },
        take: 10,
      }),
      app.prisma.poolTicket.findMany({
        where: { assignedUserId: userId, status: { in: ['ASSIGNED', 'REDEEMED'] } },
        include: { event: { select: { id: true, title: true, date: true, venueName: true, venueCity: true } } },
        orderBy: { event: { date: 'asc' } },
        take: 10,
      }),
    ]);

    return {
      stats: {
        totalRaffleEntries: raffleEntryCount,
        raffleWins,
        ticketsOwned: directTicketCount + raffleWins,
        totalSupportedCents: totalSupportedCents._sum.totalAmountCents ?? 0,
        supportPurchases: supportTicketCount,
      },
      upcomingTickets: [
        ...upcomingDirectTickets.map((t) => ({
          id: t.id,
          eventId: t.event.id,
          eventTitle: t.event.title,
          eventDate: t.event.date,
          venueName: t.event.venueName,
          venueCity: t.event.venueCity,
          type: 'direct' as const,
          status: t.status,
        })),
        ...upcomingPoolTickets.map((t) => ({
          id: t.id,
          eventId: t.event.id,
          eventTitle: t.event.title,
          eventDate: t.event.date,
          venueName: t.event.venueName,
          venueCity: t.event.venueCity,
          type: 'raffle' as const,
          status: t.status,
        })),
      ].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()),
    };
  });

  // --- Fan Impact Score ---

  app.get('/impact', async (req) => {
    const userId = req.user.id;

    const [
      raffleEntryCount,
      raffleWinCount,
      directTicketCount,
      supportTicketCount,
      totalSupportedAgg,
      uniqueArtistsSupported,
      accountCreated,
    ] = await Promise.all([
      app.prisma.raffleEntry.count({ where: { userId } }),
      app.prisma.raffleEntry.count({ where: { userId, won: true } }),
      app.prisma.directTicket.count({ where: { ownerId: userId } }),
      app.prisma.supportTicket.count({ where: { userId, confirmed: true } }),
      app.prisma.supportTicket.aggregate({
        where: { userId, confirmed: true },
        _sum: { totalAmountCents: true },
      }),
      app.prisma.supportTicket.findMany({
        where: { userId, confirmed: true },
        select: { event: { select: { artistId: true } } },
        distinct: ['eventId'],
      }),
      app.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    ]);

    const uniqueArtists = new Set(uniqueArtistsSupported.map((s) => s.event.artistId)).size;
    const totalSupportedCents = totalSupportedAgg._sum.totalAmountCents ?? 0;
    const daysSinceJoin = accountCreated
      ? Math.floor((Date.now() - new Date(accountCreated.createdAt).getTime()) / 86400000)
      : 0;

    // Score calculation
    const score =
      supportTicketCount * 20 +       // 20 pts per show supported
      uniqueArtists * 20 +             // 20 pts per unique artist
      raffleEntryCount * 3 +           // 3 pts per raffle entry
      raffleWinCount * 100 +           // 100 pts per raffle win
      directTicketCount * 30 +         // 30 pts per ticket purchased
      Math.floor(totalSupportedCents / 100) + // 1 pt per dollar supported
      Math.min(daysSinceJoin, 365);    // Up to 365 pts for account age

    // Tier determination
    type Tier = { name: string; min: number; label: string };
    const tiers: Tier[] = [
      { name: 'LEGEND', min: 2500, label: 'Legend' },
      { name: 'HEADLINER', min: 1000, label: 'Headliner' },
      { name: 'VIP', min: 500, label: 'VIP' },
      { name: 'FRONT_ROW', min: 200, label: 'Front Row' },
      { name: 'OPENING_ACT', min: 0, label: 'Opening Act' },
    ];
    const tier = tiers.find((t) => score >= t.min) ?? tiers[tiers.length - 1];
    const nextTier = tiers[tiers.indexOf(tier) - 1] ?? null;

    return {
      score,
      tier: tier.name,
      tierLabel: tier.label,
      nextTier: nextTier ? { name: nextTier.name, label: nextTier.label, min: nextTier.min } : null,
      breakdown: {
        showsSupported: supportTicketCount,
        uniqueArtists,
        raffleEntries: raffleEntryCount,
        raffleWins: raffleWinCount,
        ticketsPurchased: directTicketCount,
        totalSupportedCents,
        accountAgeDays: daysSinceJoin,
      },
    };
  });

  // --- Supported Campaigns ---

  app.get('/supported-campaigns', async (req) => {
    const userId = req.user.id;

    // Find events the user has supported
    const supportTickets = await app.prisma.supportTicket.findMany({
      where: { userId, confirmed: true },
      select: {
        id: true,
        totalAmountCents: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            venueName: true,
            venueCity: true,
            campaigns: {
              where: { status: { not: 'DRAFT' } },
              select: {
                id: true,
                headline: true,
                status: true,
                goalCents: true,
                fundedCents: true,
                goalReached: true,
                bonusCents: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return supportTickets.map((st) => ({
      supportId: st.id,
      amountCents: st.totalAmountCents,
      supportedAt: st.createdAt,
      event: {
        id: st.event.id,
        title: st.event.title,
        date: st.event.date,
        venueName: st.event.venueName,
        venueCity: st.event.venueCity,
      },
      campaign: st.event.campaigns[0] ?? null,
    }));
  });

  // --- Activity Feed ---

  app.get('/activity-feed', async (req) => {
    const userId = req.user.id;

    // Gather recent actions from multiple sources
    const [supports, raffleEntries, directTickets] = await Promise.all([
      app.prisma.supportTicket.findMany({
        where: { userId, confirmed: true },
        select: {
          id: true,
          totalAmountCents: true,
          createdAt: true,
          event: { select: { id: true, title: true, artist: { select: { stageName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      app.prisma.raffleEntry.findMany({
        where: { userId },
        select: {
          id: true,
          won: true,
          createdAt: true,
          pool: {
            select: {
              tierCents: true,
              status: true,
              event: { select: { id: true, title: true, artist: { select: { stageName: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      app.prisma.directTicket.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          priceCents: true,
          status: true,
          createdAt: true,
          event: { select: { id: true, title: true, artist: { select: { stageName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    type FeedItem = {
      id: string;
      type: 'support' | 'raffle_entry' | 'raffle_win' | 'ticket_purchase';
      message: string;
      eventId: string;
      eventTitle: string;
      artistName: string;
      amountCents: number | null;
      createdAt: Date;
    };

    const items: FeedItem[] = [];

    for (const s of supports) {
      items.push({
        id: `support-${s.id}`,
        type: 'support',
        message: `You supported ${s.event.artist.stageName} with $${(s.totalAmountCents / 100).toFixed(2)}`,
        eventId: s.event.id,
        eventTitle: s.event.title,
        artistName: s.event.artist.stageName,
        amountCents: s.totalAmountCents,
        createdAt: s.createdAt,
      });
    }

    for (const r of raffleEntries) {
      if (r.won) {
        items.push({
          id: `raffle-win-${r.id}`,
          type: 'raffle_win',
          message: `You won a raffle for ${r.pool.event.title}!`,
          eventId: r.pool.event.id,
          eventTitle: r.pool.event.title,
          artistName: r.pool.event.artist.stageName,
          amountCents: null,
          createdAt: r.createdAt,
        });
      } else {
        items.push({
          id: `raffle-${r.id}`,
          type: 'raffle_entry',
          message: `You entered the raffle for ${r.pool.event.title}`,
          eventId: r.pool.event.id,
          eventTitle: r.pool.event.title,
          artistName: r.pool.event.artist.stageName,
          amountCents: r.pool.tierCents,
          createdAt: r.createdAt,
        });
      }
    }

    for (const t of directTickets) {
      items.push({
        id: `ticket-${t.id}`,
        type: 'ticket_purchase',
        message: `You purchased a ticket for ${t.event.title}`,
        eventId: t.event.id,
        eventTitle: t.event.title,
        artistName: t.event.artist.stageName,
        amountCents: t.priceCents,
        createdAt: t.createdAt,
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return items.slice(0, 20);
  });

  // --- Artist Relationships ---

  app.get('/artist-relationships', async (req) => {
    const userId = req.user.id;

    // Get all support tickets grouped by event → artist
    const supportTickets = await app.prisma.supportTicket.findMany({
      where: { userId, confirmed: true },
      select: {
        totalAmountCents: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            artistId: true,
            artist: { select: { id: true, stageName: true, genre: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also get direct tickets for these artists
    const directTickets = await app.prisma.directTicket.findMany({
      where: { ownerId: userId, status: { not: 'REFUNDED' } },
      select: {
        priceCents: true,
        createdAt: true,
        event: {
          select: {
            artistId: true,
            artist: { select: { id: true, stageName: true, genre: true } },
          },
        },
      },
    });

    // Aggregate by artist
    const artistMap = new Map<string, {
      artistId: string;
      stageName: string;
      genre: string | null;
      supportCount: number;
      ticketCount: number;
      totalSupportedCents: number;
      totalTicketCents: number;
      eventIds: Set<string>;
      firstSupport: Date;
      lastSupport: Date;
    }>();

    for (const st of supportTickets) {
      const artist = st.event.artist;
      const existing = artistMap.get(artist.id);
      if (existing) {
        existing.supportCount++;
        existing.totalSupportedCents += st.totalAmountCents;
        existing.eventIds.add(st.event.id);
        if (st.createdAt < existing.firstSupport) existing.firstSupport = st.createdAt;
        if (st.createdAt > existing.lastSupport) existing.lastSupport = st.createdAt;
      } else {
        artistMap.set(artist.id, {
          artistId: artist.id,
          stageName: artist.stageName,
          genre: artist.genre,
          supportCount: 1,
          ticketCount: 0,
          totalSupportedCents: st.totalAmountCents,
          totalTicketCents: 0,
          eventIds: new Set([st.event.id]),
          firstSupport: st.createdAt,
          lastSupport: st.createdAt,
        });
      }
    }

    for (const dt of directTickets) {
      const artist = dt.event.artist;
      const existing = artistMap.get(artist.id);
      if (existing) {
        existing.ticketCount++;
        existing.totalTicketCents += dt.priceCents;
      } else {
        artistMap.set(artist.id, {
          artistId: artist.id,
          stageName: artist.stageName,
          genre: artist.genre,
          supportCount: 0,
          ticketCount: 1,
          totalSupportedCents: 0,
          totalTicketCents: dt.priceCents,
          eventIds: new Set(),
          firstSupport: dt.createdAt,
          lastSupport: dt.createdAt,
        });
      }
    }

    // Fan level: Bronze(1), Silver(3+), Gold(5+), Platinum(10+)
    const getLevelInfo = (count: number) => {
      if (count >= 10) return { level: 'PLATINUM', label: 'Platinum Fan' };
      if (count >= 5) return { level: 'GOLD', label: 'Gold Fan' };
      if (count >= 3) return { level: 'SILVER', label: 'Silver Fan' };
      return { level: 'BRONZE', label: 'Bronze Fan' };
    };

    return Array.from(artistMap.values())
      .map((a) => {
        const totalInteractions = a.supportCount + a.ticketCount;
        const level = getLevelInfo(totalInteractions);
        return {
          artistId: a.artistId,
          stageName: a.stageName,
          genre: a.genre,
          supportCount: a.supportCount,
          ticketCount: a.ticketCount,
          totalSupportedCents: a.totalSupportedCents,
          totalTicketCents: a.totalTicketCents,
          totalInteractions,
          uniqueEvents: a.eventIds.size,
          fanLevel: level.level,
          fanLevelLabel: level.label,
          firstSupport: a.firstSupport,
          lastSupport: a.lastSupport,
        };
      })
      .sort((a, b) => b.totalInteractions - a.totalInteractions);
  });

  // --- Notifications ---

  app.get('/notifications', async (req) => {
    const userId = req.user.id;
    const { page, limit, read } = NotificationQuerySchema.parse(req.query);

    const where: Prisma.NotificationWhereInput = { userId };
    if (read === 'true') where.read = true;
    if (read === 'false') where.read = false;

    const [data, total] = await Promise.all([
      app.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  });

  app.put('/notifications/:id/read', async (req) => {
    const { id } = UuidParamSchema.parse(req.params);
    const userId = req.user.id;

    const notification = await app.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
    }

    await app.prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return { success: true };
  });

  app.put('/notifications/read-all', async (req) => {
    const userId = req.user.id;

    await app.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { success: true };
  });

  // --- Transactions ---

  app.get('/transactions', async (req) => {
    const userId = req.user.id;
    const { page, limit } = TransactionQuerySchema.parse(req.query);

    const [data, total] = await Promise.all([
      app.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          amountCents: true,
          currency: true,
          status: true,
          metadata: true,
          createdAt: true,
        },
      }),
      app.prisma.transaction.count({ where: { userId } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  });
}
