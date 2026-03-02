import type { FastifyInstance } from 'fastify';
import { getSpotifyAuthorizeUrl, exchangeSpotifyCode, getSpotifyProfile, getSpotifyArtistById } from '../../lib/oauth/spotify-client.js';
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

    // Accept optional Spotify artist ID from query param (parsed from artist URL on frontend)
    const spotifyArtistId = (req.query as { spotifyArtistId?: string }).spotifyArtistId || '';

    const state = app.jwt.sign(
      { userId: req.user.id, artistId: artist.id, provider: 'spotify', spotifyArtistId } as any,
      { expiresIn: '10m' },
    );
    const url = getSpotifyAuthorizeUrl(state);
    return reply.redirect(url);
  });

  /** GET /auth/spotify/callback — Spotify redirects here after user authorizes */
  app.get('/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error || !code || !state) {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=spotify_denied`);
    }

    let payload: { userId: string; artistId: string; provider: string; spotifyArtistId?: string };
    try {
      payload = app.jwt.verify<typeof payload>(state);
    } catch {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    if (payload.provider !== 'spotify') {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    try {
      const tokens = await exchangeSpotifyCode(code);
      const userProfile = await getSpotifyProfile(tokens.access_token);

      // If the user provided their Spotify artist ID, fetch that specific artist profile
      let artistProfile: { id: string; name: string; external_urls: { spotify: string }; followers: { total: number }; images: { url: string }[]; genres: string[] } | null = null;
      if (payload.spotifyArtistId) {
        artistProfile = await getSpotifyArtistById(tokens.access_token, payload.spotifyArtistId);
      }

      // Use artist profile if available, otherwise fall back to personal profile
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

      // Update artist record with Spotify artist ID and name
      const verifiedName = artistProfile?.name || '';
      await app.prisma.artist.update({
        where: { id: payload.artistId },
        data: {
          spotifyArtistId: providerUserId,
          ...(verifiedName ? { stageName: verifiedName } : {}),
        },
      }).catch(() => {});

      // Match events using verified artist name or existing stageName
      const artist = await app.prisma.artist.findUnique({ where: { id: payload.artistId } });
      const matchName = artist?.stageName || '';
      const matches = matchName
        ? await matchingService.findMatchingEvents(matchName, payload.artistId)
        : [];

      return reply.redirect(`${FRONTEND_URL}/artist/verify?verified=spotify&matches=${matches.length}`);
    } catch (err) {
      app.log.error(err, 'Spotify OAuth callback failed');
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=spotify_failed`);
    }
  });
}
