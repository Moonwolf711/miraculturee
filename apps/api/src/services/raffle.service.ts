import { randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';
import type { Server } from 'socket.io';
import { isWithinRadius } from '@miraculturee/shared';
import type { RaffleEntryResult, DrawResult } from '@miraculturee/shared';

export class RaffleService {
  constructor(
    private prisma: PrismaClient,
    private pos: POSClient,
    private io: Server,
  ) {}

  async enter(
    userId: string,
    poolId: string,
    userLat: number,
    userLng: number,
  ): Promise<RaffleEntryResult> {
    const pool = await this.prisma.rafflePool.findUnique({
      where: { id: poolId },
      include: { event: true },
    });

    if (!pool) {
      throw Object.assign(new Error('Raffle pool not found'), { statusCode: 404 });
    }
    if (pool.status !== 'OPEN') {
      throw Object.assign(new Error('Raffle pool is not open'), { statusCode: 400 });
    }

    // Geo validation
    if (!isWithinRadius(userLat, userLng, pool.event.venueLat, pool.event.venueLng, pool.event.localRadiusKm)) {
      throw Object.assign(
        new Error('You must be within the local radius to enter this raffle'),
        { statusCode: 403 },
      );
    }

    // Check for duplicate entry
    const existing = await this.prisma.raffleEntry.findUnique({
      where: { poolId_userId: { poolId, userId } },
    });
    if (existing) {
      throw Object.assign(new Error('Already entered this raffle'), { statusCode: 409 });
    }

    // Process entry fee via POS
    const payment = await this.pos.createPayment({
      amountCents: pool.tierCents,
      currency: 'usd',
      metadata: {
        type: 'raffle_entry',
        poolId,
        userId,
        eventId: pool.eventId,
      },
    });

    // Create raffle entry
    const entry = await this.prisma.raffleEntry.create({
      data: { poolId, userId },
    });

    // Create transaction
    await this.prisma.transaction.create({
      data: {
        userId,
        type: 'RAFFLE_ENTRY',
        amountCents: pool.tierCents,
        stripePaymentId: payment.id,
        posReference: entry.id,
        status: 'pending',
      },
    });

    return {
      id: entry.id,
      poolId,
      status: 'ENTERED',
      clientSecret: payment.clientSecret,
    };
  }

  async draw(poolId: string): Promise<DrawResult> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the pool
      const pool = await tx.rafflePool.update({
        where: { id: poolId },
        data: { status: 'DRAWING' },
      });

      // Get available tickets and entries
      const availableTickets = await tx.poolTicket.findMany({
        where: { eventId: pool.eventId, status: 'AVAILABLE' },
      });

      const entries = await tx.raffleEntry.findMany({
        where: { poolId, won: false },
      });

      if (entries.length === 0 || availableTickets.length === 0) {
        await tx.rafflePool.update({
          where: { id: poolId },
          data: { status: 'COMPLETED', drawnAt: new Date() },
        });
        return { poolId, winners: [], totalDrawn: 0 };
      }

      // Fisher-Yates shuffle with crypto.randomInt for fairness
      const shuffled = [...entries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Assign tickets to winners (min of tickets and entries)
      const winnerCount = Math.min(shuffled.length, availableTickets.length);
      const winners: { userId: string; ticketId: string }[] = [];

      for (let i = 0; i < winnerCount; i++) {
        const entry = shuffled[i];
        const ticket = availableTickets[i];

        await tx.raffleEntry.update({
          where: { id: entry.id },
          data: { won: true, ticketId: ticket.id },
        });

        await tx.poolTicket.update({
          where: { id: ticket.id },
          data: { status: 'ASSIGNED', assignedUserId: entry.userId },
        });

        winners.push({ userId: entry.userId, ticketId: ticket.id });

        // Create notification
        await tx.notification.create({
          data: {
            userId: entry.userId,
            title: 'You won a ticket!',
            body: `Congratulations! You won a ticket in the raffle draw.`,
            metadata: { poolId, ticketId: ticket.id, eventId: pool.eventId },
          },
        });
      }

      await tx.rafflePool.update({
        where: { id: poolId },
        data: { status: 'COMPLETED', drawnAt: new Date() },
      });

      // Emit real-time draw results
      this.io.to(`event:${pool.eventId}`).emit('draw:complete', {
        poolId,
        winnerCount,
        totalEntries: entries.length,
      });

      return { poolId, winners, totalDrawn: winnerCount };
    }, { isolationLevel: 'Serializable' });
  }

  async getPoolsByEvent(eventId: string) {
    return this.prisma.rafflePool.findMany({
      where: { eventId },
      include: {
        entries: { select: { id: true, userId: true, won: true } },
      },
    });
  }

  async getResults(poolId: string) {
    const pool = await this.prisma.rafflePool.findUnique({
      where: { id: poolId },
      include: {
        entries: {
          where: { won: true },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!pool) {
      throw Object.assign(new Error('Pool not found'), { statusCode: 404 });
    }

    return {
      poolId: pool.id,
      status: pool.status,
      drawnAt: pool.drawnAt?.toISOString() ?? null,
      winners: pool.entries.map((e) => ({
        userId: e.userId,
        name: e.user.name,
        ticketId: e.ticketId,
      })),
    };
  }
}
