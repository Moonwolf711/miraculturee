import type { PrismaClient, Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { getStripeClient } from '../lib/stripe.js';

/** $19.99/mo = 1999 cents */
const AGENT_SUBSCRIPTION_CENTS = 1999;
/** $5.00/mo raffle credits = 500 cents */
const MONTHLY_RAFFLE_CREDIT_CENTS = 500;

export class AgentSubscriptionService {
  private stripe: Stripe;

  constructor(private prisma: PrismaClient) {
    this.stripe = getStripeClient();
  }

  /**
   * Create a Stripe Checkout Session for the agent subscription.
   * If the agent doesn't have a Stripe customer ID yet, one is created.
   */
  async createCheckoutSession(
    agentId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ sessionId: string; url: string }> {
    const agent = await this.prisma.promoterAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent profile not found');
    if (agent.userId !== userId) throw new Error('Not your agent profile');
    if (agent.subscriptionStatus === 'active') throw new Error('Already subscribed');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) throw new Error('User not found');

    // Get or create Stripe customer
    let customerId = agent.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { agentId, userId },
      });
      customerId = customer.id;
      await this.prisma.promoterAgent.update({
        where: { id: agentId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Find or create the agent subscription price
    const priceId = await this.getOrCreatePriceId();

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { agentId, userId, type: 'agent_subscription' },
      subscription_data: {
        metadata: { agentId, userId, type: 'agent_subscription' },
      },
    });

    return { sessionId: session.id, url: session.url! };
  }

  /**
   * Handle subscription activation from webhook.
   * Sets status to active and grants $5 raffle credits.
   */
  async activateSubscription(
    subscriptionId: string,
    customerId: string,
    currentPeriodEnd: Date,
  ): Promise<void> {
    const agent = await this.prisma.promoterAgent.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!agent) return; // Not an agent subscription

    await this.prisma.promoterAgent.update({
      where: { id: agent.id },
      data: {
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: 'active',
        subscriptionEndAt: currentPeriodEnd,
        raffleCreditCents: MONTHLY_RAFFLE_CREDIT_CENTS,
        creditResetAt: currentPeriodEnd,
      },
    });

    // Create a credit transaction record
    await this.prisma.transaction.create({
      data: {
        userId: agent.userId,
        type: 'AGENT_RAFFLE_CREDIT',
        amountCents: MONTHLY_RAFFLE_CREDIT_CENTS,
        status: 'completed',
        metadata: {
          reason: 'subscription_activated',
          agentId: agent.id,
          subscriptionId,
        },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: agent.userId,
        title: 'Agent Subscription Active',
        body: `Your Agent Pro subscription is active! You have $${(MONTHLY_RAFFLE_CREDIT_CENTS / 100).toFixed(2)} in raffle credits this month. Use them before the end of your billing period.`,
        metadata: { type: 'agent_subscription_active', agentId: agent.id },
      },
    });
  }

  /**
   * Handle subscription renewal (invoice.paid webhook).
   * Resets raffle credits to $5 for the new period.
   */
  async renewCredits(
    subscriptionId: string,
    currentPeriodEnd: Date,
  ): Promise<void> {
    const agent = await this.prisma.promoterAgent.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!agent) return;

    // Reset credits to $5 (old credits are lost — use-it-or-lose-it)
    await this.prisma.promoterAgent.update({
      where: { id: agent.id },
      data: {
        subscriptionStatus: 'active',
        subscriptionEndAt: currentPeriodEnd,
        raffleCreditCents: MONTHLY_RAFFLE_CREDIT_CENTS,
        creditResetAt: currentPeriodEnd,
      },
    });

    await this.prisma.transaction.create({
      data: {
        userId: agent.userId,
        type: 'AGENT_RAFFLE_CREDIT',
        amountCents: MONTHLY_RAFFLE_CREDIT_CENTS,
        status: 'completed',
        metadata: {
          reason: 'subscription_renewed',
          agentId: agent.id,
          subscriptionId,
        },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: agent.userId,
        title: 'Monthly Raffle Credits Refreshed',
        body: `Your $${(MONTHLY_RAFFLE_CREDIT_CENTS / 100).toFixed(2)} raffle credits have been refreshed for this month. Any unused credits from last month have expired.`,
        metadata: { type: 'agent_credits_renewed', agentId: agent.id },
      },
    });
  }

  /**
   * Handle subscription cancellation or payment failure.
   */
  async deactivateSubscription(subscriptionId: string, status: string): Promise<void> {
    const agent = await this.prisma.promoterAgent.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!agent) return;

    await this.prisma.promoterAgent.update({
      where: { id: agent.id },
      data: {
        subscriptionStatus: status, // 'canceled', 'past_due', etc.
        raffleCreditCents: 0, // revoke unused credits
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: agent.userId,
        title: status === 'canceled' ? 'Subscription Canceled' : 'Subscription Issue',
        body: status === 'canceled'
          ? 'Your Agent Pro subscription has been canceled. You can resubscribe anytime from your agent dashboard.'
          : 'There was an issue with your subscription payment. Please update your payment method.',
        metadata: { type: 'agent_subscription_update', agentId: agent.id, status },
      },
    });
  }

  /**
   * Spend agent raffle credits toward a raffle entry.
   * Returns the amount actually deducted.
   */
  async spendRaffleCredits(
    agentId: string,
    amountCents: number,
    metadata: { poolId: string; eventId?: string },
  ): Promise<{ deductedCents: number; remainingCents: number }> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const agent = await tx.promoterAgent.findUnique({
        where: { id: agentId },
        select: { userId: true, raffleCreditCents: true, creditResetAt: true, subscriptionStatus: true },
      });
      if (!agent) throw new Error('Agent not found');
      if (agent.subscriptionStatus !== 'active') throw new Error('Subscription not active');

      // Check if credits have expired
      if (agent.creditResetAt && new Date() > agent.creditResetAt) {
        await tx.promoterAgent.update({
          where: { id: agentId },
          data: { raffleCreditCents: 0 },
        });
        return { deductedCents: 0, remainingCents: 0 };
      }

      const deductedCents = Math.min(amountCents, agent.raffleCreditCents);
      if (deductedCents <= 0) {
        return { deductedCents: 0, remainingCents: agent.raffleCreditCents };
      }

      const updated = await tx.promoterAgent.update({
        where: { id: agentId },
        data: { raffleCreditCents: { decrement: deductedCents } },
        select: { raffleCreditCents: true },
      });

      await tx.transaction.create({
        data: {
          userId: agent.userId,
          type: 'AGENT_CREDIT_SPEND',
          amountCents: deductedCents,
          status: 'completed',
          metadata: { agentId, ...metadata },
        },
      });

      return { deductedCents, remainingCents: updated.raffleCreditCents };
    });
  }

  /**
   * Get the agent's subscription status and credit balance.
   */
  async getSubscriptionStatus(agentId: string) {
    const agent = await this.prisma.promoterAgent.findUnique({
      where: { id: agentId },
      select: {
        subscriptionStatus: true,
        subscriptionEndAt: true,
        raffleCreditCents: true,
        creditResetAt: true,
        stripeSubscriptionId: true,
      },
    });
    if (!agent) throw new Error('Agent not found');

    // Check if credits expired
    let effectiveCredits = agent.raffleCreditCents;
    if (agent.creditResetAt && new Date() > agent.creditResetAt && agent.raffleCreditCents > 0) {
      effectiveCredits = 0;
      // Lazy-clean expired credits
      await this.prisma.promoterAgent.update({
        where: { id: agentId },
        data: { raffleCreditCents: 0 },
      });
    }

    return {
      status: agent.subscriptionStatus,
      currentPeriodEnd: agent.subscriptionEndAt?.toISOString() ?? null,
      raffleCreditCents: effectiveCredits,
      raffleCreditDollars: (effectiveCredits / 100).toFixed(2),
      creditExpiresAt: agent.creditResetAt?.toISOString() ?? null,
      priceCents: AGENT_SUBSCRIPTION_CENTS,
      priceDollars: (AGENT_SUBSCRIPTION_CENTS / 100).toFixed(2),
      monthlyCreditCents: MONTHLY_RAFFLE_CREDIT_CENTS,
      monthlyCreditDollars: (MONTHLY_RAFFLE_CREDIT_CENTS / 100).toFixed(2),
    };
  }

  /**
   * Create a Stripe billing portal session for the agent to manage their subscription.
   */
  async createPortalSession(agentId: string, returnUrl: string): Promise<string> {
    const agent = await this.prisma.promoterAgent.findUnique({
      where: { id: agentId },
      select: { stripeCustomerId: true },
    });
    if (!agent?.stripeCustomerId) throw new Error('No subscription found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: agent.stripeCustomerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  /**
   * Get or create the Stripe price for the agent subscription product.
   * Uses env var STRIPE_AGENT_PRICE_ID if set, otherwise creates one.
   */
  private async getOrCreatePriceId(): Promise<string> {
    const envPriceId = process.env.STRIPE_AGENT_PRICE_ID;
    if (envPriceId) return envPriceId;

    // Search for existing product
    const products = await this.stripe.products.search({
      query: "metadata['type']:'agent_subscription'",
    });

    if (products.data.length > 0) {
      const prices = await this.stripe.prices.list({
        product: products.data[0].id,
        active: true,
        type: 'recurring',
        limit: 1,
      });
      if (prices.data.length > 0) return prices.data[0].id;
    }

    // Create product and price
    const product = await this.stripe.products.create({
      name: 'MiraCulture Agent Pro',
      description: 'Monthly agent subscription: 50% campaign revenue share, $5/mo raffle credits, verified badge',
      metadata: { type: 'agent_subscription' },
    });

    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: AGENT_SUBSCRIPTION_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { type: 'agent_subscription' },
    });

    return price.id;
  }
}
