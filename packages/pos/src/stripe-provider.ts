import Stripe from 'stripe';
import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentIntentResult,
  PaymentConfirmResult,
  RefundResult,
  TransferResult,
} from './types.js';

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
    this.webhookSecret = webhookSecret;
  }

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

  constructWebhookEvent(payload: string | Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}
