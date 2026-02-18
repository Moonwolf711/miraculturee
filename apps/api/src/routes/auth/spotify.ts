import type { FastifyInstance } from 'fastify';
import { getSpotifyAuthorizeUrl, exchangeSpotifyCode, getSpotifyProfile } from '../../lib/oauth/spotify-client.js';
import { ArtistVerificationService } from '../../services/artistVerification.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';

export async function spotifyOAuthRoutes(app: FastifyInstance) {
  const verificationService = new ArtistVerificationService(app.prisma);

  function isConfigured() {
    return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REDIRECT_URI);
  }

  /** GET /auth/spotify/connect — initiate Spotify OAuth (requires auth via header or query param) */
  app.get('/connect', async (req, reply) => {
    if (!isConfigured()) {
      return reply.code(503).send({ error: 'Spotify integration is not configured yet' });
    }
    // Support JWT from Authorization header or ?token= query param (for redirect flows)
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

    const state = app.jwt.sign({ userId: req.user.id, artistId: artist.id, provider: 'spotify' } as any, { expiresIn: '10m' });
    const url = getSpotifyAuthorizeUrl(state);
    return reply.redirect(url);
  });

  /** GET /auth/spotify/callback — Spotify redirects here after user authorizes */
  app.get('/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error || !code || !state) {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=spotify_denied`);
    }

    let payload: { userId: string; artistId: string; provider: string };
    try {
      payload = app.jwt.verify<{ userId: string; artistId: string; provider: string }>(state);
    } catch {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    if (payload.provider !== 'spotify') {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    try {
      const tokens = await exchangeSpotifyCode(code);
      const profile = await getSpotifyProfile(tokens.access_token);

      await verificationService.connectSocialAccount(payload.artistId, {
        provider: 'SPOTIFY',
        providerUserId: profile.id,
        providerUsername: profile.display_name,
        profileUrl: profile.external_urls.spotify,
        followerCount: profile.followers.total,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope,
        rawProfile: profile,
      });

      return reply.redirect(`${FRONTEND_URL}/artist/verify?verified=spotify`);
    } catch (err) {
      app.log.error(err, 'Spotify OAuth callback failed');
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=spotify_failed`);
    }
  });
}
