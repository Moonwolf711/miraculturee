import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as site from '../seo/site.mjs';

// Crawl bursts: every SSR lookup comes from the web server's IP, and the API
// allows 100 requests a minute per IP. Event pages must keep their own title
// and H1 under load, and answer 503 (not a generic 200) when nothing is known.

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server.cjs') as {
  createServer: (dir: string, opts?: Record<string, unknown>) => http.Server;
};

const id = (n: number) => `${String(n).padStart(8, '0')}-2222-4333-8444-555555555555`;
const LISTED = [1, 2, 3, 4, 5].map((n) => ({
  id: id(n),
  title: `Listed Show ${n}`,
  artistName: `Artist ${n}`,
  venueName: 'The Hall',
  venueCity: 'Denver, CO',
  date: `2026-11-0${n}T20:00:00.000Z`,
}));
const UNLISTED = { ...LISTED[0], id: id(9), title: 'Unlisted Show' };

interface Res {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function request(port: number, rawPath: string): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const json = (status: number, data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
const count = (html: string, re: RegExp) => (html.match(re) || []).length;
const titleOf = (e: (typeof LISTED)[number]) => `<title>${site.formatTitle(site.eventTitle(e))}</title>`;

/** A fake API; `mode` decides how event detail calls answer. */
function fakeApi() {
  const state = { mode: 'ok' as 'ok' | 'limited' | 'down', detailCalls: 0 };
  const fetchImpl = async (url: string): Promise<Response> => {
    const u = new URL(url);
    if (u.pathname === '/events') return json(200, { data: LISTED, total: LISTED.length, page: 1, limit: 50, totalPages: 1 });
    if (u.pathname === '/artist/public') return json(200, { artists: [], total: 0 });
    const known = [...LISTED, UNLISTED].find((e) => u.pathname === `/events/${e.id}`);
    if (!known) return json(404, { error: 'not found' });
    state.detailCalls++;
    if (state.mode === 'limited') return json(429, { error: 'Too Many Requests' }, { 'retry-after': '60' });
    if (state.mode === 'down') return json(502, { error: 'bad gateway' });
    return json(200, { ...known, description: null });
  };
  return { state, fetchImpl };
}

describe('server.cjs SEO under a crawl burst', () => {
  let dir: string;
  const servers: http.Server[] = [];

  async function start(opts: Record<string, unknown>) {
    const server = createServer(dir, { site, apiUrl: 'https://api.test', ...opts });
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    return (server.address() as AddressInfo).port;
  }

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-seo-burst-'));
    fs.writeFileSync(path.join(dir, 'index.html'), fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8'));
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r()))));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps detail lookups within the page budget and renders the rest from the event list', async () => {
    const api = fakeApi();
    const port = await start({ fetchImpl: api.fetchImpl, apiBudget: { page: 2, walk: 40 } });
    await request(port, '/sitemap.xml'); // the walk fills the event list
    const pages = await Promise.all(LISTED.map((e) => request(port, `/events/${e.id}`)));
    expect(api.state.detailCalls).toBeLessThanOrEqual(2);
    pages.forEach((res, i) => {
      expect(res.status).toBe(200);
      expect(res.body).toContain(titleOf(LISTED[i]));
      expect(count(res.body, /<h1[\s>]/g)).toBe(1);
      expect(res.body).toContain('"@type":"BreadcrumbList"');
    });
  });

  it('stops calling the API during a 429 cooldown and still renders listed events', async () => {
    const api = fakeApi();
    api.state.mode = 'limited';
    const port = await start({ fetchImpl: api.fetchImpl });
    await request(port, '/sitemap.xml');
    const first = await request(port, `/events/${LISTED[0].id}`);
    const second = await request(port, `/events/${LISTED[1].id}`);
    expect(api.state.detailCalls).toBe(1);
    expect(first.status).toBe(200);
    expect(first.body).toContain(titleOf(LISTED[0]));
    expect(second.body).toContain(titleOf(LISTED[1]));
  });

  it('answers 503 with Retry-After, never a generic 200, when an event is unknown and the API is out', async () => {
    const api = fakeApi();
    api.state.mode = 'limited';
    const port = await start({ fetchImpl: api.fetchImpl });
    const res = await request(port, `/events/${UNLISTED.id}`);
    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('120');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toContain('content="noindex, nofollow"');
    expect(count(res.body, /<h1[\s>]/g)).toBe(0);
  });

  it('serves the last good answer when a refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const api = fakeApi();
    const port = await start({ fetchImpl: api.fetchImpl });
    expect((await request(port, `/events/${UNLISTED.id}`)).body).toContain(titleOf(UNLISTED));
    vi.setSystemTime(Date.now() + 31 * 60 * 1000); // past the item TTL
    api.state.mode = 'down';
    const res = await request(port, `/events/${UNLISTED.id}`);
    expect(api.state.detailCalls).toBe(2);
    expect(res.status).toBe(200);
    expect(res.body).toContain(titleOf(UNLISTED));
  });

  it('does not let caches keep a sitemap that is still missing the event URLs', async () => {
    const port = await start({ fetchImpl: async () => json(502, {}) });
    const res = await request(port, '/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
