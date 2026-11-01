const http = require('http');
const fs = require('fs');
const path = require('path');

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

function getMime(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

// Every failure path answers the request instead of throwing: one uncaught
// exception (e.g. decodeURIComponent on a scanner's "/%c0%ae") used to kill
// the process, and Railway removed the deployment after 10 restarts.
function createHandler(dir) {
  const root = path.resolve(dir);
  const indexPath = path.join(root, 'index.html');

  return (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return sendText(res, 400, 'Bad Request');
    }

    try {
      const filePath = path.join(root, pathname);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        return sendText(res, 403, 'Forbidden');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': getMime(filePath), 'Content-Length': content.length });
        return res.end(content);
      }

      // SPA fallback: serve index.html for non-file routes
      const content = fs.readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length });
      return res.end(content);
    } catch (err) {
      console.error('request failed', req.url, err);
      if (!res.headersSent) return sendText(res, 500, 'Internal Server Error');
      return res.end();
    }
  };
}

function createServer(dir) {
  const server = http.createServer(createHandler(dir));
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
  createServer(DIR).listen(PORT, '0.0.0.0', () => {
    console.log(`Static server running on port ${PORT}`);
  });
}
