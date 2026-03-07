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
