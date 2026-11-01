const http = require('http');
const fs = require('fs');
const path = require('path');
const { createSeo } = require('./seo-render.cjs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
};

// Sent on every response. No includeSubDomains/preload: api.* and other
// subdomains decide for themselves.
const BASE_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
};

function getMime(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function send(req, res, status, headers, body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body == null ? '' : String(body));
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Length': buf.length, ...headers });
  res.end(req.method === 'HEAD' ? undefined : buf);
}

function sendText(req, res, status, body) {
  send(req, res, status, { 'Content-Type': 'text/plain; charset=utf-8' }, body);
}

function redirect(req, res, location) {
  send(req, res, 301, { Location: location, 'Content-Type': 'text/plain; charset=utf-8' }, '');
}

function requestHost(req) {
  const raw = req.headers['x-forwarded-host'] || req.headers.host || '';
  return String(raw).split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

// Every failure path answers the request instead of throwing: one uncaught
// exception (e.g. decodeURIComponent on a scanner's "/%c0%ae") used to kill
// the process, and Railway removed the deployment after 10 restarts.
//
// opts.site (src/seo/site.mjs) turns on SEO: canonical-host redirect, per-page
// head tags, real 404 statuses, robots.txt and sitemap.xml. Without it the
// server is a plain SPA file server.
function createHandler(dir, opts = {}) {
  const root = path.resolve(dir);
  const indexPath = path.join(root, 'index.html');
  const site = opts.site || null;
  const canonicalHost = site ? new URL(site.SITE_URL).host : null;
  const bareHost = canonicalHost && canonicalHost.startsWith('www.') ? canonicalHost.slice(4) : null;
  let seo = null;
  let template = null;

  function getTemplate() {
    if (template === null) template = fs.readFileSync(indexPath, 'utf8');
    return template;
  }

  function getSeo() {
    if (site && !seo) {
      const buildTime = fs.existsSync(indexPath) ? fs.statSync(indexPath).mtime : new Date();
      seo = createSeo({ site, apiUrl: opts.apiUrl, fetchImpl: opts.fetchImpl, buildTime });
    }
    return seo;
  }

  async function handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(req, res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }, 'Method Not Allowed');
    }

    let url;
    let pathname;
    try {
      url = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendText(req, res, 400, 'Bad Request');
    }

    if (bareHost && requestHost(req) === bareHost) {
      return redirect(req, res, `https://${canonicalHost}${url.pathname}${url.search}`);
    }

    const s = getSeo();
    if (s && pathname === '/robots.txt') {
      return send(req, res, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }, s.robotsTxt());
    }
    if (s && pathname === '/sitemap.xml') {
      return send(req, res, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }, await s.sitemapXml());
    }
    if (pathname === '/index.html') return redirect(req, res, `/${url.search}`);

    const filePath = path.join(root, pathname);
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      return sendText(req, res, 403, 'Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const cache = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
      return send(req, res, 200, { 'Content-Type': getMime(filePath), 'Cache-Control': cache }, fs.readFileSync(filePath));
    }

    // A missing file is a 404, never the app shell.
    if (path.extname(pathname)) return sendText(req, res, 404, 'Not Found');

    if (!s) {
      return send(req, res, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, getTemplate());
    }

    const clean = s.canonicalPath(pathname);
    if (clean) return redirect(req, res, `${encodeURI(clean)}${url.search}`);

    const page = await s.resolve(pathname, url.searchParams);
    return send(req, res, page.status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, s.render(getTemplate(), page));
  }

  return (req, res) => {
    handle(req, res).catch((err) => {
      console.error('request failed', req.url, err);
      if (!res.headersSent) return sendText(req, res, 500, 'Internal Server Error');
      return res.end();
    });
  };
}

function createServer(dir, opts) {
  const server = http.createServer(createHandler(dir, opts));
  // Malformed HTTP (bad request line, oversized headers) must not take the process down.
  server.on('clientError', (_err, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    else socket.destroy();
  });
  return server;
}

module.exports = { createHandler, createServer };

if (require.main === module) {
  const PORT = Number(process.env.PORT || 3000);
  const DIR = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
  const apiUrl = process.env.SEO_API_URL || process.env.VITE_API_URL || '';
  import('./src/seo/site.mjs')
    .catch((err) => {
      console.error('SEO disabled: could not load src/seo/site.mjs', err);
      return null;
    })
    .then((site) => {
      const server = createServer(DIR, { site, apiUrl });
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Static server running on port ${PORT}${site ? ' (SEO on)' : ''}`);
      });
    });
}
