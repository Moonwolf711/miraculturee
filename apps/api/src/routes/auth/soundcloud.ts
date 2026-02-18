import type { FastifyInstance } from 'fastify';
import { getSoundCloudAuthorizeUrl, exchangeSoundCloudCode, getSoundCloudProfile } from '../../lib/oauth/soundcloud-client.js';
import { ArtistVerificationService } from '../../services/artistVerification.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';

export async function soundcloudOAuthRoutes(app: FastifyInstance) {
  const verificationService = new ArtistVerificationService(app.prisma);

  function isConfigured() {
    return !!(process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET && process.env.SOUNDCLOUD_REDIRECT_URI);
  }

  /** GET /auth/soundcloud/connect — initiate SoundCloud OAuth (requires auth via header or query param) */
  app.get('/connect', async (req, reply) => {
    if (!isConfigured()) {
      return reply.code(503).send({ error: 'SoundCloud integration is not configured yet' });
    }
    const queryToken = (req.query as { token?: string }).token;
    if (queryToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) {
      return reply.code(403).send({ error: 'Artist profile required' });
    }

    const state = app.jwt.sign({ userId: req.user.id, artistId: artist.id, provider: 'soundcloud' } as any, { expiresIn: '10m' });
    const url = getSoundCloudAuthorizeUrl(state);
    return reply.redirect(url);
  });

  /** GET /auth/soundcloud/callback — SoundCloud redirects here after user authorizes */
  app.get('/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error || !code || !state) {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=soundcloud_denied`);
    }

    let payload: { userId: string; artistId: string; provider: string };
    try {
      payload = app.jwt.verify<{ userId: string; artistId: string; provider: string }>(state);
    } catch {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    if (payload.provider !== 'soundcloud') {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    try {
      const tokens = await exchangeSoundCloudCode(code);
      const profile = await getSoundCloudProfile(tokens.access_token);

      await verificationService.connectSocialAccount(payload.artistId, {
        provider: 'SOUNDCLOUD',
        providerUserId: String(profile.id),
        providerUsername: profile.username,
        profileUrl: profile.permalink_url,
        followerCount: profile.followers_count,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        scopes: tokens.scope ?? null,
        rawProfile: profile,
      });

      return reply.redirect(`${FRONTEND_URL}/artist/verify?verified=soundcloud`);
    } catch (err) {
      app.log.error(err, 'SoundCloud OAuth callback failed');
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=soundcloud_failed`);
    }
  });
}
