import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { startServer, PORT } from '../../src/cli/devServer.js';

// PORT is a module-level constant (shared cache with visualize.ts import)
// so we use whatever port the module resolved to.
const BASE = `http://127.0.0.1:${PORT}`;

function get(path: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, res => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', reject);
  });
}

function post(path: string, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf-8');
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method: 'POST',
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length } },
      res => { res.resume(); res.on('end', () => resolve(res.statusCode ?? 0)); }
    );
    req.on('error', reject);
    req.end(buf);
  });
}

// Collect one SSE event from /events
function nextSseEvent(timeout = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { req.destroy(); reject(new Error('SSE timeout')); }, timeout);
    const req = http.get(`${BASE}/events`, res => {
      let buf = '';
      res.on('data', (chunk: Buffer) => {
        buf += chunk.toString();
        if (buf.includes('event: update')) {
          clearTimeout(timer);
          req.destroy();
          resolve(buf);
        }
      });
    });
    req.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

let serverStarted = false;

async function ensureTestServer() {
  if (serverStarted) return;
  serverStarted = true;
  try {
    await startServer();
  } catch (err: unknown) {
    // If a dev server is already running on this port (e.g. from a prior
    // manual run), reuse it rather than failing the whole suite.
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
  }
  // Reset any HTML state left by a previous run so tests start from a clean slate
  await post('/reset', '');
}

test('GET / returns placeholder before any update', async () => {
  await ensureTestServer();
  const { status, body } = await get('/');
  assert.equal(status, 200);
  assert.match(body, /Waiting for first analysis/);
  assert.match(body, /EventSource/);
});

test('POST /update stores HTML and GET / returns it with SSE script injected', async () => {
  await ensureTestServer();
  const html = '<html><body><p>hello</p></body></html>';
  const status = await post('/update', html);
  assert.equal(status, 204);

  const { body } = await get('/');
  assert.match(body, /hello/);
  assert.match(body, /EventSource/);
  assert.match(body, /location\.reload/);
});

test('GET /events delivers update event after POST /update', async () => {
  await ensureTestServer();
  const eventPromise = nextSseEvent();
  await post('/update', '<html><body>new</body></html>');
  const raw = await eventPromise;
  assert.match(raw, /event: update/);
});

test('GET /unknown returns 404', async () => {
  await ensureTestServer();
  const { status } = await get('/does-not-exist');
  assert.equal(status, 404);
});
