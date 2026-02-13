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

/**
 * POS Client wraps the payment provider to add app-level logic.
 * All app code calls POS client, never the provider directly.
 */
export class POSClient {
  constructor(private readonly provider: PaymentProvider) {}

  /** Creates a payment intent, enforcing a $0.50 minimum. */
  async createPayment(params: CreatePaymentParams): Promise<PaymentIntentResult> {
    if (params.amountCents < 50) {
      throw new Error('Minimum payment amount is $0.50');
    }
    return this.provider.createPaymentIntent(params);
  }

  /** Retrieves the current status of a payment intent. */
  async confirmPayment(paymentIntentId: string): Promise<PaymentConfirmResult> {
    return this.provider.confirmPayment(paymentIntentId);
  }

  /** Refunds a payment in full, or partially if an amount is provided. */
  async refundPayment(paymentIntentId: string, amountCents?: number): Promise<RefundResult> {
    return this.provider.refundPayment(paymentIntentId, amountCents);
  }

  /** Transfers earnings to an artist's connected Stripe account. */
  async payoutToArtist(
    amountCents: number,
    stripeAccountId: string,
    eventId: string,
  ): Promise<TransferResult> {
    return this.provider.createTransfer(amountCents, stripeAccountId, {
      eventId,
      type: 'artist_payout',
    });
  }

  /** Verifies and parses a Stripe webhook event. */
  parseWebhook(payload: string | Buffer, signature: string): unknown {
    return this.provider.constructWebhookEvent(payload, signature);
  }

  /* ─── Stripe Issuing (virtual cards for ticket acquisition) ─── */

  /** Creates a cardholder for Stripe Issuing. Throws if provider lacks Issuing support. */
  async createCardholder(params: CreateCardholderParams): Promise<CardholderResult> {
    if (!this.provider.createCardholder) throw new Error('Issuing not supported by provider');
    return this.provider.createCardholder(params);
  }

  /** Provisions a virtual card. Throws if provider lacks Issuing support. */
  async createVirtualCard(cardholderId: string, spendingLimitCents?: number): Promise<VirtualCardResult> {
    if (!this.provider.createVirtualCard) throw new Error('Issuing not supported by provider');
    return this.provider.createVirtualCard(cardholderId, spendingLimitCents);
  }

  /** Retrieves full card details (number, CVC). Throws if provider lacks Issuing support. */
  async getCardDetails(cardId: string): Promise<CardDetails> {
    if (!this.provider.getCardDetails) throw new Error('Issuing not supported by provider');
    return this.provider.getCardDetails(cardId);
  }

  /** Freezes (deactivates) a virtual card. Throws if provider lacks Issuing support. */
  async freezeCard(cardId: string): Promise<void> {
    if (!this.provider.freezeCard) throw new Error('Issuing not supported by provider');
    return this.provider.freezeCard(cardId);
  }
}
