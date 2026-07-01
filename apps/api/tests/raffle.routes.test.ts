import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authPlugin } from '../src/plugins/auth';
import { raffleRoutes } from '../src/routes/raffle';
import { RaffleService } from '../src/services/raffle.service';

/**
 * Regression guards for:
 *  - CRIT-003: any authenticated user could close any raffle pool. Only ADMINs
 *    may close a pool; everyone else gets 403 and the pool is never touched.
 *  - CRIT-004: /my-entry must be scoped to the *current* user, not the whole
 *    pool (the original bug reported an entry whenever ANY entry existed).
 */

// A valid v4 UUID — PoolIdParamSchema requires z.string().uuid().
const POOL_ID = '11111111-1111-4111-8111-111111111111';

let app: FastifyInstance;
let prisma: { raffleEntry: { findFirst: ReturnType<typeof vi.fn> } };

function tokenFor(id: string, role: string) {
  return app.jwt.sign({ id, email: `${id}@t.co`, role, type: 'access' } as never);
}

beforeAll(async () => {
  app = Fastify();
  await app.register(authPlugin);
  prisma = { raffleEntry: { findFirst: vi.fn() } };
  app.decorate('prisma', prisma as never);
  app.decorate('pos', {} as never);
  app.decorate('io', {} as never);
  await app.register(raffleRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  vi.restoreAllMocks();
});

describe('POST /:poolId/close — admin-only (CRIT-003)', () => {
  it('rejects unauthenticated callers with 401', async () => {
    const res = await app.inject({ method: 'POST', url: `/${POOL_ID}/close` });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a non-admin (FAN) with 403 and never closes the pool', async () => {
    const spy = vi.spyOn(RaffleService.prototype, 'closePool').mockResolvedValue(undefined as never);
    const res = await app.inject({
      method: 'POST',
      url: `/${POOL_ID}/close`,
      headers: { authorization: `Bearer ${tokenFor('fan-1', 'FAN')}` },
    });
    expect(res.statusCode).toBe(403);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('allows an ADMIN to close the pool', async () => {
    const spy = vi.spyOn(RaffleService.prototype, 'closePool').mockResolvedValue(undefined as never);
    const res = await app.inject({
      method: 'POST',
      url: `/${POOL_ID}/close`,
      headers: { authorization: `Bearer ${tokenFor('admin-1', 'ADMIN')}` },
    });
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith(POOL_ID);
    spy.mockRestore();
  });
});

describe('GET /:poolId/my-entry — scoped to current user (CRIT-004)', () => {
  beforeEach(() => prisma.raffleEntry.findFirst.mockReset());

  it('queries by BOTH poolId and the authenticated userId', async () => {
    prisma.raffleEntry.findFirst.mockResolvedValue({ id: 'entry-9' });
    const res = await app.inject({
      method: 'GET',
      url: `/${POOL_ID}/my-entry`,
      headers: { authorization: `Bearer ${tokenFor('user-abc', 'FAN')}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ hasEntry: true, entryId: 'entry-9' });
    expect(prisma.raffleEntry.findFirst).toHaveBeenCalledWith({
      where: { poolId: POOL_ID, userId: 'user-abc' },
    });
  });

  it('returns hasEntry:false when the current user has no entry', async () => {
    prisma.raffleEntry.findFirst.mockResolvedValue(null);
    const res = await app.inject({
      method: 'GET',
      url: `/${POOL_ID}/my-entry`,
      headers: { authorization: `Bearer ${tokenFor('user-xyz', 'FAN')}` },
    });
    expect(res.json()).toEqual({ hasEntry: false, entryId: null });
  });
});
