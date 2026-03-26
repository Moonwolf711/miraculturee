import type { FastifyInstance } from 'fastify';
import { getSpotifyAuthorizeUrl, exchangeSpotifyCode, getSpotifyProfile, getSpotifyArtistById } from '../../lib/oauth/spotify-client.js';
import { ArtistVerificationService } from '../../services/artistVerification.js';
import { ArtistMatchingService } from '../../services/artist-matching.service.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';

/**
 * Normalize a name for comparison: lowercase, strip non-alphanumeric,
 * collapse whitespace. E.g. "DJ Snake" → "dj snake"
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a Spotify user's display name matches the claimed Spotify artist name.
 * Uses exact match after normalization, plus substring containment as a fallback.
 */
function namesMatch(userDisplayName: string | null, artistName: string): boolean {
  if (!userDisplayName) return false;
  const normalUser = normalizeName(userDisplayName);
  const normalArtist = normalizeName(artistName);
  if (!normalUser || !normalArtist) return false;
  // Exact match
  if (normalUser === normalArtist) return true;
  // One contains the other (handles "John Smith" vs "John Smith Music")
  if (normalUser.includes(normalArtist) || normalArtist.includes(normalUser)) return true;
  return false;
}

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

    // Spotify artist ID is optional — if provided, enables ownership verification
    const spotifyArtistId = (req.query as { spotifyArtistId?: string }).spotifyArtistId || null;

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

      // If artist ID was provided, verify ownership
      if (payload.spotifyArtistId) {
        const artistProfile = await getSpotifyArtistById(tokens.access_token, payload.spotifyArtistId);

        if (!artistProfile) {
          app.log.warn(`Spotify artist ID not found: ${payload.spotifyArtistId}`);
          return reply.redirect(`${FRONTEND_URL}/artist/verify?error=artist_not_found`);
        }

        const isNameMatch = namesMatch(userProfile.display_name, artistProfile.name);
        const isIdMatch = userProfile.id === artistProfile.id;

        if (!isNameMatch && !isIdMatch) {
          app.log.warn(
            `Spotify artist verification failed: user "${userProfile.display_name}" (${userProfile.id}) ` +
            `does not match artist "${artistProfile.name}" (${artistProfile.id})`,
          );
          return reply.redirect(
            `${FRONTEND_URL}/artist/verify?error=artist_mismatch` +
            `&artistName=${encodeURIComponent(artistProfile.name)}` +
            `&userName=${encodeURIComponent(userProfile.display_name || '')}`,
          );
        }

        app.log.info(`Spotify artist verified: user "${userProfile.display_name}" matched artist "${artistProfile.name}"`);

        await verificationService.connectSocialAccount(payload.artistId, {
          provider: 'SPOTIFY',
          providerUserId: artistProfile.id,
          providerUsername: artistProfile.name,
          profileUrl: artistProfile.external_urls?.spotify || '',
          followerCount: artistProfile.followers?.total ?? 0,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scopes: tokens.scope,
          rawProfile: { user: userProfile, artist: artistProfile },
        });

        await app.prisma.artist.update({
          where: { id: payload.artistId },
          data: { spotifyArtistId: artistProfile.id, stageName: artistProfile.name },
        }).catch(() => {});

        const matches = await matchingService.findMatchingEvents(artistProfile.name, payload.artistId);
        return reply.redirect(`${FRONTEND_URL}/artist/verify?verified=spotify&matches=${matches.length}`);
      }

      // No artist ID — just connect the Spotify account
      app.log.info(`Spotify connected (no artist verification): user "${userProfile.display_name}"`);

      await verificationService.connectSocialAccount(payload.artistId, {
        provider: 'SPOTIFY',
        providerUserId: userProfile.id,
        providerUsername: userProfile.display_name || '',
        profileUrl: userProfile.external_urls?.spotify || '',
        followerCount: userProfile.followers?.total ?? 0,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope,
        rawProfile: { user: userProfile },
      });

      return reply.redirect(`${FRONTEND_URL}/artist/verify?verified=spotify`);
    } catch (err) {
      app.log.error(err, 'Spotify OAuth callback failed');
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=spotify_failed`);
    }
  });
}
