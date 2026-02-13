import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { getStripeClient } from '../lib/stripe.js';
import { requireRole } from '../middleware/authenticate.js';

const PRODUCTION_DOMAIN = 'miraculture.com';

async function ensureDomainRegistered(stripe: Stripe, domain: string, log?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void }) {
  const existing = await stripe.applePayDomains.list({ limit: 100 });
  const already = existing.data.some((d) => d.domain_name === domain);
  if (already) {
    log?.info(`Apple Pay domain already registered: ${domain}`);
    return { registered: true, alreadyExisted: true };
  }
  const created = await stripe.applePayDomains.create({ domain_name: domain });
  log?.info(`Apple Pay domain registered: ${created.domain_name}`);
  return { registered: true, alreadyExisted: false, id: created.id };
}

export async function applePayRoutes(app: FastifyInstance) {
  // Auto-register domain on startup (non-blocking, best-effort)
  if (process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
    const stripe = getStripeClient();
    ensureDomainRegistered(stripe, PRODUCTION_DOMAIN, app.log).catch((err) => {
      app.log.warn(`Apple Pay auto-registration failed: ${(err as Error).message}`);
    });
  }

  // Manual registration endpoint (admin only)
  app.post('/register-domain', { preHandler: [requireRole('ADMIN')] }, async (req, reply) => {
    const result = await ensureDomainRegistered(getStripeClient(), PRODUCTION_DOMAIN, app.log);
    return reply.send(result);
  });

  // List registered domains (admin only)
  app.get('/domains', { preHandler: [requireRole('ADMIN')] }, async (_req, reply) => {
    const stripe = getStripeClient();
    const domains = await stripe.applePayDomains.list({ limit: 100 });
    return reply.send({ domains: domains.data.map((d) => ({ id: d.id, domain: d.domain_name })) });
  });
}
