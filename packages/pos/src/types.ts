export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
}

export interface PaymentConfirmResult {
  id: string;
  status: 'succeeded' | 'failed' | 'processing';
  amountCents: number;
}

export interface RefundResult {
  id: string;
  status: string;
  amountCents: number;
}

export interface TransferResult {
  id: string;
  status: string;
  amountCents: number;
  destinationAccountId: string;
}

export interface CreatePaymentParams {
  amountCents: number;
  currency: string;
  metadata?: Record<string, string>;
  customerId?: string;
}

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

export interface CardholderResult {
  id: string;
  name: string;
  status: string;
}

export interface VirtualCardResult {
  id: string;
  last4: string;
  status: string;
  expMonth: number;
  expYear: number;
}

export interface CardDetails {
  id: string;
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  last4: string;
}

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
