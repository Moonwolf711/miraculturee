import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server.cjs') as {
  createServer: (dir: string, opts?: Record<string, unknown>) => http.Server;
};

interface Res {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function request(port: number, rawPath: string, headers: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: rawPath, method: 'GET', headers },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('static server (server.cjs)', () => {
  let dir: string;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mira-web-'));
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><html lang="en"><head><title>MiraCulture</title></head><body><div id="root"></div></body></html>',
    );
    fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    server = createServer(dir);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('answers a malformed percent-encoded URL with 400 and keeps serving', async () => {
    const bad = await request(port, '/%c0%ae%c0%ae/etc/passwd');
    expect(bad.status).toBe(400);
    const ok = await request(port, '/');
    expect(ok.status).toBe(200);
    expect(ok.body).toContain('<div id="root">');
  });

  it('serves real files with their own content type', async () => {
    const res = await request(port, '/robots.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });
});
