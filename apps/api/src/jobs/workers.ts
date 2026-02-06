import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { randomInt } from 'node:crypto';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let connection: IORedis | null = null;

function getConnection() {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times: number) {
        return Math.min(times * 500, 5000);
      },
    });
  }
  return connection;
}

let raffleDrawQueue: Queue | null = null;
let notificationQueue: Queue | null = null;

function getRaffleDrawQueue() {
  if (!raffleDrawQueue) {
    raffleDrawQueue = new Queue('raffle-draw', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return raffleDrawQueue;
}

function getNotificationQueue() {
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', {
      connection: getConnection(),
    });
  }
  return notificationQueue;
}

export async function scheduleRaffleDraw(poolId: string, drawTime: Date) {
  const delay = Math.max(0, drawTime.getTime() - Date.now());
  await getRaffleDrawQueue().add('draw', { poolId }, { delay, jobId: `draw-${poolId}` });
}

export async function initWorkers() {
  try {
    const conn = getConnection();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
      if (conn.status === 'ready') {
        clearTimeout(timeout);
        resolve();
        return;
      }
      conn.once('ready', () => { clearTimeout(timeout); resolve(); });
      conn.once('error', (err) => { clearTimeout(timeout); reject(err); });
    });
  } catch (err) {
    console.warn('[Workers] Redis not available, workers disabled:', (err as Error).message);
    return;
  }

  const prisma = new PrismaClient();

  new Worker(
    'raffle-draw',
    async (job) => {
      const { poolId } = job.data;
      console.log(`[RaffleDraw] Starting draw for pool ${poolId}`);

      await prisma.$transaction(async (tx: any) => {
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

          await getNotificationQueue().add('winner', {
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
