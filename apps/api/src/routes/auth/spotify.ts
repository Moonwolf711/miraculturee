import type { FastifyInstance } from 'fastify';
import { getSpotifyAuthorizeUrl, exchangeSpotifyCode, getSpotifyProfile, searchSpotifyArtist } from '../../lib/oauth/spotify-client.js';
import { ArtistVerificationService } from '../../services/artistVerification.js';
import { ArtistMatchingService } from '../../services/artist-matching.service.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';

export async function spotifyOAuthRoutes(app: FastifyInstance) {
  const verificationService = new ArtistVerificationService(app.prisma);
  const matchingService = new ArtistMatchingService(app.prisma);

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

    // Auto-create artist profile if one doesn't exist yet
    let artist = await app.prisma.artist.findUnique({ where: { userId: req.user.id } });
    if (!artist) {
      const user = await app.prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return reply.code(401).send({ error: 'User not found' });
      [, artist] = await app.prisma.$transaction([
        app.prisma.user.update({ where: { id: user.id }, data: { role: 'ARTIST' } }),
        app.prisma.artist.create({ data: { userId: user.id, stageName: user.name || 'Artist' } }),
      ]);
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
      const userProfile = await getSpotifyProfile(tokens.access_token);

      // Look up the artist's existing stage name to search Spotify for the artist profile
      const existingArtist = await app.prisma.artist.findUnique({ where: { id: payload.artistId } });
      const searchName = existingArtist?.stageName || userProfile.display_name || '';

      // Search Spotify for the actual artist profile (not the personal user profile)
      const artistProfile = await searchSpotifyArtist(tokens.access_token, searchName);

      // Use artist profile data if found, fall back to user profile
      const providerUserId = artistProfile?.id || userProfile.id;
      const providerUsername = artistProfile?.name || userProfile.display_name;
      const profileUrl = artistProfile?.external_urls?.spotify || userProfile?.external_urls?.spotify || '';
      const followerCount = artistProfile?.followers?.total ?? userProfile?.followers?.total ?? 0;

      await verificationService.connectSocialAccount(payload.artistId, {
        provider: 'SPOTIFY',
        providerUserId,
        providerUsername,
        profileUrl,
        followerCount,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope,
        rawProfile: artistProfile ?? userProfile,
      });

      // Update stageName to the Spotify artist name (authoritative identity)
      const verifiedName = artistProfile?.name || '';
      if (verifiedName) {
        await app.prisma.artist.update({
          where: { id: payload.artistId },
          data: {
            spotifyArtistId: providerUserId,
            stageName: verifiedName,
          },
        }).catch(() => {});
      } else {
        // No artist profile found — still store the Spotify user ID but don't overwrite stageName
        await app.prisma.artist.update({
          where: { id: payload.artistId },
          data: { spotifyArtistId: userProfile.id },
        }).catch(() => {});
      }

      // Match events using Spotify-verified artist name (not self-entered, not personal account name)
      const matchName = verifiedName || searchName;
      const matches = await matchingService.findMatchingEvents(matchName, payload.artistId);

      return reply.redirect(`${FRONTEND_URL}/artist/verify?verified=spotify&matches=${matches.length}`);
    } catch (err) {
      app.log.error(err, 'Spotify OAuth callback failed');
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=spotify_failed`);
    }
  });
}
