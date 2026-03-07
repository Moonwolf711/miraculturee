import { randomBytes, createHash } from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { POSClient } from '@miraculturee/pos';
import type { Server } from 'socket.io';
import { isWithinRadius } from '@miraculturee/shared';
import type { RaffleEntryResult, DrawResult } from '@miraculturee/shared';
import seedrandom from 'seedrandom';

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

    // Check for duplicate entry today (one entry per user per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await this.prisma.raffleEntry.findUnique({
      where: { poolId_userId_entryDate: { poolId, userId, entryDate: today } },
    });
    if (existing) {
      throw Object.assign(new Error('Already entered this raffle today. Come back tomorrow!'), { statusCode: 409 });
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

    // Create raffle entry with today's date
    const entryDate = new Date();
    entryDate.setHours(0, 0, 0, 0);
    const entry = await this.prisma.raffleEntry.create({
      data: { poolId, userId, entryDate },
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

  /**
   * Close pool and publish seed hash (commitment phase).
   * Must be called before draw() — the hash is published so entrants can later verify fairness.
   */
  async closePool(poolId: string): Promise<void> {
    const pool = await this.prisma.rafflePool.findUnique({ where: { id: poolId } });
    if (!pool) throw Object.assign(new Error('Pool not found'), { statusCode: 404 });
    if (pool.status !== 'OPEN') throw Object.assign(new Error('Pool is not open'), { statusCode: 400 });

    // Generate random seed and compute its SHA-256 hash
    const seed = randomBytes(32).toString('hex');
    const seedHash = createHash('sha256').update(seed).digest('hex');

    // Store the hash publicly; keep the seed secret until draw
    await this.prisma.rafflePool.update({
      where: { id: poolId },
      data: { status: 'DRAWING', seedHash },
    });

    // Stash the seed temporarily so draw() can reveal it
    // We store it in revealedSeed now but it only becomes meaningful after draw
    await this.prisma.rafflePool.update({
      where: { id: poolId },
      data: { revealedSeed: seed },
    });
  }

  async draw(poolId: string): Promise<DrawResult> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pool = await tx.rafflePool.findUnique({ where: { id: poolId } });
      if (!pool) throw Object.assign(new Error('Pool not found'), { statusCode: 404 });

      // If pool wasn't pre-closed, generate seed now
      let seed = pool.revealedSeed;
      if (!seed) {
        seed = randomBytes(32).toString('hex');
        const seedHash = createHash('sha256').update(seed).digest('hex');
        await tx.rafflePool.update({
          where: { id: poolId },
          data: { seedHash },
        });
      }

      await tx.rafflePool.update({
        where: { id: poolId },
        data: { status: 'DRAWING' },
      });

      const availableTickets = await tx.poolTicket.findMany({
        where: { eventId: pool.eventId, status: 'AVAILABLE' },
      });

      const entries = await tx.raffleEntry.findMany({
        where: { poolId, won: false },
        orderBy: { createdAt: 'asc' },
      });

      if (entries.length === 0 || availableTickets.length === 0) {
        await tx.rafflePool.update({
          where: { id: poolId },
          data: { status: 'COMPLETED', drawnAt: new Date(), revealedSeed: seed },
        });
        return { poolId, winners: [], totalDrawn: 0 };
      }

      // Count unique entrants (a user with multiple daily entries counts as 1)
      const uniqueUserIds = [...new Set(entries.map((e) => e.userId))];
      const isAutoWin = uniqueUserIds.length <= 10;

      let winners: { userId: string; ticketId: string }[] = [];
      const winnerEntryIds: string[] = [];
      const notifications: { userId: string; title: string; body: string; metadata: any }[] = [];

      if (isAutoWin) {
        // <= 10 unique entrants: EVERYONE gets a ticket (no draw needed)
        const winnerCount = Math.min(uniqueUserIds.length, availableTickets.length);

        for (let i = 0; i < winnerCount; i++) {
          const userId = uniqueUserIds[i];
          const ticket = availableTickets[i];
          // Pick first entry for this user to mark as winner
          const userEntry = entries.find((e) => e.userId === userId)!;
          winnerEntryIds.push(userEntry.id);
          winners.push({ userId, ticketId: ticket.id });
          notifications.push({
            userId,
            title: 'You got a ticket!',
            body: 'Everyone who entered the raffle got a ticket — enjoy the show!',
            metadata: { poolId, ticketId: ticket.id, eventId: pool.eventId, autoWin: true },
          });
        }
      } else {
        // > 10 unique entrants: cryptographic draw (each entry = one chance)
        const rng = seedrandom(seed);
        const shuffled = [...entries];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Pick winners, but only one ticket per unique user
        const wonUsers = new Set<string>();
        let ticketIdx = 0;

        for (const entry of shuffled) {
          if (ticketIdx >= availableTickets.length) break;
          if (wonUsers.has(entry.userId)) continue;
          wonUsers.add(entry.userId);

          const ticket = availableTickets[ticketIdx++];
          winnerEntryIds.push(entry.id);
          winners.push({ userId: entry.userId, ticketId: ticket.id });
          notifications.push({
            userId: entry.userId,
            title: 'You won a ticket!',
            body: 'Congratulations! You won a ticket in the raffle draw.',
            metadata: { poolId, ticketId: ticket.id, eventId: pool.eventId },
          });
        }
      }

      // Batch: mark all winning entries at once
      if (winnerEntryIds.length > 0) {
        await tx.raffleEntry.updateMany({
          where: { id: { in: winnerEntryIds } },
          data: { won: true },
        });
      }

      // Individual ticketId assignment (updateMany can't set per-row values)
      await Promise.all(
        winners.map((w, i) =>
          tx.raffleEntry.update({
            where: { id: winnerEntryIds[i] },
            data: { ticketId: w.ticketId },
          }),
        ),
      );

      // Batch: assign all pool tickets at once per-winner
      await Promise.all(
        winners.map((w) =>
          tx.poolTicket.update({
            where: { id: w.ticketId },
            data: { status: 'ASSIGNED', assignedUserId: w.userId },
          }),
        ),
      );

      // Batch: create all notifications at once
      if (notifications.length > 0) {
        await tx.notification.createMany({
          data: notifications,
        });
      }

      // Reveal the seed and mark as completed
      await tx.rafflePool.update({
        where: { id: poolId },
        data: { status: 'COMPLETED', drawnAt: new Date(), revealedSeed: seed },
      });

      this.io.to(`event:${pool.eventId}`).emit('draw:complete', {
        poolId,
        winnerCount: winners.length,
        totalEntries: entries.length,
        totalUniqueEntrants: uniqueUserIds.length,
        autoWin: isAutoWin,
      });

      return { poolId, winners, totalDrawn: winners.length };
    }, { isolationLevel: 'Serializable' });
  }

  /**
   * Verify draw fairness — anyone can re-run the shuffle with the revealed seed
   * and confirm the winners match.
   */
  async verifyDraw(poolId: string) {
    const pool = await this.prisma.rafflePool.findUnique({
      where: { id: poolId },
      include: {
        entries: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!pool) throw Object.assign(new Error('Pool not found'), { statusCode: 404 });
    if (pool.status !== 'COMPLETED') {
      throw Object.assign(new Error('Draw has not been completed yet'), { statusCode: 400 });
    }
    if (!pool.revealedSeed || !pool.seedHash) {
      throw Object.assign(new Error('Verification data not available'), { statusCode: 400 });
    }

    // Verify seed matches the pre-committed hash
    const computedHash = createHash('sha256').update(pool.revealedSeed).digest('hex');
    const hashMatches = computedHash === pool.seedHash;

    // Re-run the deterministic shuffle
    const rng = seedrandom(pool.revealedSeed);
    const shuffled = [...pool.entries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const actualWinners = pool.entries.filter((e) => e.won).map((e) => e.id).sort();
    const computedWinnerIds = shuffled
      .slice(0, actualWinners.length)
      .map((e) => e.id)
      .sort();

    const winnersMatch = JSON.stringify(actualWinners) === JSON.stringify(computedWinnerIds);

    return {
      poolId,
      algorithm: pool.algorithm,
      seedHash: pool.seedHash,
      revealedSeed: pool.revealedSeed,
      hashMatches,
      winnersMatch,
      verified: hashMatches && winnersMatch,
      totalEntries: pool.entries.length,
      totalWinners: actualWinners.length,
      drawnAt: pool.drawnAt?.toISOString() ?? null,
    };
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
