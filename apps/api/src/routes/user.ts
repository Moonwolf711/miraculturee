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
