/**
 * Stripe Connect Routes
 *
 * This module implements a full Stripe Connect integration using the V2 Accounts API.
 * It handles:
 *   1. Creating Connected Accounts (V2 API)
 *   2. Onboarding via Account Links
 *   3. Checking onboarding/payment readiness status
 *   4. Creating products on connected accounts
 *   5. Listing products for a storefront
 *   6. Processing direct charges with application fees via Checkout
 *   7. Creating subscriptions charged to connected accounts
 *   8. Billing portal for subscription management
 *
 * All Stripe calls use a single StripeClient instance ("stripeClient") as recommended
 * by the Stripe SDK. The API version (2026-01-28.clover) is handled automatically
 * by the SDK — you do NOT need to set it manually.
 */

import type { FastifyInstance } from 'fastify';
import Stripe from 'stripe';

export async function connectRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────────────────────────────────────────────
  // STRIPE CLIENT SETUP
  //
  // Create a single Stripe client instance for all requests in this module.
  // The secret key is read from the STRIPE_SECRET_KEY environment variable.
  //
  // PLACEHOLDER: Set STRIPE_SECRET_KEY in your environment variables.
  //   - Test mode: sk_test_...
  //   - Live mode: sk_live_...
  //
  // The SDK automatically uses the latest API version (2026-01-28.clover),
  // so we do NOT pass an apiVersion parameter.
  // ─────────────────────────────────────────────────────────────────────────────
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Please add it to your environment variables. ' +
      'You can find your secret key at https://dashboard.stripe.com/apikeys'
    );
  }
  const stripeClient = new Stripe(stripeSecretKey);

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER: Get the base URL for redirects (account links, checkout, etc.)
  // In production, this should be your actual domain. Falls back to localhost.
  // ─────────────────────────────────────────────────────────────────────────────
  const getBaseUrl = () => process.env.CONNECT_BASE_URL || process.env.WEB_URL || 'http://localhost:5173';

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER: Subscription price ID for the platform subscription product.
  //
  // PLACEHOLDER: Set CONNECT_SUBSCRIPTION_PRICE_ID in your environment variables.
  // Create a subscription product + price in your Stripe dashboard:
  //   1. Go to https://dashboard.stripe.com/products
  //   2. Create a recurring product (e.g., "MiraCulture Pro Plan")
  //   3. Copy the price ID (price_...) and set it as this env var.
  //
  // If not set, subscription endpoints will return a helpful error.
  // ─────────────────────────────────────────────────────────────────────────────
  const getSubscriptionPriceId = () => {
    const priceId = process.env.CONNECT_SUBSCRIPTION_PRICE_ID;
    if (!priceId) {
      throw Object.assign(
        new Error(
          'CONNECT_SUBSCRIPTION_PRICE_ID is not set. Create a recurring price in your ' +
          'Stripe dashboard (https://dashboard.stripe.com/products) and set the price ID ' +
          '(price_...) as this environment variable.'
        ),
        { statusCode: 500 },
      );
    }
    return priceId;
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. CREATE CONNECTED ACCOUNT
  //
  // Creates a new Stripe Connected Account using the V2 API.
  // This stores the account in our DB linked to the authenticated user.
  //
  // IMPORTANT: We use the V2 accounts API (stripeClient.v2.core.accounts.create).
  // Do NOT pass `type: 'express'` or `type: 'standard'` — V2 accounts do not use
  // top-level type. Instead, we configure capabilities via the `configuration` object.
  //
  // The account is created with:
  //   - dashboard: 'full' — the connected account gets access to the full Stripe dashboard
  //   - fees_collector/losses_collector: 'stripe' — Stripe handles fees and losses
  //   - card_payments capability requested on the merchant configuration
  //   - customer configuration enabled (for subscriptions)
  //
  // POST /connect/accounts
  // Body: { displayName: string, contactEmail: string }
  // ═══════════════════════════════════════════════════════════════════════════════
  app.post('/accounts', async (req, reply) => {
    const { displayName, contactEmail } = req.body as {
      displayName: string;
      contactEmail: string;
    };

    if (!displayName || !contactEmail) {
      return reply.code(400).send({ error: 'displayName and contactEmail are required' });
    }

    // Check if this user already has a connected account
    const existing = await app.prisma.connectedAccount.findFirst({
      where: { userId: (req as any).user?.id },
    });
    if (existing) {
      return reply.code(409).send({
        error: 'You already have a connected account',
        accountId: existing.stripeAccountId,
      });
    }

    // ─── Create the V2 Connected Account ───
    // Uses the V2 API with the exact properties specified.
    // Note: Do NOT add `type: 'express'` or any top-level type — V2 accounts
    // use configuration objects instead of the legacy type field.
    const account = await (stripeClient as any).v2.core.accounts.create({
      // Display name shown to the connected account's customers
      display_name: displayName,

      // Contact email for the connected account
      contact_email: contactEmail,

      // Identity configuration — sets the country for the account
      identity: {
        country: 'us',
      },

      // Give the connected account access to the full Stripe dashboard
      dashboard: 'full',

      // Platform defaults — Stripe collects fees and handles losses
      defaults: {
        responsibilities: {
          fees_collector: 'stripe',
          losses_collector: 'stripe',
        },
      },

      // Configuration for the account's capabilities
      configuration: {
        // Enable customer features (needed for subscriptions)
        customer: {},

        // Enable merchant features with card_payments capability
        merchant: {
          capabilities: {
            card_payments: {
              requested: true,
            },
          },
        },
      },
    });

    // ─── Store the mapping in our database ───
    // This links the MiraCulture user to their Stripe Connected Account ID.
    const connectedAccount = await app.prisma.connectedAccount.create({
      data: {
        userId: (req as any).user?.id ?? 'anonymous', // In production, require auth
        stripeAccountId: account.id,
        displayName,
      },
    });

    return reply.code(201).send({
      success: true,
      accountId: account.id,
      connectedAccount,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. CREATE ACCOUNT LINK (ONBOARDING)
  //
  // Generates a Stripe Account Link URL that redirects the connected account
  // to Stripe's hosted onboarding flow. After completing onboarding, they are
  // redirected back to our return_url.
  //
  // Uses the V2 account links API (stripeClient.v2.core.accountLinks.create).
  // The use_case specifies 'account_onboarding' with both merchant and customer
  // configurations, so the user completes onboarding for both in one flow.
  //
  // POST /connect/accounts/:accountId/onboarding-link
  // ═══════════════════════════════════════════════════════════════════════════════
  app.post('/accounts/:accountId/onboarding-link', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    const baseUrl = getBaseUrl();

    // Create the V2 account link for onboarding
    const accountLink = await (stripeClient as any).v2.core.accountLinks.create({
      // The connected account ID to onboard
      account: accountId,

      use_case: {
        // Type of link — 'account_onboarding' starts the onboarding flow
        type: 'account_onboarding',

        account_onboarding: {
          // Which configurations to onboard — both merchant (payments) and customer (subscriptions)
          configurations: ['merchant', 'customer'],

          // Where to redirect if the link expires or the user needs to restart
          refresh_url: `${baseUrl}/connect/dashboard?accountId=${accountId}&refresh=true`,

          // Where to redirect after successful onboarding completion
          return_url: `${baseUrl}/connect/dashboard?accountId=${accountId}`,
        },
      },
    });

    return reply.send({
      url: accountLink.url,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. CHECK ACCOUNT STATUS
  //
  // Retrieves the current status of a connected account directly from the Stripe API.
  // For this demo, we always fetch fresh status from the API (not from DB cache).
  //
  // This checks:
  //   - Whether card_payments capability is active (ready to process payments)
  //   - Whether onboarding requirements are satisfied (no currently_due or past_due)
  //
  // GET /connect/accounts/:accountId/status
  // ═══════════════════════════════════════════════════════════════════════════════
  app.get('/accounts/:accountId/status', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };

    // Retrieve the V2 account with expanded configuration and requirements.
    // The `include` parameter tells Stripe to return the full merchant config
    // and requirements details in the response.
    const account = await (stripeClient as any).v2.core.accounts.retrieve(accountId, {
      include: ['configuration.merchant', 'requirements'],
    });

    // ─── Check if card_payments capability is active ───
    // This means the account can accept card payments from customers.
    const readyToProcessPayments =
      account?.configuration?.merchant?.capabilities?.card_payments?.status === 'active';

    // ─── Check onboarding completion ───
    // Requirements have a summary with a minimum_deadline status.
    // If the status is 'currently_due' or 'past_due', onboarding is incomplete
    // and the account needs to provide more information.
    const requirementsStatus = account.requirements?.summary?.minimum_deadline?.status;
    const onboardingComplete =
      requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';

    // Update our local DB with the latest status
    await app.prisma.connectedAccount.updateMany({
      where: { stripeAccountId: accountId },
      data: {
        onboardingComplete,
        paymentsEnabled: readyToProcessPayments,
      },
    });

    return reply.send({
      accountId,
      readyToProcessPayments,
      onboardingComplete,
      requirementsStatus: requirementsStatus ?? 'none',
      // Include raw requirements for debugging
      requirements: account.requirements ?? null,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. CREATE PRODUCT ON CONNECTED ACCOUNT
  //
  // Creates a Stripe Product with a default price on the connected account.
  // Uses the Stripe-Account header (via stripeAccount option) to create the
  // product on behalf of the connected account — not on the platform account.
  //
  // POST /connect/accounts/:accountId/products
  // Body: { name: string, description?: string, priceInCents: number, currency?: string }
  // ═══════════════════════════════════════════════════════════════════════════════
  app.post('/accounts/:accountId/products', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    const { name, description, priceInCents, currency } = req.body as {
      name: string;
      description?: string;
      priceInCents: number;
      currency?: string;
    };

    if (!name || !priceInCents) {
      return reply.code(400).send({ error: 'name and priceInCents are required' });
    }

    // Create the product on the connected account.
    // The `stripeAccount` option in the second argument sets the Stripe-Account
    // header, which tells Stripe to create the product on the connected account
    // rather than on the platform account.
    const product = await stripeClient.products.create(
      {
        name,
        description: description || undefined,
        // default_price_data creates a Price object alongside the Product
        default_price_data: {
          unit_amount: priceInCents,
          currency: currency || 'usd',
        },
      },
      {
        // This sets the Stripe-Account header — the product is created on
        // the connected account, NOT the platform account.
        stripeAccount: accountId,
      },
    );

    return reply.code(201).send({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        defaultPriceId: typeof product.default_price === 'string'
          ? product.default_price
          : product.default_price?.id,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. LIST PRODUCTS ON CONNECTED ACCOUNT (STOREFRONT)
  //
  // Retrieves all active products from a connected account for display on a
  // public storefront page. Expands the default_price so we have pricing info.
  //
  // Uses the Stripe-Account header (stripeAccount) to read from the connected
  // account's product catalog.
  //
  // GET /connect/storefront/:accountId/products
  //
  // NOTE: In production, you should use a different identifier (like a slug or
  // username) instead of exposing the Stripe account ID in the URL. The account ID
  // is used here for demo simplicity.
  // ═══════════════════════════════════════════════════════════════════════════════
  app.get('/storefront/:accountId/products', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };

    // List active products on the connected account with expanded price data.
    // The `expand` parameter tells Stripe to include the full Price object
    // in the response instead of just the price ID string.
    const products = await stripeClient.products.list(
      {
        limit: 20,
        active: true,
        // Expand default_price so we get the full price object (amount, currency)
        expand: ['data.default_price'],
      },
      {
        // Stripe-Account header — read products from the connected account
        stripeAccount: accountId,
      },
    );

    return reply.send({
      accountId,
      products: products.data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        images: p.images,
        defaultPrice: typeof p.default_price === 'object' && p.default_price
          ? {
              id: p.default_price.id,
              unitAmount: p.default_price.unit_amount,
              currency: p.default_price.currency,
            }
          : null,
      })),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. CREATE CHECKOUT SESSION (DIRECT CHARGE)
  //
  // Creates a Stripe Checkout session using a Direct Charge model.
  // The payment goes directly to the connected account, and the platform takes
  // an application fee from the transaction.
  //
  // Direct Charge means:
  //   - The charge appears on the connected account's Stripe dashboard
  //   - The connected account's branding is shown on the checkout page
  //   - The platform receives an application_fee_amount from each charge
  //
  // The checkout session is created ON the connected account (via stripeAccount
  // header), which is what makes it a "direct charge."
  //
  // POST /connect/storefront/:accountId/checkout
  // Body: { productId: string, priceId: string, quantity?: number }
  // ═══════════════════════════════════════════════════════════════════════════════
  app.post('/storefront/:accountId/checkout', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    const { priceId, quantity } = req.body as {
      priceId: string;
      quantity?: number;
    };

    if (!priceId) {
      return reply.code(400).send({ error: 'priceId is required' });
    }

    const baseUrl = getBaseUrl();

    // ─── Fetch the price to calculate the application fee ───
    // We need the unit_amount to compute our platform fee percentage.
    const price = await stripeClient.prices.retrieve(priceId, {
      stripeAccount: accountId,
    });

    // Calculate the application fee — this is how the platform monetizes.
    // Example: 10% of the transaction amount.
    // Adjust this percentage to match your business model.
    const APPLICATION_FEE_PERCENT = 0.10; // 10% platform fee
    const unitAmount = price.unit_amount ?? 0;
    const qty = quantity || 1;
    const applicationFeeAmount = Math.round(unitAmount * qty * APPLICATION_FEE_PERCENT);

    // Create the Checkout Session on the connected account (direct charge).
    // The stripeAccount option in the second argument creates the session
    // ON the connected account — this is what makes it a direct charge.
    const session = await stripeClient.checkout.sessions.create(
      {
        // Line items for the checkout
        line_items: [
          {
            price: priceId,
            quantity: qty,
          },
        ],

        // Payment intent data — this is where we set the application fee
        payment_intent_data: {
          // The platform's cut from this transaction.
          // This amount is transferred to the platform account after the charge.
          application_fee_amount: applicationFeeAmount,
        },

        // 'payment' mode for one-time purchases
        mode: 'payment',

        // Redirect URLs after checkout completion/cancellation
        // {CHECKOUT_SESSION_ID} is a Stripe template variable that gets replaced
        // with the actual session ID.
        success_url: `${baseUrl}/connect/storefront/${accountId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/connect/storefront/${accountId}`,
      },
      {
        // This creates the checkout session ON the connected account (direct charge).
        // Without this, the charge would go to the platform account.
        stripeAccount: accountId,
      },
    );

    return reply.send({ url: session.url });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. CREATE SUBSCRIPTION CHECKOUT
  //
  // Creates a Checkout session for a subscription charged to the connected account.
  // With V2 accounts, we use `customer_account` instead of `customer` — this allows
  // the connected account ID (acct_...) to be used directly as the customer.
  //
  // POST /connect/accounts/:accountId/subscribe
  // ═══════════════════════════════════════════════════════════════════════════════
  app.post('/accounts/:accountId/subscribe', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    const priceId = getSubscriptionPriceId();
    const baseUrl = getBaseUrl();

    // Create a Checkout Session in subscription mode.
    // `customer_account` is the V2 way to reference the connected account
    // as the subscriber — do NOT use `.customer` with V2 accounts.
    // Create a Checkout Session in subscription mode.
    // `customer_account` is V2-only — cast to any because SDK v17 types don't include it yet.
    // When upgrading to Stripe SDK v20+, the cast can be removed.
    const session = await stripeClient.checkout.sessions.create({
      // For V2 accounts, use customer_account instead of customer.
      // The connected account ID (acct_...) serves as both the account and customer.
      customer_account: accountId,

      // Subscription mode — creates a recurring charge
      mode: 'subscription',

      // The subscription product/price to charge
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // Redirect URLs
      success_url: `${baseUrl}/connect/dashboard?accountId=${accountId}&subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/connect/dashboard?accountId=${accountId}&subscription=canceled`,
    } as any);

    return reply.send({ url: session.url });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. CREATE BILLING PORTAL SESSION
  //
  // Creates a Stripe Billing Portal session where the connected account can manage
  // their subscription (upgrade, downgrade, cancel, update payment method).
  //
  // For V2 accounts, use `customer_account` instead of `customer`.
  //
  // POST /connect/accounts/:accountId/billing-portal
  // ═══════════════════════════════════════════════════════════════════════════════
  app.post('/accounts/:accountId/billing-portal', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    const baseUrl = getBaseUrl();

    // Create a Billing Portal session for the connected account.
    // `customer_account` is used instead of `customer` for V2 accounts.
    // `customer_account` is V2-only — cast to any because SDK v17 types don't include it yet.
    const session = await stripeClient.billingPortal.sessions.create({
      // V2 accounts: use customer_account (the connected account ID) instead of customer
      customer_account: accountId,

      // Where to redirect after the user exits the billing portal
      return_url: `${baseUrl}/connect/dashboard?accountId=${accountId}`,
    } as any);

    return reply.send({ url: session.url });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. GET SUBSCRIPTION STATUS
  //
  // Returns the current subscription status for a connected account from our DB.
  //
  // GET /connect/accounts/:accountId/subscription
  // ═══════════════════════════════════════════════════════════════════════════════
  app.get('/accounts/:accountId/subscription', async (req, reply) => {
    const { accountId } = req.params as { accountId: string };

    const connectedAccount = await app.prisma.connectedAccount.findUnique({
      where: { stripeAccountId: accountId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!connectedAccount) {
      return reply.code(404).send({ error: 'Connected account not found' });
    }

    const subscription = connectedAccount.subscriptions[0] ?? null;

    return reply.send({
      accountId,
      subscription: subscription
        ? {
            id: subscription.stripeSubscriptionId,
            status: subscription.status,
            priceId: subscription.priceId,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 10. LIST USER'S CONNECTED ACCOUNTS
  //
  // Returns connected accounts associated with the authenticated user.
  // Used by the dashboard to show the user's accounts.
  //
  // GET /connect/my-accounts
  // ═══════════════════════════════════════════════════════════════════════════════
  app.get('/my-accounts', async (req, reply) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const accounts = await app.prisma.connectedAccount.findMany({
      where: { userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return reply.send({
      accounts: accounts.map((a) => ({
        id: a.id,
        stripeAccountId: a.stripeAccountId,
        displayName: a.displayName,
        onboardingComplete: a.onboardingComplete,
        paymentsEnabled: a.paymentsEnabled,
        subscription: a.subscriptions[0]
          ? {
              status: a.subscriptions[0].status,
              cancelAtPeriodEnd: a.subscriptions[0].cancelAtPeriodEnd,
            }
          : null,
      })),
    });
  });
}
