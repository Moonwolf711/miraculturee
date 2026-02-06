import type { FastifyInstance } from 'fastify';
import { SupportService } from '../services/support.service.js';
import { RaffleService } from '../services/raffle.service.js';

/**
 * Stripe webhook route.
 *
 * IMPORTANT: This route must receive the raw request body (not parsed JSON)
 * for Stripe signature verification to work. The Fastify server must be
 * configured with `rawBody: true` in its content-type parser or use
 * addContentTypeParser to capture the raw buffer.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY     — Stripe secret key (sk_test_...)
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret (whsec_...)
 *   RESEND_API_KEY        — Resend API key for email notifications (optional)
 */
export async function webhookRoutes(app: FastifyInstance) {
  const supportService = new SupportService(app.prisma, app.pos);
  const raffleService = new RaffleService(app.prisma, app.pos, app.io);

  // Register a raw body content-type parser for this route prefix.
  // This ensures Stripe signature verification receives the untouched payload.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  // POST /webhook/stripe — Stripe webhook endpoint
  app.post('/stripe', async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: any;
    try {
      // req.body is a raw Buffer thanks to the content-type parser above
      event = app.pos.parseWebhook(req.body as Buffer, signature);
    } catch (err: any) {
      app.log.warn(`Webhook signature verification failed: ${err.message}`);
      return reply.code(400).send({ error: 'Webhook signature verification failed' });
    }

    app.log.info(`Received Stripe webhook: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          const metadata = paymentIntent.metadata ?? {};

          if (metadata.type === 'support_purchase' && metadata.supportTicketId) {
            // Confirm the support ticket purchase and create pool tickets
            await supportService.confirmPurchase(
              metadata.supportTicketId,
              paymentIntent.id,
            );
            app.log.info(
              `Support purchase confirmed: supportTicketId=${metadata.supportTicketId}`,
            );

            // Send email notification and create in-app notification (non-blocking)
            sendSupportConfirmationEmail(app, metadata.supportTicketId).catch(
              (err) =>
                app.log.error(
                  `Failed to send support confirmation email: ${err.message}`,
                ),
            );
          }

          if (metadata.type === 'raffle_entry' && metadata.poolId && metadata.userId) {
            // Confirm the raffle entry payment
            await confirmRaffleEntry(
              app,
              metadata.poolId,
              metadata.userId,
              paymentIntent.id,
            );
            app.log.info(
              `Raffle entry confirmed: poolId=${metadata.poolId}, userId=${metadata.userId}`,
            );

            // Send email notification and create in-app notification (non-blocking)
            sendRaffleEntryConfirmationEmail(
              app,
              metadata.poolId,
              metadata.userId,
            ).catch((err) =>
              app.log.error(
                `Failed to send raffle entry confirmation email: ${err.message}`,
              ),
            );
          }

          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;

          // Update all transactions referencing this Stripe payment to "failed"
          await app.prisma.transaction.updateMany({
            where: { stripePaymentId: paymentIntent.id },
            data: { status: 'failed' },
          });

          app.log.info(
            `Payment failed: ${paymentIntent.id} — ${paymentIntent.last_payment_error?.message ?? 'unknown reason'}`,
          );
          break;
        }

        default:
          app.log.info(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (err: any) {
      // Log the error but still return 200 so Stripe doesn't retry endlessly
      app.log.error(`Error processing webhook ${event.type}: ${err.message}`);
    }

    // Always return 200 to acknowledge receipt
    return reply.send({ received: true });
  });
}

/**
 * Confirms a raffle entry after successful payment.
 * Updates the transaction status to "completed".
 */
async function confirmRaffleEntry(
  app: FastifyInstance,
  poolId: string,
  userId: string,
  stripePaymentId: string,
): Promise<void> {
  // Find the raffle entry for this user + pool
  const entry = await app.prisma.raffleEntry.findUnique({
    where: { poolId_userId: { poolId, userId } },
  });

  if (!entry) {
    app.log.warn(
      `Raffle entry not found for confirmation: poolId=${poolId}, userId=${userId}`,
    );
    return;
  }

  // Update transaction status to completed
  await app.prisma.transaction.updateMany({
    where: {
      posReference: entry.id,
      type: 'RAFFLE_ENTRY',
    },
    data: {
      status: 'completed',
      stripePaymentId,
    },
  });
}

/**
 * Sends a support purchase confirmation email and creates an in-app notification.
 * This function is designed to be called in a fire-and-forget manner.
 */
async function sendSupportConfirmationEmail(
  app: FastifyInstance,
  supportTicketId: string,
): Promise<void> {
  const supportTicket = await app.prisma.supportTicket.findUnique({
    where: { id: supportTicketId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      event: {
        select: { id: true, title: true, ticketPriceCents: true },
        include: { artist: { select: { stageName: true } } },
      },
    },
  });

  if (!supportTicket) return;

  const { user, event } = supportTicket;
  const totalFormatted = `$${(supportTicket.totalAmountCents / 100).toFixed(2)}`;

  // Create in-app notification
  await app.prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Support Confirmed',
      body: `Your support purchase of ${supportTicket.ticketCount} ticket${supportTicket.ticketCount > 1 ? 's' : ''} for ${event.title} has been confirmed.`,
      metadata: { eventId: event.id, supportTicketId },
    },
  });

  // Send email (skip if email service is not configured)
  if (app.emailService) {
    await app.emailService.sendSupportConfirmation(user.email, {
      userName: user.name,
      eventTitle: event.title,
      artistName: event.artist.stageName,
      ticketCount: supportTicket.ticketCount,
      totalAmount: totalFormatted,
    });
  }
}

/**
 * Sends a raffle entry confirmation email and creates an in-app notification.
 * This function is designed to be called in a fire-and-forget manner.
 */
async function sendRaffleEntryConfirmationEmail(
  app: FastifyInstance,
  poolId: string,
  userId: string,
): Promise<void> {
  const pool = await app.prisma.rafflePool.findUnique({
    where: { id: poolId },
    include: { event: { select: { id: true, title: true } } },
  });

  if (!pool) return;

  const user = await app.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) return;

  const tierFormatted = `$${(pool.tierCents / 100).toFixed(2)}`;
  const drawDate = pool.scheduledDrawTime
    ? pool.scheduledDrawTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'To be announced';

  // Create in-app notification
  await app.prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Raffle Entry Confirmed',
      body: `You have entered the raffle for ${pool.event.title}. Good luck!`,
      metadata: { eventId: pool.event.id, poolId },
    },
  });

  // Send email (skip if email service is not configured)
  if (app.emailService) {
    await app.emailService.sendRaffleEntryConfirmation(user.email, {
      userName: user.name,
      eventTitle: pool.event.title,
      tierPrice: tierFormatted,
      drawDate,
    });
  }
}
