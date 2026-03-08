import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { POSClient, StripeProvider } from '@miraculturee/pos';

declare module 'fastify' {
  interface FastifyInstance {
    pos: POSClient;
  }
}

export const posPlugin = fp(async (app: FastifyInstance) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    app.log.warn('POS plugin disabled: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set');
    // Decorate with a proxy that throws on any method call so routes fail clearly
    app.decorate('pos', new Proxy({} as POSClient, {
      get(_, prop) {
        if (prop === 'then') return undefined; // avoid Promise confusion
        return () => { throw new Error('POS not configured: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET'); };
      },
    }));
    return;
  }

  const provider = new StripeProvider(stripeKey, webhookSecret);
  const pos = new POSClient(provider);

  app.decorate('pos', pos);
});
