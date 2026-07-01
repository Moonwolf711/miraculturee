import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authPlugin } from '../src/plugins/auth';

/**
 * Regression guard for SEC-201 (2FA bypass) and SEC-202 (token-type confusion).
 *
 * The `authenticate` decorator must accept ONLY access tokens. A validly-signed
 * refresh token or 2FA temp-token — same secret, same signer — must be rejected;
 * otherwise a password-only holder could use the 5-minute 2FA temp-token, or a
 * 7-day refresh token, as a full session bearer.
 */

const USER = { id: 'u-1', email: 'a@b.co', role: 'FAN' };

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  await app.register(authPlugin);
  app.get('/protected', { preHandler: [app.authenticate] }, async (req) => ({
    id: req.user.id,
    type: (req.user as { type?: string }).type ?? null,
  }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

function get(token?: string) {
  return app.inject({
    method: 'GET',
    url: '/protected',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('authenticate decorator — token-type enforcement', () => {
  it('accepts a valid access token (type:access)', async () => {
    const token = app.jwt.sign({ ...USER, type: 'access' } as never);
    const res = await get(token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: USER.id, type: 'access' });
  });

  it('rejects a refresh token used as a bearer (SEC-202)', async () => {
    const token = app.jwt.sign({ ...USER, type: 'refresh' } as never, { expiresIn: '7d' });
    const res = await get(token);
    expect(res.statusCode).toBe(401);
  });

  it('rejects a 2FA temp-token used as a bearer (SEC-201)', async () => {
    // Exact shape AuthService.login() produces for a 2FA-enabled user.
    const tempToken = app.jwt.sign({ id: USER.id, purpose: '2fa' } as never, { expiresIn: '5m' });
    const res = await get(tempToken);
    expect(res.statusCode).toBe(401);
  });

  it('rejects a legacy token with no type claim', async () => {
    const legacy = app.jwt.sign({ ...USER } as never);
    const res = await get(legacy);
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await get();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a malformed / unsigned token', async () => {
    const res = await get('not-a-real-jwt');
    expect(res.statusCode).toBe(401);
  });
});
