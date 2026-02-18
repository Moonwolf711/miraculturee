const SOUNDCLOUD_AUTH_URL = 'https://soundcloud.com/connect';
const SOUNDCLOUD_TOKEN_URL = 'https://api.soundcloud.com/oauth2/token';
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

export function getSoundCloudAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getSoundCloudConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'non-expiring',
    state,
  });
  return `${SOUNDCLOUD_AUTH_URL}?${params.toString()}`;
}

export async function exchangeSoundCloudCode(code: string): Promise<{
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
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SoundCloud token exchange failed: ${err}`);
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
    throw new Error(`SoundCloud profile fetch failed: ${err}`);
  }
  return res.json();
}
