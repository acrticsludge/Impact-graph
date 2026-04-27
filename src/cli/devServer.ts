import * as http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

export const PORT = Number(process.env['IMPACT_GRAPH_PORT'] ?? 51789);
export const HOST = '127.0.0.1';
export const BASE_URL = `http://${HOST}:${PORT}`;

const SSE_SCRIPT = `
<script>
(function(){
  var es = new EventSource('/events');
  es.addEventListener('update', function(){ location.reload(); });
  es.addEventListener('error', function(){ setTimeout(function(){ location.reload(); }, 2000); });
})();
</script>`;

const PLACEHOLDER = `<!doctype html><html><head><meta charset="utf-8"><title>Impact Graph</title>
<style>body{background:#0f172a;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:16px}</style>
</head><body><p>Waiting for first analysis… run <code>impact-graph visualize</code></p>${SSE_SCRIPT}</body></html>`;

let currentHtml: string | null = null;
const sseClients = new Set<http.ServerResponse>();

function injectSseScript(html: string): string {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + SSE_SCRIPT;
  return html.slice(0, idx) + SSE_SCRIPT + html.slice(idx);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  if (method === 'GET' && url === '/') {
    const html = currentHtml ? injectSseScript(currentHtml) : PLACEHOLDER;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (method === 'HEAD' && url === '/') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (method === 'GET' && url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(':ok\n\n');
    sseClients.add(res);
    const heartbeat = setInterval(() => { res.write(':heartbeat\n\n'); }, 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
    return;
  }

  if (method === 'POST' && url === '/reset') {
    currentHtml = null;
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === 'POST' && url === '/update') {
    readBody(req).then(body => {
      currentHtml = body;
      for (const client of sseClients) {
        client.write('event: update\ndata: 1\n\n');
      }
      res.writeHead(204);
      res.end();
    }).catch(() => {
      res.writeHead(500);
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end();
}

export function startServer(options?: { unref?: boolean }): Promise<void> {
  const shouldUnref = options?.unref ?? true;
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest);
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[impact-graph] Port ${PORT} is already in use. Kill the existing process or set IMPACT_GRAPH_PORT to a different value.`);
      }
      reject(err);
    });
    server.listen(PORT, HOST, () => {
      if (shouldUnref) server.unref();
      console.log(`[impact-graph] Visualization server running at ${BASE_URL}`);
      resolve();
    });
  });
}

export async function pushHtml(html: string): Promise<void> {
  const body = Buffer.from(html, 'utf-8');
  await new Promise<void>((resolve, reject) => {
    const req = http.request(
      { hostname: HOST, port: PORT, path: '/update', method: 'POST',
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length } },
      res => {
        res.resume();
        res.on('end', resolve);
      }
    );
    req.setTimeout(3_000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end(body);
  });
}

export function isServerUp(): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.request(
      { hostname: HOST, port: PORT, path: '/', method: 'HEAD' },
      () => { resolve(true); }
    );
    req.setTimeout(300, () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function spawnDetachedServer(): Promise<void> {
  // Resolve the dist entry point from this module's location
  const thisFile = fileURLToPath(import.meta.url);
  const entryPoint = path.join(path.dirname(thisFile), '..', 'index.js');

  const child = spawn(process.execPath, [entryPoint, '__serve'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, IMPACT_GRAPH_PORT: String(PORT) },
  });
  child.unref();

  // Poll until the server is up (up to 4s)
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 150));
    if (await isServerUp()) return;
  }
  throw new Error(`[impact-graph] Server did not start on port ${PORT} within 4s.`);
}

export async function ensureServer(): Promise<boolean> {
  if (await isServerUp()) return false; // already running
  await spawnDetachedServer();
  return true; // we just started it
}
