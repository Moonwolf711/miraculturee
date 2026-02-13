/**
 * Stripe Connect Webhook Routes
 *
 * Handles two distinct webhook types:
 *
 * 1. **Thin Events (V2 Account webhooks)**
 *    - Fired when connected account requirements or capabilities change
 *    - Parsed with `stripeClient.parseThinEvent()`, then full event retrieved
 *      via `stripeClient.v2.core.events.retrieve()`
 *    - Events: v2.core.account[requirements].updated,
 *              v2.core.account[configuration.merchant].capability_status_updated
 *
 * 2. **Standard Events (Subscription lifecycle)**
 *    - Fired for subscription and customer changes
 *    - Parsed with `stripeClient.webhooks.constructEvent()`
 *    - Events: customer.subscription.updated, customer.subscription.deleted,
 *              payment_method.attached, payment_method.detached, customer.updated
 *
 * Each webhook type uses its own signing secret (env var).
 * Both routes receive raw request bodies for signature verification.
 */

import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';

export async function connectWebhookRoutes(app: FastifyInstance) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) return; // Skip registration if Stripe isn't configured

  const stripeClient = new Stripe(stripeSecretKey);

  // Register raw body parser — required for Stripe signature verification.
  // Stripe computes the HMAC over the exact bytes received, so we must
  // pass the untouched Buffer (not parsed JSON) to the verification methods.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // THIN EVENT WEBHOOK — V2 Account Updates
  //
  // Receives thin events for connected account requirement and capability
  // changes. Thin events contain only the event ID and type — you must
  // retrieve the full event via the V2 events API to get the actual data.
  //
  // Env: STRIPE_CONNECT_THIN_WEBHOOK_SECRET (whsec_...)
  // Create this webhook endpoint in Stripe Dashboard → Webhooks, selecting
  // the V2 "thin events" format and subscribing to account-related events.
  //
  // POST /connect-webhooks/thin
  // ═══════════════════════════════════════════════════════════════════════════
  app.post('/thin', async (req, reply) => {
    const webhookSecret = process.env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET;
    if (!webhookSecret) {
      app.log.warn('STRIPE_CONNECT_THIN_WEBHOOK_SECRET not set — skipping thin event');
      return reply.code(200).send({ received: true, skipped: true });
    }

    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    let thinEvent: any;
    try {
      // parseThinEvent verifies the signature and returns the thin event object.
      // The thin event contains: id, type, created, and related_object.
      thinEvent = (stripeClient as any).parseThinEvent(
        req.body as Buffer,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      app.log.warn(`Thin event signature verification failed: ${err.message}`);
      return reply.code(400).send({ error: 'Signature verification failed' });
    }

    app.log.info(`Received thin event: ${thinEvent.type} (${thinEvent.id})`);

    try {
      // Retrieve the full event from the V2 events API.
      // The thin event only has the type and ID — we need the full event
      // to get the account data and updated requirements/capabilities.
      const fullEvent = await (stripeClient as any).v2.core.events.retrieve(thinEvent.id);

      switch (thinEvent.type) {
        // ─── Account Requirements Updated ───
        // Fired when the connected account's onboarding requirements change.
        // Check if the account still has outstanding requirements.
        case 'v2.core.account.requirements_updated':
        case 'v2.core.account[requirements].updated': {
          const accountId = fullEvent?.data?.object?.id
            ?? fullEvent?.related_object?.id
            ?? thinEvent?.related_object?.id;

          if (!accountId) {
            app.log.warn('No account ID found in thin event — skipping');
            break;
          }

          // Re-fetch the account to check current requirements status
          const account = await (stripeClient as any).v2.core.accounts.retrieve(accountId, {
            include: ['requirements'],
          });

          const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status;
          const onboardingComplete =
            requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';

          await app.prisma.connectedAccount.updateMany({
            where: { stripeAccountId: accountId },
            data: { onboardingComplete },
          });

          app.log.info(
            `Account ${accountId} requirements updated — onboardingComplete: ${onboardingComplete}`,
          );
          break;
        }

        // ─── Capability Status Updated ───
        // Fired when a capability (e.g., card_payments) changes status.
        // Check if card_payments is now active.
        case 'v2.core.account.capability_status_updated':
        case 'v2.core.account[configuration.merchant].capability_status_updated': {
          const accountId = fullEvent?.data?.object?.id
            ?? fullEvent?.related_object?.id
            ?? thinEvent?.related_object?.id;

          if (!accountId) {
            app.log.warn('No account ID found in capability event — skipping');
            break;
          }

          // Re-fetch the account to check current capability status
          const account = await (stripeClient as any).v2.core.accounts.retrieve(accountId, {
            include: ['configuration.merchant'],
          });

          const paymentsEnabled =
            account?.configuration?.merchant?.capabilities?.card_payments?.status === 'active';

          await app.prisma.connectedAccount.updateMany({
            where: { stripeAccountId: accountId },
            data: { paymentsEnabled },
          });

          app.log.info(
            `Account ${accountId} capability updated — paymentsEnabled: ${paymentsEnabled}`,
          );
          break;
        }

        default:
          app.log.info(`Unhandled thin event type: ${thinEvent.type}`);
      }
    } catch (err: any) {
      app.log.error(`Error processing thin event ${thinEvent.type}: ${err.message}`);
    }

    return reply.send({ received: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STANDARD WEBHOOK — Subscription Lifecycle Events
  //
  // Receives standard webhook events for subscription and customer changes.
  // These are the classic v1-style events with full event data included.
  //
  // Env: STRIPE_CONNECT_WEBHOOK_SECRET (whsec_...)
  // Create this webhook endpoint in Stripe Dashboard → Webhooks, selecting
  // the standard format and subscribing to:
  //   - customer.subscription.updated
  //   - customer.subscription.deleted
  //   - customer.updated
  //
  // POST /connect-webhooks/standard
  // ═══════════════════════════════════════════════════════════════════════════
  app.post('/standard', async (req, reply) => {
    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!webhookSecret) {
      app.log.warn('STRIPE_CONNECT_WEBHOOK_SECRET not set — skipping standard event');
      return reply.code(200).send({ received: true, skipped: true });
    }

    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!signature) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.body as Buffer,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      app.log.warn(`Standard webhook signature verification failed: ${err.message}`);
      return reply.code(400).send({ error: 'Signature verification failed' });
    }

    app.log.info(`Received standard event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        // ─── Subscription Updated ───
        // Fired when a subscription's status, plan, or billing changes.
        // We upsert the subscription record in our DB.
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;

          // Find the connected account that owns this subscription.
          // The customer_account field links the subscription to a connected account.
          const accountId = (sub as any).customer_account ?? null;
          if (!accountId) {
            app.log.info('Subscription update without customer_account — skipping');
            break;
          }

          const connectedAccount = await app.prisma.connectedAccount.findUnique({
            where: { stripeAccountId: accountId },
          });

          if (!connectedAccount) {
            app.log.info(`No connected account found for ${accountId} — skipping`);
            break;
          }

          // Upsert the subscription record
          await app.prisma.connectSubscription.upsert({
            where: { stripeSubscriptionId: sub.id },
            update: {
              status: sub.status,
              priceId: sub.items?.data?.[0]?.price?.id ?? null,
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
            create: {
              connectedAccountId: connectedAccount.id,
              stripeSubscriptionId: sub.id,
              status: sub.status,
              priceId: sub.items?.data?.[0]?.price?.id ?? null,
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });

          app.log.info(
            `Subscription ${sub.id} updated — status: ${sub.status}, account: ${accountId}`,
          );
          break;
        }

        // ─── Subscription Deleted ───
        // Fired when a subscription is fully canceled (after any grace period).
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;

          await app.prisma.connectSubscription.updateMany({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: 'canceled',
              cancelAtPeriodEnd: false,
            },
          });

          app.log.info(`Subscription ${sub.id} deleted`);
          break;
        }

        // ─── Customer Updated ───
        // Fired when customer info changes (email, default payment method, etc.)
        // Logged for now — extend as needed.
        case 'customer.updated': {
          const customer = event.data.object as Stripe.Customer;
          app.log.info(`Customer ${customer.id} updated`);
          break;
        }

        default:
          app.log.info(`Unhandled standard event type: ${event.type}`);
      }
    } catch (err: any) {
      app.log.error(`Error processing standard event ${event.type}: ${err.message}`);
    }

    return reply.send({ received: true });
  });
}
