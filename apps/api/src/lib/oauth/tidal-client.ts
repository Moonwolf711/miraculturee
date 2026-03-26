import crypto from 'node:crypto';

const TIDAL_AUTH_URL = 'https://login.tidal.com/authorize';
const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const TIDAL_API_URL = 'https://openapi.tidal.com';

export function getTidalConfig() {
  const clientId = process.env.TIDAL_CLIENT_ID;
  const clientSecret = process.env.TIDAL_CLIENT_SECRET;
  const redirectUri = process.env.TIDAL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing TIDAL_CLIENT_ID, TIDAL_CLIENT_SECRET, or TIDAL_REDIRECT_URI');
  }
  return { clientId, clientSecret, redirectUri };
}

/** Generate PKCE code_verifier and code_challenge (S256) */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function getTidalAuthorizeUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = getTidalConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'user.read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${TIDAL_AUTH_URL}?${params.toString()}`;
}

export async function exchangeTidalCode(code: string, codeVerifier: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const { clientId, clientSecret, redirectUri } = getTidalConfig();
  const res = await fetch(TIDAL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tidal token exchange failed (${res.status}): ${err}`);
  }
  return res.json();
}

export async function getTidalProfile(accessToken: string): Promise<{
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
}> {
  // Use the OpenAPI userInfo endpoint (works with user.read scope)
  const res = await fetch('https://openapi.tidal.com/v2/userInfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (res.ok) {
    const data = await res.json();
    return {
      id: String(data.userId ?? data.uid ?? data.sub ?? ''),
      username: data.username ?? data.email ?? '',
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      email: data.email ?? '',
      countryCode: data.countryCode ?? '',
    };
  }

  // Fallback: try the login.tidal.com userinfo (standard OIDC)
  const res2 = await fetch('https://login.tidal.com/oauth2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res2.ok) {
    const data = await res2.json();
    return {
      id: String(data.sub ?? data.uid ?? ''),
      username: data.preferred_username ?? data.email ?? '',
      firstName: data.given_name ?? '',
      lastName: data.family_name ?? '',
      email: data.email ?? '',
      countryCode: '',
    };
  }

  const err = await res2.text();
  throw new Error(`Tidal profile fetch failed (${res.status}/${res2.status}): ${err}`);
}

/** Search Tidal for an artist by name using the public API. */
export async function searchTidalArtist(clientToken: string, artistName: string): Promise<{
  id: string;
  name: string;
  url: string;
  popularity: number;
} | null> {
  const { clientId } = getTidalConfig();
  const params = new URLSearchParams({
    query: artistName,
    countryCode: 'US',
  });
  // Use client credentials token for search (public catalog)
  const res = await fetch(`${TIDAL_API_URL}/v2/searchresults/${encodeURIComponent(artistName)}?countryCode=US`, {
    headers: {
      Authorization: `Bearer ${clientToken}`,
      'Content-Type': 'application/vnd.tidal.v1+json',
    },
  });
  if (!res.ok) {
    // Fallback: try v1 search API
    const res2 = await fetch(`https://api.tidal.com/v1/search/artists?query=${encodeURIComponent(artistName)}&limit=5&countryCode=US`, {
      headers: { 'X-Tidal-Token': clientId },
    });
    if (!res2.ok) return null;
    const data = await res2.json();
    const items = data?.items;
    if (!items || items.length === 0) return null;
    const needle = artistName.toLowerCase().trim();
    const exactMatch = items.find(
      (a: { name: string }) => a.name.toLowerCase().trim() === needle,
    );
    const match = exactMatch ?? items[0];
    return {
      id: String(match.id),
      name: match.name,
      url: match.url || `https://tidal.com/artist/${match.id}`,
      popularity: match.popularity ?? 0,
    };
  }
  const data = await res.json();
  const artists = data?.artists;
  if (!artists || artists.length === 0) return null;
  const needle = artistName.toLowerCase().trim();
  const exactMatch = artists.find(
    (a: { name: string }) => a.name.toLowerCase().trim() === needle,
  );
  const match = exactMatch ?? artists[0];
  return {
    id: String(match.id),
    name: match.name,
    url: match.url || `https://tidal.com/artist/${match.id}`,
    popularity: match.popularity ?? 0,
  };
}

/** Fetch a specific Tidal artist by ID. */
export async function getTidalArtistById(clientToken: string, artistId: string): Promise<{
  id: string;
  name: string;
  url: string;
  popularity: number;
} | null> {
  const { clientId } = getTidalConfig();
  // Try v1 API with client token
  const res = await fetch(`https://api.tidal.com/v1/artists/${encodeURIComponent(artistId)}?countryCode=US`, {
    headers: { 'X-Tidal-Token': clientId },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    id: String(data.id),
    name: data.name,
    url: data.url || `https://tidal.com/artist/${data.id}`,
    popularity: data.popularity ?? 0,
  };
}

/** Get a client credentials token for public API access (artist search). */
export async function getTidalClientToken(): Promise<string> {
  const { clientId, clientSecret } = getTidalConfig();
  const res = await fetch(TIDAL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tidal client token failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}
