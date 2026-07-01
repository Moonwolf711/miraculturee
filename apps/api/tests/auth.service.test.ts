import Fastify, { type FastifyInstance } from 'fastify';
import { hash } from 'bcrypt';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authPlugin } from '../src/plugins/auth';
import { AuthService } from '../src/services/auth.service';

/**
 * End-to-end regression guard tying token *issuance* to token *enforcement*:
 *  - a normal login issues an access token that authenticates AND a refresh
 *    token that does NOT (SEC-202);
 *  - logging in as a 2FA-enabled user yields only a temp-token, which cannot be
 *    used as a session bearer (SEC-201) — the bypass is closed;
 *  - refresh tokens are persisted as bcrypt hashes, never raw (SEC-005).
 */

let app: FastifyInstance;
let prisma: { user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
let service: AuthService;
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hash('correct-horse', 10);
  app = Fastify();
  await app.register(authPlugin);
  app.get('/protected', { preHandler: [app.authenticate] }, async (req) => ({ id: req.user.id }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  service = new AuthService(prisma as never, app);
});

function auth(token: string) {
  return app.inject({ method: 'GET', url: '/protected', headers: { authorization: `Bearer ${token}` } });
}

describe('AuthService.login — token issuance', () => {
  it('issues an access token that authenticates and a refresh token that does not', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1', email: 'a@b.co', role: 'FAN', passwordHash, isBanned: false, totpEnabled: false,
    });

    const result = (await service.login('a@b.co', 'correct-horse')) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();

    // Tokens carry the correct type claims.
    expect((app.jwt.verify(result.accessToken) as { type?: string }).type).toBe('access');
    expect((app.jwt.verify(result.refreshToken) as { type?: string }).type).toBe('refresh');

    // Enforcement: access works, refresh is rejected as a bearer (SEC-202).
    expect((await auth(result.accessToken)).statusCode).toBe(200);
    expect((await auth(result.refreshToken)).statusCode).toBe(401);

    // Refresh token is persisted as a bcrypt hash, never raw (SEC-005).
    const lastUpdate = prisma.user.update.mock.calls.at(-1)?.[0] as { data: { refreshToken: string } };
    expect(lastUpdate.data.refreshToken).not.toBe(result.refreshToken);
    expect(lastUpdate.data.refreshToken.startsWith('$2')).toBe(true);
  });

  it('a 2FA-enabled user gets only a temp-token, which cannot authenticate (SEC-201)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-2', email: 'c@d.co', role: 'FAN', passwordHash, isBanned: false, totpEnabled: true,
    });

    const result = (await service.login('c@d.co', 'correct-horse')) as {
      requiresTwoFactor: boolean;
      tempToken: string;
      accessToken?: string;
    };
    expect(result.requiresTwoFactor).toBe(true);
    expect(result.tempToken).toBeTruthy();
    expect(result.accessToken).toBeUndefined();

    // The temp-token must NOT be usable as a session bearer.
    expect((await auth(result.tempToken)).statusCode).toBe(401);
  });

  it('rejects invalid credentials with 401', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-3', email: 'e@f.co', role: 'FAN', passwordHash, isBanned: false, totpEnabled: false,
    });
    await expect(service.login('e@f.co', 'wrong-password')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects a banned user with 403', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-4', email: 'g@h.co', role: 'FAN', passwordHash, isBanned: true, totpEnabled: false,
    });
    await expect(service.login('g@h.co', 'correct-horse')).rejects.toMatchObject({ statusCode: 403 });
  });
});
