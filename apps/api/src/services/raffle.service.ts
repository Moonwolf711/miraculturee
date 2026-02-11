import { randomBytes, createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
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

  /**
   * Close the pool and publish the seed hash (cryptographic commitment)
   * This must be called BEFORE the draw to ensure fairness
   */
  async closePool(poolId: string): Promise<void> {
    const pool = await this.prisma.rafflePool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw Object.assign(new Error('Pool not found'), { statusCode: 404 });
    }

    if (pool.status !== 'OPEN') {
      throw Object.assign(new Error('Pool is not open'), { statusCode: 400 });
    }

    // Generate cryptographic seed
    const seed = randomBytes(32).toString('hex');
    const seedHash = createHash('sha256').update(seed).digest('hex');

    // Store seed securely (in production, consider encrypting this)
    // For now, we'll store it in the database but it should remain secret until reveal
    await this.prisma.rafflePool.update({
      where: { id: poolId },
      data: {
        seedHash, // Public commitment
        revealedSeed: seed, // Will be revealed after draw
        status: 'DRAWING', // Close the pool
      },
    });

    // Emit event that seed hash is published
    this.io.to(`event:${pool.eventId}`).emit('pool:closed', {
      poolId,
      seedHash,
      message: 'Raffle entries closed. Seed hash published for verification.',
    });
  }

  async draw(poolId: string): Promise<DrawResult> {
    return this.prisma.$transaction(async (tx) => {
      // Get the pool with seed
      const pool = await tx.rafflePool.findUnique({
        where: { id: poolId },
        include: { event: true },
      });

      if (!pool) {
        throw Object.assign(new Error('Pool not found'), { statusCode: 404 });
      }

      if (pool.status !== 'DRAWING') {
        throw Object.assign(
          new Error('Pool must be closed before drawing'),
          { statusCode: 400 }
        );
      }

      if (!pool.seedHash || !pool.revealedSeed) {
        throw Object.assign(
          new Error('Seed not generated. Close pool first.'),
          { statusCode: 500 }
        );
      }

      // Get available tickets and entries
      const availableTickets = await tx.poolTicket.findMany({
        where: { eventId: pool.eventId, status: 'AVAILABLE' },
      });

      const entries = await tx.raffleEntry.findMany({
        where: { poolId, won: false },
        include: { user: { select: { id: true, name: true } } },
      });

      if (entries.length === 0 || availableTickets.length === 0) {
        await tx.rafflePool.update({
          where: { id: poolId },
          data: { status: 'COMPLETED', drawnAt: new Date() },
        });
        return { poolId, winners: [], totalDrawn: 0 };
      }

      // Use deterministic RNG with the revealed seed for provably fair shuffle
      const rng = seedrandom(pool.revealedSeed);

      // Fisher-Yates shuffle with deterministic RNG
      const shuffled = [...entries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Assign tickets to winners (min of tickets and entries)
      const winnerCount = Math.min(shuffled.length, availableTickets.length);
      const winners: { userId: string; ticketId: string; position: number }[] = [];

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

        winners.push({
          userId: entry.userId,
          ticketId: ticket.id,
          position: i + 1,
        });

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

      // Mark pool as completed and reveal seed
      await tx.rafflePool.update({
        where: { id: poolId },
        data: {
          status: 'COMPLETED',
          drawnAt: new Date(),
          // revealedSeed is already stored, now it's public
        },
      });

      // Generate verification receipt
      const receipt = {
        draw_id: `mc-${pool.event.date.toISOString().split('T')[0]}-${pool.event.venueCity.replace(/\s+/g, '-')}`,
        event: pool.event.title,
        venue: pool.event.venueName,
        city: pool.event.venueCity,
        seed_hash: pool.seedHash,
        algorithm: pool.algorithm,
        entries: entries.length,
        winners: winnerCount,
        revealed_seed: pool.revealedSeed,
        timestamp: new Date().toISOString(),
        status: 'VERIFIED',
        winner_list: winners.map((w) => ({
          position: w.position,
          userId: w.userId,
          ticketId: w.ticketId,
        })),
      };

      // Store verification URL (in production, save receipt to S3 or file storage)
      const verificationUrl = `/api/raffle/${poolId}/verify`;
      await tx.rafflePool.update({
        where: { id: poolId },
        data: { verificationUrl },
      });

      // Emit real-time draw results with verification info
      this.io.to(`event:${pool.eventId}`).emit('draw:complete', {
        poolId,
        winnerCount,
        totalEntries: entries.length,
        seedHash: pool.seedHash,
        revealedSeed: pool.revealedSeed,
        verificationUrl,
        message: 'Draw complete. Results are publicly verifiable.',
      });

      return { poolId, winners, totalDrawn: winnerCount };
    }, { isolationLevel: 'Serializable' });
  }

  /**
   * Verify the fairness of a completed draw
   * Anyone can call this to independently verify the results
   */
  async verifyDraw(poolId: string): Promise<{
    verified: boolean;
    poolId: string;
    event: string;
    seedHash: string;
    revealedSeed: string;
    hashValid: boolean;
    resultsValid: boolean;
    algorithm: string;
    totalEntries: number;
    totalWinners: number;
    drawnAt: string | null;
    receipt: any;
  }> {
    const pool = await this.prisma.rafflePool.findUnique({
      where: { id: poolId },
      include: {
        event: { select: { title: true, venueName: true, venueCity: true, date: true } },
        entries: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!pool) {
      throw Object.assign(new Error('Pool not found'), { statusCode: 404 });
    }

    if (pool.status !== 'COMPLETED') {
      throw Object.assign(
        new Error('Draw not yet completed'),
        { statusCode: 400 }
      );
    }

    if (!pool.revealedSeed || !pool.seedHash) {
      throw Object.assign(
        new Error('Seed not revealed'),
        { statusCode: 500 }
      );
    }

    // Verify hash matches revealed seed
    const computedHash = createHash('sha256')
      .update(pool.revealedSeed)
      .digest('hex');

    const hashValid = computedHash === pool.seedHash;

    // Re-run draw algorithm to verify results
    const rng = seedrandom(pool.revealedSeed);
    const entries = pool.entries;
    const shuffled = [...entries];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const actualWinners = pool.entries.filter((e) => e.won);
    const expectedWinners = shuffled.slice(0, actualWinners.length);

    // Verify winners match expected results
    const resultsValid = expectedWinners.every(
      (e, i) => e.id === actualWinners[i]?.id
    );

    // Generate verification receipt
    const receipt = {
      draw_id: `mc-${pool.event.date.toISOString().split('T')[0]}-${pool.event.venueCity.replace(/\s+/g, '-')}`,
      event: pool.event.title,
      venue: pool.event.venueName,
      city: pool.event.venueCity,
      seed_hash: pool.seedHash,
      algorithm: pool.algorithm,
      entries: entries.length,
      winners: actualWinners.length,
      revealed_seed: pool.revealedSeed,
      timestamp: pool.drawnAt?.toISOString() || new Date().toISOString(),
      status: hashValid && resultsValid ? 'VERIFIED' : 'FAILED',
      hash_verification: hashValid ? 'PASSED' : 'FAILED',
      results_verification: resultsValid ? 'PASSED' : 'FAILED',
      winner_list: actualWinners.map((w, i) => ({
        position: i + 1,
        userId: w.userId,
        userName: w.user.name,
        ticketId: w.ticketId,
      })),
    };

    return {
      verified: hashValid && resultsValid,
      poolId: pool.id,
      event: pool.event.title,
      seedHash: pool.seedHash,
      revealedSeed: pool.revealedSeed,
      hashValid,
      resultsValid,
      algorithm: pool.algorithm,
      totalEntries: entries.length,
      totalWinners: actualWinners.length,
      drawnAt: pool.drawnAt?.toISOString() || null,
      receipt,
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
      seedHash: pool.seedHash,
      revealedSeed: pool.status === 'COMPLETED' ? pool.revealedSeed : null,
      verificationUrl: pool.verificationUrl,
      winners: pool.entries.map((e) => ({
        userId: e.userId,
        name: e.user.name,
        ticketId: e.ticketId,
      })),
    };
  }
}
