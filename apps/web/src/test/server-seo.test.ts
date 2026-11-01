import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as site from '../seo/site.mjs';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server.cjs') as {
  createServer: (dir: string, opts?: Record<string, unknown>) => http.Server;
};

const EVENT_ID = '11111111-2222-4333-8444-555555555555';
const GONE_ID = '99999999-2222-4333-8444-555555555555';
const ARTIST_ID = 'aaaaaaaa-2222-4333-8444-555555555555';

const EVENT = {
  id: EVENT_ID,
  title: 'Night Drive Tour',
  artistName: 'Test Artist',
  venueName: 'The Hall',
  venueCity: 'Denver, CO',
  description: "A show </script><script>alert(1)</script> & more $& $' $`",
};

interface Res {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function request(port: number, rawPath: string, headers: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const apiCalls: string[] = [];

// Stands in for the API: one event (listed on 2 pages), one verified artist, one deleted event.
async function fakeFetch(url: string): Promise<Response> {
  const u = new URL(url);
  if (u.pathname === `/events/${EVENT_ID}`) return jsonResponse(200, EVENT);
  if (u.pathname === `/artist/public/${ARTIST_ID}`) return jsonResponse(200, { id: ARTIST_ID, stageName: 'Lunar Test', bio: null });
  if (u.pathname === '/events') {
    apiCalls.push(`${u.pathname}${u.search}`);
    return jsonResponse(200, { data: [EVENT], total: 21, page: Number(u.searchParams.get('page') || 1), limit: 20, totalPages: 2 });
  }
  if (u.pathname === '/artist/public') return jsonResponse(200, { artists: [{ id: ARTIST_ID }], total: 1 });
  return jsonResponse(404, { error: 'not found' });
}

const count = (html: string, re: RegExp) => (html.match(re) || []).length;

describe('server.cjs SEO', () => {
  let dir: string;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-seo-'));
    const template = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    fs.writeFileSync(path.join(dir, 'index.html'), template);
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
    server = createServer(dir, { site, apiUrl: 'https://api.test', fetchImpl: fakeFetch });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('301s the bare domain to the www canonical origin, keeping path and query', async () => {
    const res = await request(port, '/events?type=FESTIVAL', { host: 'mira-culture.com' });
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://www.mira-culture.com/events?type=FESTIVAL');
  });

  it('sends HSTS without includeSubDomains or preload', async () => {
    const res = await request(port, '/');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000');
  });

  it('renders each public page with its own title, canonical, one H1 and nav links', async () => {
    const res = await request(port, '/events');
    expect(res.status).toBe(200);
    expect(res.body).toContain(`<title>${site.formatTitle(site.STATIC_ROUTES['/events'].title)}</title>`);
    expect(res.body).toContain('<link rel="canonical" href="https://www.mira-culture.com/events" data-rh="true" />');
    expect(res.body).toContain('content="index, follow"');
    expect(count(res.body, /<h1[\s>]/g)).toBe(1);
    expect(count(res.body, /<link rel="canonical"/g)).toBe(1);
    expect(res.body).toContain('"@type":"BreadcrumbList"');
    expect(res.body).toContain('href="/privacy"');
  });

  it('puts Organization JSON-LD on the home page only', async () => {
    expect((await request(port, '/')).body).toContain('"@type":"Organization"');
    expect((await request(port, '/terms')).body).not.toContain('"@type":"Organization"');
  });

  it('keeps sign-in pages noindex', async () => {
    const res = await request(port, '/login');
    expect(res.status).toBe(200);
    expect(res.body).toContain('content="noindex, nofollow"');
  });

  it('answers unknown URLs and missing files with a real 404', async () => {
    const page = await request(port, '/no-such-page');
    expect(page.status).toBe(404);
    expect(page.body).toContain('content="noindex, nofollow"');
    expect(page.body).not.toContain('rel="canonical"');
    expect((await request(port, '/missing.png')).status).toBe(404);
  });

  it('redirects trailing-slash and upper-case forms of a page to the clean URL', async () => {
    expect((await request(port, '/events/')).headers.location).toBe('/events');
    expect((await request(port, '/Privacy')).headers.location).toBe('/privacy');
  });

  it('never redirects to another host (protocol-relative Location)', async () => {
    // No dot in the host part, so this reaches the trailing-slash redirect branch.
    const res = await request(port, '/%2F%2Fevilhost/');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/evilhost');
  });

  it('renders event pages from the API and escapes API text', async () => {
    const res = await request(port, `/events/${EVENT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain(`<title>${site.formatTitle(site.eventTitle(EVENT))}</title>`);
    expect(res.body).toContain('<h1');
    expect(res.body).not.toContain('<script>alert(1)</script>');
    expect(res.body).toContain('&lt;/script&gt;');
  });

  it('keeps "$&"-style sequences in API text literal', async () => {
    const res = await request(port, `/events/${EVENT_ID}`);
    expect(res.body).toContain("$&amp; $&#39; $`");
    expect(count(res.body, /<!-- seo:start -->/g)).toBe(1);
  });

  it('lists the same page of events the app requests, as links with pagination and tabs', async () => {
    // The server caches API answers, so the call may have been made by an earlier /events request.
    const res = await request(port, '/events');
    expect(apiCalls).toContain(`/events?type=SHOW&sort=${encodeURIComponent(site.EVENTS_DEFAULT_SORT)}`);
    expect(res.body).toContain(`href="/events/${EVENT_ID}"`);
    expect(res.body).toContain('href="/events?page=2"');
    expect(res.body).toContain('href="/events?type=FESTIVAL"');
  });

  it('gives each events page and tab its own title and self canonical, and 404s past the end', async () => {
    const p2 = await request(port, '/events?page=2');
    expect(p2.status).toBe(200);
    expect(p2.body).toContain('<link rel="canonical" href="https://www.mira-culture.com/events?page=2" data-rh="true" />');
    expect(p2.body).toContain('<title>Upcoming Shows — Page 2 | MiraCulture</title>');
    const fest = await request(port, '/events?type=FESTIVAL');
    expect(fest.body).toContain('<title>Upcoming Festivals | MiraCulture</title>');
    expect(fest.body).toContain('href="https://www.mira-culture.com/events?type=FESTIVAL"');
    expect((await request(port, '/events?page=3')).status).toBe(404);
  });

  it('404s events the API does not know and non-UUID ids', async () => {
    expect((await request(port, `/events/${GONE_ID}`)).status).toBe(404);
    expect((await request(port, '/events/not-a-uuid')).status).toBe(404);
  });

  it('renders artist profiles with a profile title', async () => {
    const res = await request(port, `/artists/${ARTIST_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain('Lunar Test — Artist Profile | MiraCulture');
  });

  it('serves robots.txt that allows public pages, blocks private ones and names the sitemap', async () => {
    const res = await request(port, '/robots.txt');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Disallow: /dashboard');
    expect(res.body).toContain('Sitemap: https://www.mira-culture.com/sitemap.xml');
    expect(res.body).not.toMatch(/^Disallow: \/$/m);
  });

  it('serves a sitemap of canonical, indexable URLs with lastmod', async () => {
    const res = await request(port, '/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<loc>https://www.mira-culture.com/events</loc><lastmod>');
    expect(res.body).toContain(`<loc>https://www.mira-culture.com/events/${EVENT_ID}</loc>`);
    expect(res.body).toContain(`<loc>https://www.mira-culture.com/artists/${ARTIST_ID}</loc>`);
    expect(res.body).not.toContain('/login<');
    expect(res.body).not.toContain('https://mira-culture.com');
    expect(count(res.body, new RegExp(`/events/${EVENT_ID}<`, 'g'))).toBe(1);
  });

  it('caches hashed assets for a year', async () => {
    const res = await request(port, '/assets/app-abc123.js');
    expect(res.headers['cache-control']).toContain('immutable');
  });
});

describe('site.mjs', () => {
  it('lists every <Route path> in App.tsx so real pages never get a 404 status', () => {
    const app = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
    const paths = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');
    expect(paths.length).toBeGreaterThan(20);
    expect(paths.filter((p) => !site.APP_ROUTES.includes(p))).toEqual([]);
  });

  it('keeps indexable titles at 30-60 chars and descriptions at 70-160 chars', () => {
    for (const [p, r] of Object.entries(site.STATIC_ROUTES)) {
      if (r.noindex) continue;
      const t = site.formatTitle(r.title);
      expect(t.length, `${p} title "${t}"`).toBeGreaterThanOrEqual(30);
      expect(t.length, `${p} title "${t}"`).toBeLessThanOrEqual(60);
      expect(r.description.length, `${p} description`).toBeGreaterThanOrEqual(70);
      expect(r.description.length, `${p} description`).toBeLessThanOrEqual(160);
    }
  });

  it('keeps every events tab and page title at 30-60 chars and description at 70-160', () => {
    for (const tab of site.EVENT_TYPES) {
      for (const page of [1, 2, 999]) {
        const m = site.eventsListMeta(tab.type, page);
        const t = site.formatTitle(m.title);
        expect(t.length, t).toBeGreaterThanOrEqual(30);
        expect(t.length, t).toBeLessThanOrEqual(60);
        expect(m.description.length, m.description).toBeGreaterThanOrEqual(70);
        expect(m.description.length, m.description).toBeLessThanOrEqual(160);
      }
    }
  });

  it('keeps event titles within 60 chars once suffixed', () => {
    const long = { ...EVENT, title: 'An Extremely Long Event Title That Goes On And On Forever Tour' };
    expect(site.formatTitle(site.eventTitle(long)).length).toBeLessThanOrEqual(60);
    const short = { ...EVENT, title: 'KETTAMA Live', artistName: 'KETTAMA', venueCity: 'Las Vegas, NV' };
    expect(site.eventTitle(short)).toBe('KETTAMA Live in Las Vegas, NV');
  });
});
