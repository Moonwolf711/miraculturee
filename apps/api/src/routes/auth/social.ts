import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { hash } from 'bcrypt';
import {
  Google,
  Facebook,
  Apple,
  MicrosoftEntraId,
  generateCodeVerifier,
  generateState,
  decodeIdToken,
  type OAuth2Tokens,
} from 'arctic';
import type { UserPayload } from '@miraculturee/shared';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';
const API_URL = process.env.API_URL || 'https://miracultureeapi-production-cca9.up.railway.app';
const SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// In-memory OAuth state store (10-minute TTL). Fine for MVP; swap for Redis
// in production if running multiple instances.
// ---------------------------------------------------------------------------
interface OAuthStateEntry {
  codeVerifier: string;
  expiresAt: number;
}

const stateStore = new Map<string, OAuthStateEntry>();

function storeState(state: string, codeVerifier: string): void {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  stateStore.set(state, { codeVerifier, expiresAt });
}

function consumeState(state: string): OAuthStateEntry | null {
  const entry = stateStore.get(state);
  if (!entry) return null;
  stateStore.delete(state);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of stateStore) {
    if (now > entry.expiresAt) stateStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Helper: login-or-register via SocialLogin table
// ---------------------------------------------------------------------------
async function loginOrRegister(
  app: FastifyInstance,
  provider: string,
  profile: { providerUserId: string; email: string; name: string; avatarUrl?: string | null },
): Promise<{ accessToken: string; refreshToken: string }> {
  const { providerUserId, email, name, avatarUrl } = profile;

  // 1) Existing SocialLogin? -> issue tokens for that user
  const existing = await app.prisma.socialLogin.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
    include: { user: true },
  });

  if (existing) {
    return generateTokens(app, existing.user);
  }

  // 2) User with same email? -> link SocialLogin to existing user
  const userByEmail = await app.prisma.user.findUnique({ where: { email } });

  if (userByEmail) {
    await app.prisma.socialLogin.create({
      data: { userId: userByEmail.id, provider, providerUserId, email, name, avatarUrl },
    });
    return generateTokens(app, userByEmail);
  }

  // 3) Brand-new user -> create User + SocialLogin
  const randomPassword = randomBytes(32).toString('hex');
  const passwordHash = await hash(randomPassword, SALT_ROUNDS);

  const newUser = await app.prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || email.split('@')[0],
      role: 'FAN',
      emailVerified: true,
    },
  });

  await app.prisma.socialLogin.create({
    data: { userId: newUser.id, provider, providerUserId, email, name, avatarUrl },
  });

  return generateTokens(app, newUser);
}

async function generateTokens(
  app: FastifyInstance,
  user: { id: string; email: string; role: string },
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: UserPayload = { id: user.id, email: user.email, role: user.role as UserPayload['role'] };
  const accessToken = app.jwt.sign(payload);
  const refreshToken = app.jwt.sign(payload, { expiresIn: '7d' });

  await app.prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------------------
// Redirect helper: sends user back to frontend with tokens (or error)
// ---------------------------------------------------------------------------
function redirectWithTokens(
  reply: any,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const url = `${FRONTEND_URL}/auth/callback?accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;
  (reply as any).redirect(url);
}

function redirectWithError(reply: any, error: string): void {
  (reply as any).redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(error)}`);
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
export async function socialOAuthRoutes(app: FastifyInstance) {
  const callbackRateLimit = { max: 10, timeWindow: '1 minute' };

  // =========================================================================
  // GOOGLE
  // =========================================================================
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const google = new Google(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${API_URL}/auth/google/callback`,
    );

    app.get('/google/redirect', async (_req, reply) => {
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      storeState(state, codeVerifier);

      const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
      return reply.redirect(url.toString());
    });

    app.get('/google/callback', { config: { rateLimit: callbackRateLimit } }, async (req, reply) => {
      const { code, state } = req.query as { code?: string; state?: string };

      if (!code || !state) {
        return redirectWithError(reply, 'google_denied');
      }

      const entry = consumeState(state);
      if (!entry) {
        return redirectWithError(reply, 'invalid_state');
      }

      try {
        const tokens: OAuth2Tokens = await google.validateAuthorizationCode(code, entry.codeVerifier);
        const idToken = tokens.idToken();
        const claims = decodeIdToken(idToken) as {
          sub: string;
          email: string;
          name?: string;
          picture?: string;
        };

        const result = await loginOrRegister(app, 'google', {
          providerUserId: claims.sub,
          email: claims.email,
          name: claims.name || '',
          avatarUrl: claims.picture || null,
        });

        return redirectWithTokens(reply, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        app.log.error({ err, detail: msg }, 'Google OAuth callback failed');
        return redirectWithError(reply, 'google_failed');
      }
    });

    app.log.info('Social OAuth: Google routes registered');
  }

  // =========================================================================
  // FACEBOOK
  // =========================================================================
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    const facebook = new Facebook(
      process.env.FACEBOOK_CLIENT_ID,
      process.env.FACEBOOK_CLIENT_SECRET,
      `${API_URL}/auth/facebook/callback`,
    );

    app.get('/facebook/redirect', async (_req, reply) => {
      const state = generateState();
      storeState(state, '');

      const url = facebook.createAuthorizationURL(state, ['email', 'public_profile']);
      return reply.redirect(url.toString());
    });

    app.get('/facebook/callback', { config: { rateLimit: callbackRateLimit } }, async (req, reply) => {
      const { code, state } = req.query as { code?: string; state?: string };

      if (!code || !state) {
        return redirectWithError(reply, 'facebook_denied');
      }

      const entry = consumeState(state);
      if (!entry) {
        return redirectWithError(reply, 'invalid_state');
      }

      try {
        const tokens: OAuth2Tokens = await facebook.validateAuthorizationCode(code);
        const accessToken = tokens.accessToken();

        // Fetch profile from Graph API
        const profileRes = await fetch(
          `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
        );
        if (!profileRes.ok) {
          throw new Error(`Facebook profile fetch failed: ${profileRes.status}`);
        }
        const profile = (await profileRes.json()) as {
          id: string;
          name?: string;
          email?: string;
          picture?: { data?: { url?: string } };
        };

        if (!profile.email) {
          return redirectWithError(reply, 'facebook_no_email');
        }

        const result = await loginOrRegister(app, 'facebook', {
          providerUserId: profile.id,
          email: profile.email,
          name: profile.name || '',
          avatarUrl: profile.picture?.data?.url || null,
        });

        return redirectWithTokens(reply, result);
      } catch (err) {
        app.log.error(err, 'Facebook OAuth callback failed');
        return redirectWithError(reply, 'facebook_failed');
      }
    });

    app.log.info('Social OAuth: Facebook routes registered');
  }

  // =========================================================================
  // APPLE
  // =========================================================================
  if (
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  ) {
    const apple = new Apple(
      process.env.APPLE_CLIENT_ID,
      process.env.APPLE_TEAM_ID,
      process.env.APPLE_KEY_ID,
      new TextEncoder().encode(process.env.APPLE_PRIVATE_KEY),
      `${API_URL}/auth/apple/callback`,
    );

    app.get('/apple/redirect', async (_req, reply) => {
      const state = generateState();
      storeState(state, '');

      const url = apple.createAuthorizationURL(state, ['name', 'email']);
      return reply.redirect(url.toString());
    });

    app.get('/apple/callback', { config: { rateLimit: callbackRateLimit } }, async (req, reply) => {
      const { code, state } = req.query as { code?: string; state?: string };

      if (!code || !state) {
        return redirectWithError(reply, 'apple_denied');
      }

      const entry = consumeState(state);
      if (!entry) {
        return redirectWithError(reply, 'invalid_state');
      }

      try {
        const tokens: OAuth2Tokens = await apple.validateAuthorizationCode(code);
        const idToken = tokens.idToken();
        const claims = decodeIdToken(idToken) as {
          sub: string;
          email?: string;
          name?: string;
        };

        if (!claims.email) {
          return redirectWithError(reply, 'apple_no_email');
        }

        const result = await loginOrRegister(app, 'apple', {
          providerUserId: claims.sub,
          email: claims.email,
          name: claims.name || '',
          avatarUrl: null,
        });

        return redirectWithTokens(reply, result);
      } catch (err) {
        app.log.error(err, 'Apple OAuth callback failed');
        return redirectWithError(reply, 'apple_failed');
      }
    });

    app.log.info('Social OAuth: Apple routes registered');
  }

  // =========================================================================
  // MICROSOFT (Entra ID)
  // =========================================================================
  if (
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_TENANT_ID
  ) {
    const microsoft = new MicrosoftEntraId(
      process.env.MICROSOFT_TENANT_ID,
      process.env.MICROSOFT_CLIENT_ID,
      process.env.MICROSOFT_CLIENT_SECRET,
      `${API_URL}/auth/microsoft/callback`,
    );

    app.get('/microsoft/redirect', async (_req, reply) => {
      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      storeState(state, codeVerifier);

      const url = microsoft.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
      return reply.redirect(url.toString());
    });

    app.get('/microsoft/callback', { config: { rateLimit: callbackRateLimit } }, async (req, reply) => {
      const { code, state } = req.query as { code?: string; state?: string };

      if (!code || !state) {
        return redirectWithError(reply, 'microsoft_denied');
      }

      const entry = consumeState(state);
      if (!entry) {
        return redirectWithError(reply, 'invalid_state');
      }

      try {
        const tokens: OAuth2Tokens = await microsoft.validateAuthorizationCode(code, entry.codeVerifier);
        const accessToken = tokens.accessToken();

        // Fetch profile from Microsoft Graph
        const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!profileRes.ok) {
          throw new Error(`Microsoft profile fetch failed: ${profileRes.status}`);
        }
        const profile = (await profileRes.json()) as {
          id: string;
          displayName?: string;
          mail?: string;
          userPrincipalName?: string;
        };

        const email = profile.mail || profile.userPrincipalName;
        if (!email) {
          return redirectWithError(reply, 'microsoft_no_email');
        }

        const result = await loginOrRegister(app, 'microsoft', {
          providerUserId: profile.id,
          email,
          name: profile.displayName || '',
          avatarUrl: null,
        });

        return redirectWithTokens(reply, result);
      } catch (err) {
        app.log.error(err, 'Microsoft OAuth callback failed');
        return redirectWithError(reply, 'microsoft_failed');
      }
    });

    app.log.info('Social OAuth: Microsoft routes registered');
  }
}
