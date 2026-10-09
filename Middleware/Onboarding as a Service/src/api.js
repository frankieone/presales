/**
 * The screens' only connection: the platform server. Nothing here can reach
 * FrankieOne, and no FrankieOne key or entity ID is ever sent to a browser.
 *
 * The signed-in identity is kept per browser tab (sessionStorage), so a
 * presenter can sign in as two intermediaries in two tabs side by side.
 */
const KEY = 'oaas.session';

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function setSession(s) {
  try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch { /* private mode */ }
}

async function call(method, path, body) {
  const token = getSession()?.token;
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.message || `Request failed (${res.status})`), { code: json.error, status: res.status });
  return json;
}

export const demoSession = () => call('GET', '/demo/session');
export const demoPeople = () => call('GET', '/demo/people');

// intermediary API
export const me = () => call('GET', '/api/v1/me');
export const listClients = () => call('GET', '/api/v1/clients');
export const getClient = (handle) => call('GET', `/api/v1/clients/${handle}`);
export const submitClient = (body) => call('POST', '/api/v1/clients', body);
export const removeClient = (handle) => call('DELETE', `/api/v1/clients/${handle}`);

// platform view
export const network = () => call('GET', '/internal/network');
export const resetDemo = () => call('POST', '/internal/reset');
