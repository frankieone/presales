/**
 * The platform layer's HTTP server.
 *
 *   /api/v1/*     the intermediary API. Bearer token per intermediary; every
 *                 response is built from the permitted list.
 *   /internal/*   the platform's own compliance and operations view. In
 *                 production this sits behind staff SSO on a separate host.
 *   /demo/*       presenter conveniences: the sign-in list and test identities.
 *                 Not part of the pattern; remove for anything real.
 *
 * In development, Vite serves the screens and proxies these paths here.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FRANKIE, NAMED_IDS, PLATFORM, POLICY, SECRET, byId } from './config.mjs';
import { ClientError, decide, forgetIndex, intermediaryForToken, list, network, offboard, onboard, refresh, reverseMerge, tokenFor } from './tier1.mjs';
import { store } from './store.mjs';
import { DEMO_PEOPLE } from './demo-people.mjs';

const OPERATOR_TOKEN = `opt_${crypto.createHmac('sha256', `${SECRET}:operator`).update('operator').digest('hex').slice(0, 32)}`;
const DIST = path.resolve(import.meta.dirname, '..', 'dist');

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new ClientError(400, 'BAD_JSON', 'Request body is not valid JSON.'); }
}

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // ── intermediary API ──
  if (p.startsWith('/api/v1/')) {
    const im = intermediaryForToken(bearer(req));
    if (!im) return send(res, 401, { error: 'UNAUTHORISED', message: 'A valid intermediary token is required.' });
    if (p === '/api/v1/me' && req.method === 'GET') {
      return send(res, 200, { id: im.id, name: im.name, kind: im.kind, colour: im.colour, platform: PLATFORM.name });
    }
    if (p === '/api/v1/clients' && req.method === 'GET') return send(res, 200, { clients: list(im) });
    if (p === '/api/v1/clients' && req.method === 'POST') return send(res, 201, await onboard(im, await readBody(req)));
    const m = p.match(/^\/api\/v1\/clients\/(C-[A-Z0-9]+)$/);
    if (m && req.method === 'GET') return send(res, 200, await refresh(im, m[1]));
    if (m && req.method === 'DELETE') return send(res, 200, await offboard(im, m[1]));
    return send(res, 404, { error: 'NOT_FOUND' });
  }

  // ── the platform's own view ──
  if (p.startsWith('/internal/')) {
    if (bearer(req) !== OPERATOR_TOKEN) return send(res, 401, { error: 'UNAUTHORISED' });
    if (p === '/internal/network') return send(res, 200, network());
    if (p === '/internal/reset' && req.method === 'POST') { store.reset(); return send(res, 200, { reset: true }); }
    const rv = p.match(/^\/internal\/reviews\/(R-[A-Z0-9]+)$/);
    if (rv && req.method === 'POST') { const b = await readBody(req); return send(res, 200, await decide(rv[1], b.decision, b.entityId)); }
    const mg = p.match(/^\/internal\/merges\/(M-[A-Z0-9]+)\/reverse$/);
    if (mg && req.method === 'POST') return send(res, 200, await reverseMerge(mg[1]));
    if (p === '/internal/forget' && req.method === 'POST') return send(res, 200, forgetIndex((await readBody(req)).entityId));
    return send(res, 404, { error: 'NOT_FOUND' });
  }

  // ── presenter conveniences ──
  if (p === '/demo/session') {
    return send(res, 200, {
      platform: PLATFORM.name,
      envLabel: PLATFORM.envLabel,
      intermediariesConfigured: Object.keys(byId).length,
      intermediaries: NAMED_IDS.map((id) => ({ ...byId[id], token: tokenFor(id) })),
      operatorToken: OPERATOR_TOKEN,
      minResponseMs: POLICY.minResponseMs,
    });
  }
  if (p === '/demo/people') return send(res, 200, { people: DEMO_PEOPLE });

  // ── built screens (npm run build), if present ──
  if (fs.existsSync(DIST)) {
    const file = path.join(DIST, p === '/' || !path.extname(p) ? 'index.html' : p);
    if (file.startsWith(DIST) && fs.existsSync(file)) {
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      return fs.createReadStream(file).pipe(res);
    }
  }
  return send(res, 404, { error: 'NOT_FOUND' });
}

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    if (err instanceof ClientError) return send(res, err.status, { error: err.code, message: err.message });
    // Never pass FrankieOne's error detail to an intermediary.
    console.error('[platform]', err.message, err.detail ? JSON.stringify(err.detail).slice(0, 300) : '');
    send(res, 502, { error: 'UNAVAILABLE', message: 'Onboarding is temporarily unavailable.' });
  }
});

if (!FRANKIE.apiKey || !FRANKIE.customerId) {
  console.warn('[platform] FRANKIE_API_KEY / FRANKIE_CUSTOMER_ID missing in .env.local — onboarding calls will fail.');
}
server.listen(PLATFORM.port, () => console.log(`[platform] ${PLATFORM.name} layer on http://localhost:${PLATFORM.port}`));
