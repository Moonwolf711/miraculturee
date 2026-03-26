import crypto from 'node:crypto';

const SOUNDCLOUD_AUTH_URL = 'https://secure.soundcloud.com/authorize';
const SOUNDCLOUD_TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';
const SOUNDCLOUD_API_URL = 'https://api.soundcloud.com';

export function getSoundCloudConfig() {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  const redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing SOUNDCLOUD_CLIENT_ID, SOUNDCLOUD_CLIENT_SECRET, or SOUNDCLOUD_REDIRECT_URI');
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

export function getSoundCloudAuthorizeUrl(state: string, codeChallenge: string): string {
  const { clientId, redirectUri } = getSoundCloudConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${SOUNDCLOUD_AUTH_URL}?${params.toString()}`;
}

export async function exchangeSoundCloudCode(code: string, codeVerifier: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}> {
  const { clientId, clientSecret, redirectUri } = getSoundCloudConfig();
  const res = await fetch(SOUNDCLOUD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SoundCloud token exchange failed (${res.status}): ${err}`);
  }
  return res.json();
}

export async function refreshSoundCloudToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret } = getSoundCloudConfig();
  const res = await fetch(SOUNDCLOUD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SoundCloud token refresh failed (${res.status}): ${err}`);
  }
  return res.json();
}

export async function getSoundCloudProfile(accessToken: string): Promise<{
  id: number;
  username: string;
  permalink_url: string;
  followers_count: number;
  avatar_url: string;
}> {
  const res = await fetch(`${SOUNDCLOUD_API_URL}/me`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SoundCloud profile fetch failed (${res.status}): ${err}`);
  }
  return res.json();
}
