import Stripe from 'stripe';
import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentIntentResult,
  PaymentConfirmResult,
  RefundResult,
  TransferResult,
  CreateCardholderParams,
  CardholderResult,
  VirtualCardResult,
  CardDetails,
} from './types.js';

/** Stripe-backed implementation of {@link PaymentProvider}. */
export class StripeProvider implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
    this.webhookSecret = webhookSecret;
  }

  /** Creates a Stripe PaymentIntent with automatic payment methods enabled. */
  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: params.amountCents,
      currency: params.currency,
      metadata: params.metadata,
      customer: params.customerId,
      automatic_payment_methods: { enabled: true },
    });

    return {
      id: intent.id,
      clientSecret: intent.client_secret!,
      status: intent.status,
    };
  }

  /** Retrieves and normalizes the current status of a PaymentIntent. */
  async confirmPayment(paymentIntentId: string): Promise<PaymentConfirmResult> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    const status =
      intent.status === 'succeeded'
        ? 'succeeded'
        : intent.status === 'processing'
          ? 'processing'
          : 'failed';

    return {
      id: intent.id,
      status,
      amountCents: intent.amount,
    };
  }

  /** Issues a full or partial refund for a PaymentIntent. */
  async refundPayment(paymentIntentId: string, amountCents?: number): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amountCents ? { amount: amountCents } : {}),
    });

    return {
      id: refund.id,
      status: refund.status ?? 'unknown',
      amountCents: refund.amount,
    };
  }

  /** Transfers funds to a connected Stripe account. */
  async createTransfer(
    amountCents: number,
    destinationAccountId: string,
    metadata?: Record<string, string>,
  ): Promise<TransferResult> {
    const transfer = await this.stripe.transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: destinationAccountId,
      metadata,
    });

    return {
      id: transfer.id,
      status: 'completed',
      amountCents: transfer.amount,
      destinationAccountId: transfer.destination as string,
    };
  }

  /** Verifies and parses a Stripe webhook event from the raw payload. */
  constructWebhookEvent(payload: string | Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  /* ─── Stripe Issuing (virtual cards for ticket acquisition) ─── */

  /** Creates an Issuing cardholder for virtual card provisioning. */
  async createCardholder(params: CreateCardholderParams): Promise<CardholderResult> {
    const cardholder = await this.stripe.issuing.cardholders.create({
      name: params.name,
      email: params.email,
      type: 'company',
      billing: { address: params.billingAddress },
    });
    return { id: cardholder.id, name: cardholder.name, status: cardholder.status };
  }

  /** Creates a virtual Issuing card, optionally with a per-authorization spending limit. */
  async createVirtualCard(cardholderId: string, spendingLimitCents?: number): Promise<VirtualCardResult> {
    const card = await this.stripe.issuing.cards.create({
      cardholder: cardholderId,
      currency: 'usd',
      type: 'virtual',
      status: 'active',
      ...(spendingLimitCents && {
        spending_controls: {
          spending_limits: [{ amount: spendingLimitCents, interval: 'per_authorization' }],
        },
      }),
    });
    return {
      id: card.id,
      last4: card.last4,
      status: card.status,
      expMonth: card.exp_month,
      expYear: card.exp_year,
    };
  }

  /** Retrieves full card details (number, CVC) via Stripe expand. */
  async getCardDetails(cardId: string): Promise<CardDetails> {
    const card = await this.stripe.issuing.cards.retrieve(cardId, {
      expand: ['number', 'cvc'],
    });
    // Stripe's type definitions don't include `number` and `cvc` on the base
    // Card type even when expanded. The `as unknown as` cast is required until
    // Stripe publishes expanded-field types.
    const expanded = card as unknown as { number: string; cvc: string };
    return {
      id: card.id,
      number: expanded.number,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      cvc: expanded.cvc,
      last4: card.last4,
    };
  }

  /** Deactivates a virtual card by setting its status to inactive. */
  async freezeCard(cardId: string): Promise<void> {
    await this.stripe.issuing.cards.update(cardId, { status: 'inactive' });
  }
}
