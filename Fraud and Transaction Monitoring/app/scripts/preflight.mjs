#!/usr/bin/env node
/**
 * Start-up checks: does the FrankieOne account still behave the way the demos
 * depend on? Runs before every `npm run banking|super|smsf|all`, or on its own
 * with `npm test`.
 *
 * These are live calls to the account in .env.local. Each run creates a
 * handful of throwaway entities named "PREFLIGHT …" in that account.
 *
 * Exit code is the number of failed checks (0 = all good). The start scripts
 * report failures but still start the server.
 *
 * Usage: node scripts/preflight.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

// .env.local, read for the named settings below only (simple KEY=value lines).
function loadEnvFile(path) {
  try {
    const entries = readFileSync(path, 'utf-8').split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
      });
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}
const fileEnv = loadEnvFile(resolve(here, '../.env.local'));
const setting = (name) => fileEnv?.[name];
const ONESDK_BFF = setting('VITE_FRANKIE_BFF_URL') || 'https://backend.kycaml.uat.frankiefinancial.io';

// Workflows the demos call by name.
const REQUIRED_WORKFLOWS = ['Device-Email-Phone-NoAML', 'Email-Phone-NoAML'];
const DEMO_FLAGS = {
  email: 'preflight.flag@highrisk.com', // the demo's high-risk email rule
  phone: '0403666666', // the demo's high-risk phone rule
};

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const results = [];
async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`  ${green('✓')} ${name}${detail ? dim(` — ${detail}`) : ''} ${dim(`${Date.now() - started}ms`)}`);
  } catch (err) {
    results.push({ name, ok: false, why: err.message });
    console.log(`  ${red('✗')} ${name}\n      ${red(err.message)}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ── credentials ─────────────────────────────────────────────────────
if (!fileEnv) {
  console.log(red('Cannot read .env.local — copy env.example to .env.local and fill it in.'));
  process.exit(1);
}
const creds = {
  server: setting('VITE_FRANKIE_API_URL') || 'https://api.uat.frankie.one',
  customerId: setting('VITE_FRANKIE_CUSTOMER_ID'),
  customerChildId: setting('VITE_FRANKIE_CUSTOMER_CHILD_ID'),
  apiKey: setting('VITE_FRANKIE_API_KEY'),
  clientId: setting('VITE_SARDINE_CLIENT_ID'),
};

const headers = {
  'Content-Type': 'application/json',
  'X-Frankie-CustomerID': creds?.customerId,
  api_key: creds?.apiKey,
  ...(creds?.customerChildId ? { 'X-Frankie-CustomerChildID': creds.customerChildId } : {}),
};
async function api(method, path, body) {
  const res = await fetch(`${creds.server}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}
async function person(given, family, { email, phone }) {
  const { status, json } = await api('POST', '/v2/individuals', { individual: {
    name: { givenName: given, familyName: family },
    dateOfBirth: { year: '1990', month: '01', day: '01' },
    consents: [{ type: 'GENERAL', granted: true }, { type: 'DOCS', granted: true }],
    emailAddresses: [{ email, type: 'PERSONAL', isPreferred: true }],
    phoneNumbers: [{ number: phone, type: 'MOBILE', country: 'AUS', isPreferred: true }],
  } });
  assert(status === 201, `create individual returned ${status}`);
  return json.individual.entityId;
}
async function fraudResult(entityId, workflow) {
  let { status, json } = await api('POST', `/v2/individuals/${entityId}/serviceprofiles/DEFAULT/workflows/${workflow}/execute`, {});
  assert(status < 300, `execute ${workflow} returned ${status}`);
  if (json.workflowExecutionId && !json.workflowResult?.workflowStepResults) {
    for (let i = 0; i < 10 && !json.workflowResult?.workflowStepResults; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      ({ json } = await api('GET', `/v2/individuals/${entityId}/serviceprofiles/DEFAULT/workflows/${workflow}/executions/${json.workflowExecutionId}`));
    }
  }
  const fraud = json.workflowResult?.workflowStepResults?.find((s) => s.stepName === 'FRAUD');
  const level = (type) => fraud?.processResults?.find((p) => p.supplementaryData?.type === type)?.supplementaryData?.riskLevel;
  return { status: json.workflowResult?.status, email: level('FRAUD_EMAIL_ADDRESS'), phone: level('FRAUD_PHONE_NUMBER') };
}

console.log(`\nPre-flight checks · ${setting('VITE_ENV_LABEL') || 'FrankieOne'} · ${creds.server}\n`);

await check('Credentials present', async () => {
  const names = { customerId: 'VITE_FRANKIE_CUSTOMER_ID', apiKey: 'VITE_FRANKIE_API_KEY', clientId: 'VITE_SARDINE_CLIENT_ID' };
  const missing = Object.keys(names).filter((k) => !creds[k]).map((k) => names[k]);
  assert(!missing.length, `missing in .env.local: ${missing.join(', ')}`);
});

await check('Demo config: all three verticals complete', async () => {
  const { VERTICALS, REQUIRED_KEYS } = await import('../src/config/verticals.js');
  for (const id of ['banking', 'super', 'smsf']) {
    const v = VERTICALS[id];
    assert(v, `vertical "${id}" missing`);
    const gaps = REQUIRED_KEYS.filter((k) => v[k] === undefined);
    assert(!gaps.length, `${id} is missing ${gaps.join(', ')}`);
    assert(v.scenarios.length > 0, `${id} has no demo scenarios`);
    if (v.people.enabled) assert(v.member, `${id} has related people but no member page wording`);
  }
  return 'banking, super, smsf';
});

let workflows = [];
await check('API reachable and key accepted', async () => {
  const { status, json } = await api('GET', '/v2/workflows');
  assert(status === 200, `GET /v2/workflows returned ${status}`);
  workflows = (json.workflows || []).map((w) => w.workflowName);
  return `${workflows.length} workflows on the account`;
});

await check('Required workflows exist', async () => {
  const missing = REQUIRED_WORKFLOWS.filter((w) => !workflows.includes(w));
  assert(!missing.length, `missing: ${missing.join(', ')}`);
  return REQUIRED_WORKFLOWS.join(', ');
});

await check('OneSDK session can be issued (embedded device capture)', async () => {
  const auth = Buffer.from([creds.customerId, creds.customerChildId, creds.apiKey].filter(Boolean).join(':')).toString('base64');
  const res = await fetch(`${ONESDK_BFF}/auth/v2/machine-session`, {
    method: 'POST',
    headers: { authorization: `machine ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions: { preset: 'one-sdk', reference: `preflight-${Date.now()}` } }),
  });
  assert(res.status === 200, `${ONESDK_BFF} returned ${res.status}`);
  return ONESDK_BFF.replace('https://', '');
});

await check('Container: create unnamed, then rename', async () => {
  const { status, json } = await api('POST', '/v2/organizations', { organization: {
    details: { name: { name: 'PENDING APPLICATION' }, organizationType: 'COMPANY', region: { country: 'AUS' } },
    addresses: [{ type: 'REGISTERED_OFFICE', country: 'AUS' }],
    externalReferences: [{ type: 'CUSTOMER', name: 'APPLICATION_ID', value: `PREFLIGHT-${Date.now()}` }],
  } });
  assert(status === 201, `create organization returned ${status}`);
  const id = json.organization.entityId;
  const renamed = await api('PATCH', `/v2/organizations/${id}`, { organization: { details: { name: { name: 'PREFLIGHT TEST PTY LTD' } } } });
  assert(renamed.status === 200, `rename returned ${renamed.status}`);
});

await check('Device session can be registered', async () => {
  const id = await person('PREFLIGHT', 'SESSION', { email: 'preflight.session@example.com', phone: '0412345678' });
  const { status, json } = await api('POST', `/v2/individuals/${id}/sessions`, { session: { providerName: 'sardine' } });
  assert(status === 200 && json.session?.token, `register session returned ${status}`);
});

await check('Email rule flags a high-risk email', async () => {
  const id = await person('PREFLIGHT', 'EMAILFLAG', { email: DEMO_FLAGS.email, phone: '0412345678' });
  const r = await fraudResult(id, 'Email-Phone-NoAML');
  assert(r.email === 'HIGH', `email came back ${r.email} — is the high-risk email rule Live in Sardine?`);
  return `email HIGH, workflow ${r.status}`;
});

await check('Phone rule flags 0403 666 666', async () => {
  const id = await person('PREFLIGHT', 'PHONEFLAG', { email: 'preflight.phone@example.com', phone: DEMO_FLAGS.phone });
  const r = await fraudResult(id, 'Email-Phone-NoAML');
  assert(r.phone === 'HIGH', `phone came back ${r.phone} — is the high-risk phone rule Live in Sardine?`);
  return `phone HIGH, workflow ${r.status}`;
});

await check('Clean details pass', async () => {
  const id = await person('PREFLIGHT', 'CLEAN', { email: 'preflight.clean@example.com', phone: '0412345678' });
  const r = await fraudResult(id, 'Email-Phone-NoAML');
  assert(r.status === 'PASS', `workflow came back ${r.status} (email ${r.email}, phone ${r.phone})`);
  return 'PASS';
});

await check('Hosted ID capture link can be generated', async () => {
  const id = await person('PREFLIGHT', 'HOSTED', { email: 'preflight.hosted@example.com', phone: '0412345678' });
  const { status, json } = await api('POST', '/v2/individuals/hostedUrl', { entityId: id, consent: true, oneSDKFlowId: 'idv_daon', sendSMS: false });
  assert(status === 200 && json.url, `hostedUrl returned ${status}`);
});

const failed = results.filter((r) => !r.ok);
console.log(failed.length
  ? `\n${red(`${failed.length} of ${results.length} checks failed.`)} The demo may not behave as expected.\n`
  : `\n${green(`All ${results.length} checks passed.`)}\n`);
process.exit(failed.length);
