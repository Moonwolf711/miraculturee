import Stripe from 'stripe';

let instance: Stripe | null = null;

/**
 * Returns a singleton Stripe client. Throws if STRIPE_SECRET_KEY is missing.
 * All modules should import this instead of creating their own `new Stripe()`.
 */
export function getStripeClient(): Stripe {
  if (!instance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is not set. Please add it to your environment variables. ' +
        'You can find your secret key at https://dashboard.stripe.com/apikeys',
      );
    }
    instance = new Stripe(key);
  }
  return instance;
}
