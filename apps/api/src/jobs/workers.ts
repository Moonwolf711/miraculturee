import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { EmailService } from '../services/email.service.js';
import { EdmtrainService } from '../services/edmtrain.service.js';
import { PurchaseAgentService } from '../services/purchase-agent.service.js';
import { CampaignStateMachineService } from '../services/campaign-state-machine.service.js';
import { EDMTRAIN_SYNC_INTERVAL_MS, EVENT_CLEANUP_INTERVAL_MS, CAMPAIGN_LIFECYCLE_INTERVAL_MS } from '@miraculturee/shared';

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
let preEventQueue: Queue | null = null;
let purchaseAgentQueue: Queue | null = null;

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

function getPreEventQueue() {
  if (!preEventQueue) {
    preEventQueue = new Queue('pre-event-tickets', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return preEventQueue;
}

function getPurchaseAgentQueue() {
  if (!purchaseAgentQueue) {
    purchaseAgentQueue = new Queue('purchase-agent', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });
  }
  return purchaseAgentQueue;
}

/** Trigger the purchase agent for a specific event (called from admin route). */
export async function triggerPurchaseAgent(eventId?: string) {
  await getPurchaseAgentQueue().add(
    'acquire',
    { eventId },
    { jobId: eventId ? `acquire-${eventId}-${Date.now()}` : `acquire-cycle-${Date.now()}` },
  );
}

export async function scheduleRaffleDraw(poolId: string, drawTime: Date) {
  const delay = Math.max(0, drawTime.getTime() - Date.now());
  await getRaffleDrawQueue().add('draw', { poolId }, { delay, jobId: `draw-${poolId}` });
}

export async function schedulePreEventTicketPurchase(eventId: string, eventDate: Date) {
  const runAt = new Date(eventDate);
  runAt.setHours(runAt.getHours() - 24);
  const delay = Math.max(0, runAt.getTime() - Date.now());
  await getPreEventQueue().add(
    'buy-tickets',
    { eventId },
    { delay, jobId: `pre-event-${eventId}` },
  );
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
      console.info(`[RaffleDraw] Starting draw for pool ${poolId}`);

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
          console.info(`[RaffleDraw] No entries or tickets for pool ${poolId}`);
          return;
        }

        // Count unique entrants
        const uniqueUserIds: string[] = Array.from(new Set<string>(entries.map((e: any) => e.userId)));
        const isAutoWin = uniqueUserIds.length <= 10;

        const winnerUserIds: string[] = [];
        const winnerEntries: any[] = [];

        if (isAutoWin) {
          // <= 10 unique entrants: everyone gets a ticket
          const winnerCount = Math.min(uniqueUserIds.length, availableTickets.length);
          for (let i = 0; i < winnerCount; i++) {
            const userId = uniqueUserIds[i];
            const entry = entries.find((e: any) => e.userId === userId);
            winnerUserIds.push(userId);
            winnerEntries.push(entry);
          }
        } else {
          // > 10 unique entrants: cryptographic shuffle (each entry = one chance)
          const shuffled = [...entries];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = randomInt(0, i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          // One ticket per unique user
          const wonUsers = new Set<string>();
          for (const entry of shuffled) {
            if (winnerEntries.length >= availableTickets.length) break;
            if (wonUsers.has(entry.userId)) continue;
            wonUsers.add(entry.userId);
            winnerUserIds.push(entry.userId);
            winnerEntries.push(entry);
          }
        }

        for (let i = 0; i < winnerEntries.length; i++) {
          const entry = winnerEntries[i];
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
            autoWin: isAutoWin,
          });
        }

        // Queue loser notifications for non-winners (only when draw was used)
        if (!isAutoWin) {
          const wonSet = new Set(winnerUserIds);
          const loserUserIds = [...new Set(entries.filter((e: any) => !wonSet.has(e.userId)).map((e: any) => e.userId))];
          for (const userId of loserUserIds) {
            await getNotificationQueue().add('loser', {
              userId,
              poolId,
              eventId: pool.eventId,
            });
          }
          console.info(`[RaffleDraw] Drew ${winnerEntries.length} winners, ${loserUserIds.length} non-winners for pool ${poolId}`);
        } else {
          console.info(`[RaffleDraw] Auto-win: all ${winnerEntries.length} unique entrants get tickets for pool ${poolId}`);
        }

        await tx.rafflePool.update({
          where: { id: poolId },
          data: { status: 'COMPLETED', drawnAt: new Date() },
        });
      }, { isolationLevel: 'Serializable' });
    },
    { connection: getConnection(), concurrency: 1 },
  );

  // Initialize email service if API key is available (graceful degradation)
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailService = resendApiKey ? new EmailService(resendApiKey) : null;

  if (!emailService) {
    console.warn('[Workers] RESEND_API_KEY not set — email notifications disabled in workers');
  }

  new Worker(
    'notifications',
    async (job) => {
      if (job.name === 'winner') {
        const { userId, poolId, ticketId, eventId } = job.data;

        // Look up user and event details
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true },
        });
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { title: true, venueName: true, date: true },
        });

        if (!user || !event) {
          console.warn(`[Notification] User or event not found: userId=${userId}, eventId=${eventId}`);
          return;
        }

        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId,
            title: 'You won a ticket!',
            body: `Congratulations! You won a ticket to ${event.title} at ${event.venueName}.`,
            metadata: { poolId, ticketId, eventId },
          },
        });

        // Send winner email
        if (emailService) {
          await emailService.sendRaffleWinnerNotification(user.email, {
            userName: user.name,
            eventTitle: event.title,
            venueName: event.venueName,
            eventDate: event.date.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            ticketCount: 1,
          });
        }

        console.info(`[Notification] Winner notification sent for user ${userId}`);
      }

      if (job.name === 'loser') {
        const { userId, poolId, eventId } = job.data;

        // Look up user and event details
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true },
        });
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { title: true },
        });

        if (!user || !event) {
          console.warn(`[Notification] User or event not found: userId=${userId}, eventId=${eventId}`);
          return;
        }

        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId,
            title: 'Raffle Results',
            body: `The raffle for ${event.title} has been drawn. Unfortunately, you were not selected this time.`,
            metadata: { poolId, eventId },
          },
        });

        // Send loser email
        if (emailService) {
          await emailService.sendRaffleLoserNotification(user.email, {
            userName: user.name,
            eventTitle: event.title,
          });
        }

        console.info(`[Notification] Non-winner notification sent for user ${userId}`);
      }
    },
    { connection: getConnection(), concurrency: 5 },
  );

  // Pre-event automated ticket purchase worker
  new Worker(
    'pre-event-tickets',
    async (job) => {
      const { eventId } = job.data;
      console.info(`[PreEvent] Processing pre-event ticket purchase for event ${eventId}`);

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { artist: true },
      });
      if (!event) {
        console.warn(`[PreEvent] Event ${eventId} not found`);
        return;
      }
      if (event.ticketPriceCents === 0) {
        console.warn(`[PreEvent] Event ${eventId} has no ticket price, skipping`);
        return;
      }

      // Total confirmed donation funds
      const supportTickets = await prisma.supportTicket.findMany({
        where: { eventId, confirmed: true },
      });
      const totalDonationFunds = supportTickets.reduce(
        (sum: number, st: any) => sum + st.totalAmountCents,
        0,
      );

      // Already-allocated pool tickets
      const alreadyAllocatedTickets = await prisma.poolTicket.count({
        where: { eventId },
      });
      const fundsUsed = alreadyAllocatedTickets * event.ticketPriceCents;
      const remainingFunds = totalDonationFunds - fundsUsed;

      // Count raffle demand
      const raffleEntryCount = await prisma.raffleEntry.count({
        where: { pool: { eventId } },
      });

      // Direct tickets already sold
      const directTicketCount = await prisma.directTicket.count({
        where: { eventId, status: { in: ['CONFIRMED', 'REDEEMED'] } },
      });

      const maxFromFunds = Math.floor(remainingFunds / event.ticketPriceCents);
      const availableCapacity = event.totalTickets - alreadyAllocatedTickets - directTicketCount;
      const ticketsToBuy = Math.min(maxFromFunds, raffleEntryCount, Math.max(0, availableCapacity));

      if (ticketsToBuy > 0) {
        // Find a support ticket to link the pool tickets to
        const firstSupportTicket = supportTickets[0];
        await prisma.poolTicket.createMany({
          data: Array.from({ length: ticketsToBuy }, () => ({
            eventId,
            supportTicketId: firstSupportTicket?.id,
          })),
        });
        console.info(`[PreEvent] Created ${ticketsToBuy} pool tickets for event ${eventId}`);
      }

      // Check if sold out → process surplus payout
      const totalAllocatedAfter = alreadyAllocatedTickets + ticketsToBuy + directTicketCount;
      const isSoldOut = totalAllocatedAfter >= event.totalTickets;
      if (isSoldOut) {
        console.info(`[PreEvent] Event ${eventId} is sold out, processing surplus payout`);
        // Import dynamically to avoid circular dependency at module load
        const { EventService } = await import('../services/event.service.js');
        // POS client is not available here; surplus payout requires it.
        // The event service will guard against missing POS.
        const eventService = new EventService(prisma);
        await eventService.processSurplusPayout(eventId);
      }

      // Use state machine for campaign transitions
      const activeCampaign = await prisma.campaign.findFirst({
        where: { eventId, status: { notIn: ['ENDED', 'DRAFT'] } },
      });
      if (activeCampaign) {
        const stateMachine = new CampaignStateMachineService(prisma);
        if (isSoldOut) {
          const surplusCents = Math.max(0, remainingFunds - (ticketsToBuy * event.ticketPriceCents));
          if (surplusCents > 0) {
            await prisma.campaign.update({
              where: { id: activeCampaign.id },
              data: { bonusCents: surplusCents },
            });
            console.info(`[PreEvent] Campaign ${activeCampaign.id} bonus: ${surplusCents} cents`);
          }
        }
        await stateMachine.transition(activeCampaign.id, 'SURPLUS_RESOLVED');
      }
    },
    { connection: getConnection(), concurrency: 1 },
  );

  // ──── Campaign Lifecycle State Machine (every 5 minutes) ────
  const campaignQueue = new Queue('campaign-lifecycle', {
    connection: getConnection(),
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 10,
    },
  });
  await campaignQueue.add(
    'tick',
    {},
    { repeat: { every: CAMPAIGN_LIFECYCLE_INTERVAL_MS }, jobId: 'campaign-lifecycle-tick' },
  );

  new Worker(
    'campaign-lifecycle',
    async () => {
      const stateMachine = new CampaignStateMachineService(prisma);
      const result = await stateMachine.runLifecycleTick();
      if (result.transitioned > 0) {
        console.info(
          `[CampaignLifecycle] Checked ${result.checked} campaigns, ${result.transitioned} transitioned`,
        );
      }
    },
    { connection: getConnection(), concurrency: 1 },
  );

  // ──── EDMTrain Event Sync (every 6 hours) ────
  const syncQueue = new Queue('event-sync', {
    connection: getConnection(),
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 10,
    },
  });
  await syncQueue.add(
    'sync',
    {},
    { repeat: { every: EDMTRAIN_SYNC_INTERVAL_MS }, jobId: 'edmtrain-sync' },
  );

  new Worker(
    'event-sync',
    async () => {
      const service = new EdmtrainService(prisma);
      const result = await service.syncEvents();
      console.info(
        `[EventSync] EDMTrain sync: ${result.created} created, ${result.skipped} skipped`,
      );
    },
    { connection: getConnection(), concurrency: 1 },
  );

  // ──── Past-Event Cleanup (every 1 hour) ────
  const cleanupQueue = new Queue('event-cleanup', {
    connection: getConnection(),
    defaultJobOptions: {
      removeOnComplete: 10,
      removeOnFail: 10,
    },
  });
  await cleanupQueue.add(
    'cleanup',
    {},
    { repeat: { every: EVENT_CLEANUP_INTERVAL_MS }, jobId: 'event-cleanup' },
  );

  new Worker(
    'event-cleanup',
    async () => {
      // Archive published events whose date has passed
      const archived = await prisma.event.updateMany({
        where: { date: { lt: new Date() }, status: 'PUBLISHED' },
        data: { status: 'COMPLETED' },
      });

      // Close open raffle pools for past events
      const closedPools = await prisma.rafflePool.updateMany({
        where: {
          event: { date: { lt: new Date() } },
          status: 'OPEN',
        },
        data: { status: 'CANCELLED' },
      });

      if (archived.count > 0 || closedPools.count > 0) {
        console.info(
          `[EventCleanup] Archived ${archived.count} events, cancelled ${closedPools.count} raffle pools`,
        );
      }
    },
    { connection: getConnection(), concurrency: 1 },
  );

  // ──── Purchase Agent (every 4 hours + on-demand) ────
  await getPurchaseAgentQueue().add(
    'acquire-cycle',
    {},
    { repeat: { every: 4 * 60 * 60 * 1000 }, jobId: 'purchase-agent-cycle' },
  );

  new Worker(
    'purchase-agent',
    async (job) => {
      const { POSClient, StripeProvider } = await import('@miraculturee/pos');
      const stripeKey = process.env.STRIPE_SECRET_KEY ?? '';
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
      const provider = new StripeProvider(stripeKey, webhookSecret);
      const pos = new POSClient(provider);
      const agent = new PurchaseAgentService(prisma, pos);

      if (job.data.eventId) {
        // Single event trigger
        const result = await agent.acquireSingleEvent(job.data.eventId);
        console.info(`[PurchaseAgent] Single event ${job.data.eventId}: ${JSON.stringify(result)}`);
      } else {
        // Full cycle
        const result = await agent.runAcquisitionCycle();
        console.info(`[PurchaseAgent] Cycle: ${JSON.stringify(result)}`);
      }
    },
    { connection: getConnection(), concurrency: 1 },
  );

  console.info('[Workers] Raffle draw, notification, pre-event, purchase-agent, campaign-lifecycle, event-sync, and event-cleanup workers initialized');
}
