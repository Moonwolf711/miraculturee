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
  constructor(private provider: PaymentProvider) {}

  async createPayment(params: CreatePaymentParams): Promise<PaymentIntentResult> {
    if (params.amountCents < 50) {
      throw new Error('Minimum payment amount is $0.50');
    }
    return this.provider.createPaymentIntent(params);
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentConfirmResult> {
    return this.provider.confirmPayment(paymentIntentId);
  }

  async refundPayment(paymentIntentId: string, amountCents?: number): Promise<RefundResult> {
    return this.provider.refundPayment(paymentIntentId, amountCents);
  }

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

  parseWebhook(payload: string | Buffer, signature: string): unknown {
    return this.provider.constructWebhookEvent(payload, signature);
  }

  /* ─── Stripe Issuing (virtual cards for ticket acquisition) ─── */

  async createCardholder(params: CreateCardholderParams): Promise<CardholderResult> {
    if (!this.provider.createCardholder) throw new Error('Issuing not supported by provider');
    return this.provider.createCardholder(params);
  }

  async createVirtualCard(cardholderId: string, spendingLimitCents?: number): Promise<VirtualCardResult> {
    if (!this.provider.createVirtualCard) throw new Error('Issuing not supported by provider');
    return this.provider.createVirtualCard(cardholderId, spendingLimitCents);
  }

  async getCardDetails(cardId: string): Promise<CardDetails> {
    if (!this.provider.getCardDetails) throw new Error('Issuing not supported by provider');
    return this.provider.getCardDetails(cardId);
  }

  async freezeCard(cardId: string): Promise<void> {
    if (!this.provider.freezeCard) throw new Error('Issuing not supported by provider');
    return this.provider.freezeCard(cardId);
  }
}
