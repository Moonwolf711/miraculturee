/** Stripe PaymentIntent creation result. */
export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
}

/** Result of confirming/retrieving a PaymentIntent status. */
export interface PaymentConfirmResult {
  id: string;
  status: 'succeeded' | 'failed' | 'processing';
  amountCents: number;
}

/** Result of a payment refund. */
export interface RefundResult {
  id: string;
  status: string;
  amountCents: number;
}

/** Result of a Stripe Connect transfer to a destination account. */
export interface TransferResult {
  id: string;
  status: string;
  amountCents: number;
  destinationAccountId: string;
}

/** Parameters for creating a new PaymentIntent. */
export interface CreatePaymentParams {
  amountCents: number;
  currency: string;
  metadata?: Record<string, string>;
  customerId?: string;
}

/** Parameters for creating an Issuing cardholder. */
export interface CreateCardholderParams {
  name: string;
  email: string;
  billingAddress: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

/** Result of creating an Issuing cardholder. */
export interface CardholderResult {
  id: string;
  name: string;
  status: string;
}

/** Result of creating a virtual card. */
export interface VirtualCardResult {
  id: string;
  last4: string;
  status: string;
  expMonth: number;
  expYear: number;
}

/** Full card details including sensitive data (number, CVC). */
export interface CardDetails {
  id: string;
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  last4: string;
}

/** Abstract payment provider interface. Implementations wrap a specific gateway (e.g. Stripe). */
export interface PaymentProvider {
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntentResult>;
  confirmPayment(paymentIntentId: string): Promise<PaymentConfirmResult>;
  refundPayment(paymentIntentId: string, amountCents?: number): Promise<RefundResult>;
  createTransfer(amountCents: number, destinationAccountId: string, metadata?: Record<string, string>): Promise<TransferResult>;
  constructWebhookEvent(payload: string | Buffer, signature: string): unknown;
  createCardholder?(params: CreateCardholderParams): Promise<CardholderResult>;
  createVirtualCard?(cardholderId: string, spendingLimitCents?: number): Promise<VirtualCardResult>;
  getCardDetails?(cardId: string): Promise<CardDetails>;
  freezeCard?(cardId: string): Promise<void>;
}
