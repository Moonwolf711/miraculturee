import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { randomInt } from 'node:crypto';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let connection: IORedis | null = null;

function getConnection() {
  if (!connection) {
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

// --- Queues ---

export const raffleDrawQueue = new Queue('raffle-draw', {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const notificationQueue = new Queue('notifications', {
  connection: getConnection(),
});

// --- Schedule a raffle draw ---

export async function scheduleRaffleDraw(poolId: string, drawTime: Date) {
  const delay = Math.max(0, drawTime.getTime() - Date.now());
  await raffleDrawQueue.add('draw', { poolId }, { delay, jobId: `draw-${poolId}` });
}

// --- Workers ---

export async function initWorkers() {
  const prisma = new PrismaClient();

  // Raffle Draw Worker
  new Worker(
    'raffle-draw',
    async (job) => {
      const { poolId } = job.data;
      console.log(`[RaffleDraw] Starting draw for pool ${poolId}`);

      await prisma.$transaction(async (tx) => {
        const pool = await tx.rafflePool.update({
          where: { id: poolId, status: 'OPEN' },
          data: { status: 'DRAWING' },
        });

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
          console.log(`[RaffleDraw] No entries or tickets for pool ${poolId}`);
          return;
        }

        // Fisher-Yates with crypto.randomInt
        const shuffled = [...entries];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = randomInt(0, i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const winnerCount = Math.min(shuffled.length, availableTickets.length);

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

          // Queue notification
          await notificationQueue.add('winner', {
            userId: entry.userId,
            poolId,
            ticketId: ticket.id,
            eventId: pool.eventId,
          });
        }

        await tx.rafflePool.update({
          where: { id: poolId },
          data: { status: 'COMPLETED', drawnAt: new Date() },
        });

        console.log(`[RaffleDraw] Drew ${winnerCount} winners for pool ${poolId}`);
      }, { isolationLevel: 'Serializable' });
    },
    { connection: getConnection(), concurrency: 1 },
  );

  // Notification Worker
  new Worker(
    'notifications',
    async (job) => {
      const { userId, poolId, ticketId, eventId } = job.data;

      await prisma.notification.create({
        data: {
          userId,
          title: 'You won a ticket!',
          body: 'Congratulations! You were selected in the raffle draw.',
          metadata: { poolId, ticketId, eventId },
        },
      });

      console.log(`[Notification] Created winner notification for user ${userId}`);
    },
    { connection: getConnection(), concurrency: 5 },
  );

  console.log('[Workers] Raffle draw and notification workers initialized');
}
