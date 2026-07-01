import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { posPlugin } from '../src/plugins/pos';

/**
 * Regression guard for CRIT-002: a missing/placeholder Stripe configuration must
 * never boot a live payment surface silently.
 *  - production: fail fast at startup so a misconfigured deploy is caught before
 *    the first charge/webhook.
 *  - dev/test: degrade to a proxy that throws on use (never a placeholder key).
 */

const saved = {
  nodeEnv: process.env.NODE_ENV,
  key: process.env.STRIPE_SECRET_KEY,
  webhook: process.env.STRIPE_WEBHOOK_SECRET,
};

function restore(name: 'NODE_ENV' | 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET', value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('NODE_ENV', saved.nodeEnv);
  restore('STRIPE_SECRET_KEY', saved.key);
  restore('STRIPE_WEBHOOK_SECRET', saved.webhook);
});

describe('posPlugin — CRIT-002 misconfiguration handling', () => {
  it('fails fast at boot in production when Stripe keys are missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const app = Fastify();
    app.register(posPlugin);
    await expect(app.ready()).rejects.toThrow(/POS misconfigured/i);
    await app.close();
  });

  it('degrades to a throwing proxy (never a placeholder key) in non-production', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const app = Fastify();
    await app.register(posPlugin);
    await app.ready();

    // NB: the throw-on-any-access proxy fools vitest's value-inspection (it
    // returns a function for every property, so any expect() that receives the
    // proxy — even indirectly — invokes it). Assert via a manual try/catch so
    // only primitives reach expect(). A successful throw below also proves the
    // decorator is present. This is a harness artifact; the proxy's on-use throw
    // is the intended production behavior.
    let threw = false;
    let message = '';
    try {
      (app.pos as unknown as { charge: () => unknown }).charge();
    } catch (err) {
      threw = true;
      message = err instanceof Error ? err.message : String(err);
    }
    expect(threw).toBe(true);
    expect(message).toMatch(/POS not configured/i);

    await app.close();
  });
});
