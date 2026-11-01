// Server-side SEO for the SPA: decides the status of each URL, renders the
// per-page head tags and a small static fallback body into index.html, and
// serves robots.txt and sitemap.xml. All page facts come from src/seo/site.mjs.
//
// Head tags carry data-rh="true" so react-helmet-async replaces them once the
// app renders (no duplicates). The fallback lives inside #root, which React's
// createRoot clears on mount.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_TIMEOUT_MS = 2500;
const ITEM_TTL_MS = 30 * 60 * 1000;
const ERROR_TTL_MS = 30 * 1000;
// A good answer is still served when a refresh fails, for up to a day.
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;
const SUMMARY_MAX = 10000;
const SITEMAP_TTL_MS = 6 * 60 * 60 * 1000;
const SITEMAP_WAIT_MS = 20 * 1000;
const SITEMAP_MAX_PAGES = 100;
// The API allows 100 requests a minute per client IP and every lookup comes
// from this server, so a crawl burst used to run into 429s and get a generic
// page. Page lookups and the sitemap walk each get a share of a 60 s window
// that stays below that limit together.
const API_BUDGET = { page: 40, walk: 40 };
const BUDGET_WINDOW_MS = 60 * 1000;
const RETRY_AFTER_S = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonLdTag(schema) {
  // "<" escaped so data from the API can never close the script element.
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  return `<script type="application/ld+json" data-rh="true">${json}</script>`;
}

function compile(pattern) {
  const source = pattern.replace(/:[A-Za-z]+/g, '([^/]+)');
  return { pattern, regex: new RegExp(`^${source}$`) };
}

function createSeo({ site, apiUrl, fetchImpl = globalThis.fetch, buildTime = new Date(), apiBudget = API_BUDGET }) {
  const routes = site.APP_ROUTES.map(compile);
  const staticPaths = new Set(site.APP_ROUTES.filter((p) => !p.includes(':')));
  const api = apiUrl ? apiUrl.replace(/\/+$/, '') : null;
  const cache = new Map();
  const inflight = new Map();
  // Event and artist rows from list answers, keyed by their detail path: a
  // page can still render from these when its own lookup is not possible.
  const summaries = new Map();
  const windows = { page: [], walk: [] };
  let cooldownUntil = 0;
  let sitemapState = { at: 0, urls: [], pending: null };

  function matchRoute(pathname) {
    for (const r of routes) {
      const m = r.regex.exec(pathname);
      if (m) return { pattern: r.pattern, param: m[1] };
    }
    return null;
  }

  /** Canonical form of a path the router would also accept (case, trailing slash). */
  function canonicalPath(pathname) {
    // Leading "//" would make the redirect Location protocol-relative (open redirect).
    let p = pathname.replace(/^\/{2,}/, '/');
    if (p.length > 1) p = p.replace(/\/+$/, '') || '/';
    if (!staticPaths.has(p) && staticPaths.has(p.toLowerCase())) p = p.toLowerCase();
    return p === pathname ? null : p;
  }

  /** Claims a call from the budget; the sitemap walk waits for one, pages never do. */
  async function takeSlot(kind) {
    for (;;) {
      const now = Date.now();
      const w = windows[kind];
      while (w.length && now - w[0] >= BUDGET_WINDOW_MS) w.shift();
      let waitMs = now < cooldownUntil ? cooldownUntil - now : 0;
      if (!waitMs && w.length >= apiBudget[kind]) waitMs = BUDGET_WINDOW_MS - (now - w[0]);
      if (!waitMs) {
        w.push(now);
        return true;
      }
      if (kind !== 'walk') return false;
      await sleep(waitMs + 10);
    }
  }

  async function fetchOnce(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${api}${path}`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      if (res.status === 429) {
        const s = Number(res.headers.get('retry-after'));
        cooldownUntil = Date.now() + (Number.isFinite(s) && s > 0 ? Math.min(s, 600) : 60) * 1000;
      }
      if (res.status === 404) return { status: 404 };
      if (!res.ok) return { status: res.status };
      return { status: 200, data: await res.json() };
    } catch {
      return { status: 0 };
    } finally {
      clearTimeout(timer);
    }
  }

  function remember(path, entry) {
    if (!cache.has(path) && cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(path, entry);
  }

  /**
   * Cached API GET. When no call is allowed right now or the API fails, the
   * last good answer is returned if there is one, else a non-200 status.
   */
  function apiGet(path, kind = 'page') {
    if (!api || !fetchImpl) return Promise.resolve({ status: 0 });
    const hit = cache.get(path);
    const now = Date.now();
    if (hit && now - hit.at < hit.ttl) return Promise.resolve(hit.value);
    if (inflight.has(path)) return inflight.get(path);
    const stale = hit && hit.goodAt && now - hit.goodAt < STALE_MAX_MS ? hit : null;
    const pending = (async () => {
      if (!(await takeSlot(kind))) return stale ? stale.value : { status: 429 };
      const value = await fetchOnce(path);
      const at = Date.now();
      if (value.status === 200 || value.status === 404) {
        remember(path, { at, ttl: ITEM_TTL_MS, value, goodAt: at });
        return value;
      }
      if (stale) {
        remember(path, { ...stale, at, ttl: ERROR_TTL_MS });
        return stale.value;
      }
      remember(path, { at, ttl: ERROR_TTL_MS, value, goodAt: 0 });
      return value;
    })().finally(() => inflight.delete(path));
    inflight.set(path, pending);
    return pending;
  }

  function keepSummaries(prefix, rows) {
    for (const row of rows || []) {
      if (!row || !UUID.test(row.id)) continue;
      const key = `${prefix}${row.id}`;
      summaries.delete(key);
      if (summaries.size >= SUMMARY_MAX) summaries.delete(summaries.keys().next().value);
      summaries.set(key, row);
    }
  }

  function notFound() {
    const m = site.NOT_FOUND;
    return { status: 404, title: site.formatTitle(m.title), description: m.description, canonical: null, noindex: true, h1: m.h1, intro: m.description, jsonLd: [] };
  }

  function crumbs(items) {
    return site.breadcrumbSchema([{ name: 'Home', url: `${site.SITE_URL}/` }, ...items]);
  }

  /**
   * The same page of events EventsPage requests (type tab, default sort, page),
   * as plain links, so every event page is reachable without JavaScript.
   */
  async function eventsPage(params) {
    const rawPage = parseInt(params.get('page') || '1', 10);
    const meta = site.eventsListMeta(params.get('type'), Number.isFinite(rawPage) ? Math.min(rawPage, 10000) : 1);
    const qs = new URLSearchParams({ type: meta.type, sort: site.EVENTS_DEFAULT_SORT });
    if (meta.page > 1) qs.set('page', String(meta.page));
    const res = await apiGet(`/events?${qs}`);
    if (res.status === 200) keepSummaries('/events/', res.data.data);
    const items = res.status === 200 ? (res.data.data || []).filter((e) => UUID.test(e.id)) : [];
    const totalPages = res.status === 200 ? res.data.totalPages || 1 : 1;
    if (res.status === 200 && meta.page > 1 && meta.page > totalPages) return notFound();
    const canonical = `${site.SITE_URL}${meta.path}`;
    return {
      status: 200,
      title: site.formatTitle(meta.title),
      description: meta.description,
      canonical,
      noindex: false,
      h1: meta.h1,
      intro: meta.description,
      list: {
        items: items.map((e) => ({ href: `/events/${e.id}`, text: `${e.title} — ${e.venueName}, ${e.venueCity}` })),
        prev: meta.page > 1 ? site.eventsListPath(meta.type, meta.page - 1) : null,
        next: meta.page < totalPages ? site.eventsListPath(meta.type, meta.page + 1) : null,
        tabs: site.EVENT_TYPES.filter((t) => t.type !== meta.type).map((t) => ({ href: site.eventsListPath(t.type, 1), text: t.short })),
      },
      jsonLd: [site.routeBreadcrumb('/events')],
    };
  }

  /** Status, head facts and fallback content for one request path. */
  async function resolve(pathname, params = new URLSearchParams()) {
    const canonical = `${site.SITE_URL}${pathname}`;
    if (pathname === '/events') return eventsPage(params);
    const route = site.STATIC_ROUTES[pathname];
    if (route) {
      const schema = pathname === '/' ? site.organizationSchema() : site.routeBreadcrumb(pathname);
      return { status: 200, title: site.formatTitle(route.title), description: route.description, canonical, noindex: !!route.noindex, h1: route.h1, intro: route.description, jsonLd: schema ? [schema] : [] };
    }

    const match = matchRoute(pathname);
    if (!match) return notFound();

    if (match.pattern === '/events/:id' || match.pattern === '/artists/:id') {
      if (!UUID.test(match.param)) return notFound();
      const isEvent = match.pattern === '/events/:id';
      const key = isEvent ? `/events/${match.param}` : `/artist/public/${match.param}`;
      const res = await apiGet(key);
      if (res.status === 404) return notFound();
      const d = res.status === 200 ? res.data : summaries.get(key);
      if (!d) {
        // No answer and nothing cached: a temporary error, so crawlers come back
        // later instead of indexing a generic page. People still get the app.
        const title = site.formatTitle(isEvent ? 'Event Details' : 'Artist Profile');
        return { status: 503, retryAfter: RETRY_AFTER_S, title, description: site.DEFAULT_DESCRIPTION, canonical, noindex: true, h1: null, intro: null, jsonLd: [] };
      }
      if (isEvent) {
        return {
          status: 200,
          title: site.formatTitle(site.eventTitle(d)),
          description: site.eventDescription(d),
          canonical,
          noindex: false,
          h1: d.title,
          intro: `${d.artistName} at ${d.venueName}, ${d.venueCity}.`,
          jsonLd: [crumbs([{ name: 'Events', url: `${site.SITE_URL}/events` }, { name: d.title, url: canonical }])],
        };
      }
      return {
        status: 200,
        title: site.formatTitle(site.artistTitle(d)),
        description: site.artistDescription(d),
        canonical,
        noindex: false,
        h1: d.stageName,
        intro: site.artistDescription(d),
        jsonLd: [crumbs([{ name: d.stageName, url: canonical }])],
      };
    }

    // Signed-in areas, one-time links, sign-up flows: real pages, kept out of the index.
    return { status: 200, title: site.DEFAULT_TITLE, description: site.DEFAULT_DESCRIPTION, canonical, noindex: true, h1: null, intro: null, jsonLd: [] };
  }

  function headTags(page) {
    const t = esc(page.title);
    const d = esc(page.description);
    const url = page.canonical ? esc(page.canonical) : null;
    const img = esc(site.DEFAULT_IMAGE);
    const rh = 'data-rh="true"';
    return [
      `<title>${t}</title>`,
      `<meta name="description" content="${d}" ${rh} />`,
      url ? `<link rel="canonical" href="${url}" ${rh} />` : '',
      `<meta name="robots" content="${page.noindex ? 'noindex, nofollow' : 'index, follow'}" ${rh} />`,
      `<meta property="og:type" content="website" ${rh} />`,
      `<meta property="og:site_name" content="${esc(site.SITE_NAME)}" ${rh} />`,
      `<meta property="og:title" content="${t}" ${rh} />`,
      `<meta property="og:description" content="${d}" ${rh} />`,
      `<meta property="og:image" content="${img}" ${rh} />`,
      `<meta property="og:image:width" content="1200" ${rh} />`,
      `<meta property="og:image:height" content="630" ${rh} />`,
      `<meta property="og:image:type" content="image/png" ${rh} />`,
      url ? `<meta property="og:url" content="${url}" ${rh} />` : '',
      `<meta name="twitter:card" content="summary_large_image" ${rh} />`,
      `<meta name="twitter:site" content="@MiraCulture" ${rh} />`,
      `<meta name="twitter:title" content="${t}" ${rh} />`,
      `<meta name="twitter:description" content="${d}" ${rh} />`,
      `<meta name="twitter:image" content="${img}" ${rh} />`,
      `<meta name="twitter:image:alt" content="${t}" ${rh} />`,
      ...page.jsonLd.map(jsonLdTag),
    ].filter(Boolean).join('\n    ');
  }

  function fallbackBody(page) {
    const link = (href, text) =>
      `<a href="${href}" style="display:inline-block;padding:12px 10px;min-height:44px;box-sizing:border-box;color:#fbbf24;text-decoration:none">${text}</a>`;
    const list = page.list
      ? `<ul style="list-style:none;padding:0;margin:1rem 0">${page.list.items.map((i) => `<li>${link(esc(i.href), esc(i.text))}</li>`).join('')}</ul>` +
        `<nav aria-label="More events" style="display:flex;flex-wrap:wrap">` +
        (page.list.prev ? link(esc(page.list.prev), 'Previous page') : '') +
        (page.list.next ? link(esc(page.list.next), 'Next page') : '') +
        page.list.tabs.map((t) => link(esc(t.href), esc(t.text))).join('') +
        '</nav>'
      : '';
    const main = page.h1
      ? `<h1 style="font-size:2rem;letter-spacing:.08em;margin:1.5rem 0 .75rem;color:#faf7f2">${esc(page.h1)}</h1>` +
        (page.intro ? `<p style="color:#9ca3af;line-height:1.6;max-width:40rem">${esc(page.intro)}</p>` : '') +
        list
      : '';
    return (
      '<div style="max-width:64rem;margin:0 auto;padding:1rem;font-family:Outfit,system-ui,sans-serif;color:#e5e7eb">' +
      `<header style="display:flex;flex-wrap:wrap;align-items:center;gap:4px">${link('/', 'MiraCulture home')}` +
      `<nav aria-label="Main" style="display:flex;flex-wrap:wrap">${link('/events', 'Upcoming shows')}${link('/local-artists', 'Local artists')}${link('/agents', 'Promoter agents')}${link('/register', 'Sign up')}${link('/login', 'Sign in')}</nav></header>` +
      `<main>${main}</main>` +
      `<footer style="margin-top:2rem;display:flex;flex-wrap:wrap">${link('/privacy', 'Privacy policy')}${link('/terms', 'Terms of service')}</footer>` +
      '</div>'
    );
  }

  /** index.html with this page's head tags and fallback body. */
  function render(template, page) {
    // Replacer functions, not strings: "$&" or "$'" in API text must stay literal.
    const head = `<!-- seo:start -->\n    ${headTags(page)}\n    <!-- seo:end -->`;
    const body = `<div id="root">${fallbackBody(page)}</div>`;
    return template
      .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, () => head)
      .replace('<div id="root"></div>', () => body);
  }

  function robotsTxt() {
    return [
      'User-agent: *',
      'Allow: /',
      ...site.ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
      '',
      `Sitemap: ${site.SITE_URL}/sitemap.xml`,
      '',
    ].join('\n');
  }

  async function collectDynamicUrls() {
    // A Set: API pages can shift while we walk them, repeating an event.
    const locs = new Set();
    const first = await apiGet(`/events?limit=50&page=1&sort=date`, 'walk');
    if (first.status === 200) {
      const pages = Math.min(first.data.totalPages || 1, SITEMAP_MAX_PAGES);
      const results = [first];
      for (let p = 2; p <= pages; p += 4) {
        const batch = [];
        for (let q = p; q < p + 4 && q <= pages; q++) batch.push(apiGet(`/events?limit=50&page=${q}&sort=date`, 'walk'));
        results.push(...(await Promise.all(batch)));
      }
      for (const r of results) {
        if (r.status !== 200) continue;
        keepSummaries('/events/', r.data.data);
        for (const e of r.data.data || []) if (UUID.test(e.id)) locs.add(`/events/${e.id}`);
      }
    }
    for (let offset = 0; offset < 5000; offset += 50) {
      const r = await apiGet(`/artist/public?limit=50&offset=${offset}`, 'walk');
      if (r.status !== 200) break;
      keepSummaries('/artist/public/', r.data.artists);
      for (const a of r.data.artists || []) if (UUID.test(a.id)) locs.add(`/artists/${a.id}`);
      if (offset + 50 >= (r.data.total || 0)) break;
    }
    return [...locs].map((loc) => ({ loc }));
  }

  function refreshSitemap() {
    if (!sitemapState.pending) {
      sitemapState.pending = collectDynamicUrls()
        .then((urls) => {
          // Keep the previous list if the API failed this round.
          if (urls.length || !sitemapState.urls.length) sitemapState = { at: Date.now(), urls, pending: null };
          else sitemapState = { ...sitemapState, at: Date.now(), pending: null };
        })
        .catch(() => {
          sitemapState = { ...sitemapState, pending: null };
        });
    }
    return sitemapState.pending;
  }

  async function sitemapXml() {
    if (Date.now() - sitemapState.at > SITEMAP_TTL_MS) {
      const pending = refreshSitemap();
      if (!sitemapState.urls.length) {
        await Promise.race([pending, new Promise((r) => setTimeout(r, SITEMAP_WAIT_MS))]);
      }
    }
    const lastmod = buildTime.toISOString().slice(0, 10);
    const entries = Object.entries(site.STATIC_ROUTES)
      .filter(([, m]) => !m.noindex && m.sitemap)
      .map(([p, m]) =>
        `  <url><loc>${esc(site.SITE_URL + p)}</loc><lastmod>${lastmod}</lastmod><changefreq>${m.sitemap.changefreq}</changefreq><priority>${m.sitemap.priority}</priority></url>`,
      );
    for (const u of sitemapState.urls) entries.push(`  <url><loc>${esc(site.SITE_URL + u.loc)}</loc></url>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  }

  /** False until the event/artist URLs are in, so a partial sitemap is not cached. */
  function sitemapReady() {
    return sitemapState.urls.length > 0;
  }

  return { canonicalPath, resolve, render, robotsTxt, sitemapXml, sitemapReady, refreshSitemap };
}

module.exports = { createSeo, esc };
