import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { POSClient, StripeProvider } from '@miraculturee/pos';

declare module 'fastify' {
  interface FastifyInstance {
    pos: POSClient;
  }
}

export const posPlugin = fp(async (app: FastifyInstance) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_placeholder';

  const provider = new StripeProvider(stripeKey, webhookSecret);
  const pos = new POSClient(provider);

  app.decorate('pos', pos);
});
