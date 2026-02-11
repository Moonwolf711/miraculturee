const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 80);
const DIR = __dirname;

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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = path.join(DIR, decodeURIComponent(url.pathname));

  // Prevent directory traversal
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    return res.end();
  }

  // Try exact file first
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': getMime(filePath), 'Content-Length': content.length });
    return res.end(content);
  }

  // SPA fallback: serve index.html for non-file routes
  const indexPath = path.join(DIR, 'index.html');
  const content = fs.readFileSync(indexPath);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length });
  res.end(content);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Static server running on port ${PORT}`);
});
