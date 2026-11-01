// Server-side SEO for the SPA: decides the status of each URL, renders the
// per-page head tags and a small static fallback body into index.html, and
// serves robots.txt and sitemap.xml. All page facts come from src/seo/site.mjs.
//
// Head tags carry data-rh="true" so react-helmet-async replaces them once the
// app renders (no duplicates). The fallback lives inside #root, which React's
// createRoot clears on mount.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_TIMEOUT_MS = 2500;
const ITEM_TTL_MS = 10 * 60 * 1000;
const ERROR_TTL_MS = 30 * 1000;
const CACHE_MAX = 2000;
const SITEMAP_TTL_MS = 6 * 60 * 60 * 1000;
const SITEMAP_WAIT_MS = 20 * 1000;
const SITEMAP_MAX_PAGES = 100;

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

function createSeo({ site, apiUrl, fetchImpl = globalThis.fetch, buildTime = new Date() }) {
  const routes = site.APP_ROUTES.map(compile);
  const staticPaths = new Set(site.APP_ROUTES.filter((p) => !p.includes(':')));
  const api = apiUrl ? apiUrl.replace(/\/+$/, '') : null;
  const cache = new Map();
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

  async function apiGet(path) {
    if (!api || !fetchImpl) return { status: 0 };
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
    const value = await (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
      try {
        const res = await fetchImpl(`${api}${path}`, { signal: ctrl.signal, headers: { accept: 'application/json' } });
        if (res.status === 404) return { status: 404 };
        if (!res.ok) return { status: res.status };
        return { status: 200, data: await res.json() };
      } catch {
        return { status: 0 };
      } finally {
        clearTimeout(timer);
      }
    })();
    const ok = value.status === 200 || value.status === 404;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(path, { at: Date.now(), ttl: ok ? ITEM_TTL_MS : ERROR_TTL_MS, value });
    return value;
  }

  function notFound() {
    const m = site.NOT_FOUND;
    return { status: 404, title: site.formatTitle(m.title), description: m.description, canonical: null, noindex: true, h1: m.h1, intro: m.description, jsonLd: [] };
  }

  function crumbs(items) {
    return site.breadcrumbSchema([{ name: 'Home', url: `${site.SITE_URL}/` }, ...items]);
  }

  /** Status, head facts and fallback content for one request path. */
  async function resolve(pathname) {
    const canonical = `${site.SITE_URL}${pathname}`;
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
      const res = await apiGet(isEvent ? `/events/${match.param}` : `/artist/public/${match.param}`);
      if (res.status === 404) return notFound();
      if (res.status !== 200) {
        // API unreachable: still a real page, so answer 200 with a neutral head.
        const title = site.formatTitle(isEvent ? 'Event Details' : 'Artist Profile');
        return { status: 200, title, description: site.DEFAULT_DESCRIPTION, canonical, noindex: false, h1: null, intro: null, jsonLd: [] };
      }
      const d = res.data;
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
    const main = page.h1
      ? `<h1 style="font-size:2rem;letter-spacing:.08em;margin:1.5rem 0 .75rem;color:#faf7f2">${esc(page.h1)}</h1>` +
        (page.intro ? `<p style="color:#9ca3af;line-height:1.6;max-width:40rem">${esc(page.intro)}</p>` : '')
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
    return template
      .replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, `<!-- seo:start -->\n    ${headTags(page)}\n    <!-- seo:end -->`)
      .replace('<div id="root"></div>', `<div id="root">${fallbackBody(page)}</div>`);
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
    const urls = [];
    const first = await apiGet(`/events?limit=50&page=1&sort=date`);
    if (first.status === 200) {
      const pages = Math.min(first.data.totalPages || 1, SITEMAP_MAX_PAGES);
      const results = [first];
      for (let p = 2; p <= pages; p += 4) {
        const batch = [];
        for (let q = p; q < p + 4 && q <= pages; q++) batch.push(apiGet(`/events?limit=50&page=${q}&sort=date`));
        results.push(...(await Promise.all(batch)));
      }
      for (const r of results) {
        if (r.status === 200) for (const e of r.data.data || []) if (UUID.test(e.id)) urls.push({ loc: `/events/${e.id}` });
      }
    }
    for (let offset = 0; offset < 5000; offset += 50) {
      const r = await apiGet(`/artist/public?limit=50&offset=${offset}`);
      if (r.status !== 200) break;
      for (const a of r.data.artists || []) if (UUID.test(a.id)) urls.push({ loc: `/artists/${a.id}` });
      if (offset + 50 >= (r.data.total || 0)) break;
    }
    return urls;
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

  return { canonicalPath, resolve, render, robotsTxt, sitemapXml, refreshSitemap };
}

module.exports = { createSeo, esc };
