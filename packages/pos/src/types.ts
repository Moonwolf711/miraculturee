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

export interface PaymentProvider {
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntentResult>;
  confirmPayment(paymentIntentId: string): Promise<PaymentConfirmResult>;
  refundPayment(paymentIntentId: string, amountCents?: number): Promise<RefundResult>;
  createTransfer(amountCents: number, destinationAccountId: string, metadata?: Record<string, string>): Promise<TransferResult>;
  constructWebhookEvent(payload: string | Buffer, signature: string): unknown;
}
