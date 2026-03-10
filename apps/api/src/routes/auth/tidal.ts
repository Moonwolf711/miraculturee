import type { FastifyInstance } from 'fastify';
import { getTidalAuthorizeUrl, exchangeTidalCode, getTidalProfile, getTidalArtistById, getTidalClientToken } from '../../lib/oauth/tidal-client.js';
import { ArtistVerificationService } from '../../services/artistVerification.js';
import { ArtistMatchingService } from '../../services/artist-matching.service.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mira-culture.com';

/**
 * Normalize a name for comparison: lowercase, strip non-alphanumeric,
 * collapse whitespace.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(userDisplayName: string | null, artistName: string): boolean {
  if (!userDisplayName) return false;
  const normalUser = normalizeName(userDisplayName);
  const normalArtist = normalizeName(artistName);
  if (!normalUser || !normalArtist) return false;
  if (normalUser === normalArtist) return true;
  if (normalUser.includes(normalArtist) || normalArtist.includes(normalUser)) return true;
  return false;
}

export async function tidalOAuthRoutes(app: FastifyInstance) {
  const verificationService = new ArtistVerificationService(app.prisma);
  const matchingService = new ArtistMatchingService(app.prisma);

  function isConfigured() {
    return !!(process.env.TIDAL_CLIENT_ID && process.env.TIDAL_CLIENT_SECRET && process.env.TIDAL_REDIRECT_URI);
  }

  /** GET /auth/tidal/connect — initiate Tidal OAuth */
  app.get('/connect', async (req, reply) => {
    if (!isConfigured()) {
      return reply.code(503).send({ error: 'Tidal integration is not configured yet' });
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

    // Tidal artist ID is REQUIRED — artist must provide their artist page URL
    const tidalArtistId = (req.query as { tidalArtistId?: string }).tidalArtistId;
    if (!tidalArtistId) {
      return reply.code(400).send({
        error: 'Tidal artist URL is required. Paste your Tidal artist page link to verify.',
      });
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

    const state = app.jwt.sign(
      { userId: req.user.id, artistId: artist.id, provider: 'tidal', tidalArtistId } as any,
      { expiresIn: '10m' },
    );
    const url = getTidalAuthorizeUrl(state);
    return reply.redirect(url);
  });

  /** GET /auth/tidal/callback — Tidal redirects here after user authorizes */
  app.get('/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error || !code || !state) {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=tidal_denied`);
    }

    let payload: { userId: string; artistId: string; provider: string; tidalArtistId?: string };
    try {
      payload = app.jwt.verify<typeof payload>(state);
    } catch {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    if (payload.provider !== 'tidal') {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=invalid_state`);
    }

    if (!payload.tidalArtistId) {
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=missing_artist_url`);
    }

    try {
      const tokens = await exchangeTidalCode(code);
      const userProfile = await getTidalProfile(tokens.access_token);

      // Get a client token for public API calls (artist lookup)
      const clientToken = await getTidalClientToken();

      // Fetch the claimed Tidal artist profile
      const artistProfile = await getTidalArtistById(clientToken, payload.tidalArtistId);

      if (!artistProfile) {
        app.log.warn(`Tidal artist ID not found: ${payload.tidalArtistId}`);
        return reply.redirect(`${FRONTEND_URL}/artist/verify?error=artist_not_found`);
      }

      // ── Artist ownership verification ──
      const userDisplayName = userProfile.username || `${userProfile.firstName} ${userProfile.lastName}`.trim();
      const isNameMatch = namesMatch(userDisplayName, artistProfile.name);
      const isIdMatch = String(userProfile.id) === String(artistProfile.id);

      if (!isNameMatch && !isIdMatch) {
        app.log.warn(
          `Tidal artist verification failed: user "${userDisplayName}" (${userProfile.id}) ` +
          `does not match artist "${artistProfile.name}" (${artistProfile.id})`,
        );
        return reply.redirect(
          `${FRONTEND_URL}/artist/verify?error=artist_mismatch` +
          `&artistName=${encodeURIComponent(artistProfile.name)}` +
          `&userName=${encodeURIComponent(userDisplayName)}`,
        );
      }

      app.log.info(
        `Tidal artist verified: user "${userDisplayName}" matched artist "${artistProfile.name}"`,
      );

      // Verification passed — save the connection
      await verificationService.connectSocialAccount(payload.artistId, {
        provider: 'TIDAL',
        providerUserId: artistProfile.id,
        providerUsername: artistProfile.name,
        profileUrl: artistProfile.url,
        followerCount: artistProfile.popularity ?? 0,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: 'user.read',
        rawProfile: { user: userProfile, artist: artistProfile },
      });

      // Update artist record with verified Tidal artist ID and name
      await app.prisma.artist.update({
        where: { id: payload.artistId },
        data: { stageName: artistProfile.name },
      }).catch(() => {});

      // Match events using the verified artist name
      const matches = await matchingService.findMatchingEvents(artistProfile.name, payload.artistId);

      return reply.redirect(`${FRONTEND_URL}/artist/verify?verified=tidal&matches=${matches.length}`);
    } catch (err) {
      app.log.error(err, 'Tidal OAuth callback failed');
      return reply.redirect(`${FRONTEND_URL}/artist/verify?error=tidal_failed`);
    }
  });
}
