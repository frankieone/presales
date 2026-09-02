#!/usr/bin/env node

/**
 * Test: pre-associate individuals, THEN run the UBO/ownership lookup.
 *
 * Question this answers:
 *   If we create the organization entity WITHOUT running the ownership
 *   workflow, manually associate some individuals to it, and only then run
 *   the UBO lookup — does the lookup recognise the already-associated people
 *   and reuse them, or does it add them again as new duplicate entities?
 *
 * Sequence:
 *   1. Lookup the business            POST /v2/organizations/lookup
 *   2. Create the base entity ONLY    POST /v2/organizations       (no workflow)
 *   3. (discovery run, optional)      learn the real officeholder names first
 *   4. Create individuals             POST /v2/individuals         (no workflow)
 *   5. Associate them                 PUT  /v2/organizations/{id}/relationships
 *   6. Snapshot BEFORE                GET  /v2/organizations/{id}/relationships
 *   7. Run the UBO lookup             POST .../workflows/{wf}/execute + poll
 *   8. Snapshot AFTER                 GET relationships + org + execution result
 *   9. Compare by normalised name → reused, duplicated, or dropped?
 *
 * Usage:
 *   node scripts/test-preassociate-then-ubo.mjs --abn 61623506892
 *   node scripts/test-preassociate-then-ubo.mjs --abn 61623506892 \
 *        --person "JANE|CITIZEN|1980-01-01|DR"     # skip discovery run
 *   node scripts/test-preassociate-then-ubo.mjs --name "FOX PTY. LTD."
 *
 * Flags:
 *   --abn / --acn / --name   how to find the business (one is required)
 *   --country AUS            registry country (default AUS)
 *   --workflow <name>        ownership workflow (default from env or GLB-Organization-Ownership)
 *   --service <name>         service profile name (default: whatever the entity has)
 *   --person "G|F|DOB|ROLE"  pre-associate this exact person, skip the discovery run
 *   --no-control             don't also add the made-up control person
 *   --cleanup                delete every entity this script created when done
 *   --dry-run                print the plan and exit without calling the API
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── env ──────────────────────────────────────────────────────────

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env.local — rely on the ambient environment
  }
}

loadEnvFile(join(PROJECT_ROOT, '.env.local'));
loadEnvFile(join(PROJECT_ROOT, '.env'));

const API_BASE = process.env.FRANKIE_API_V2_BASE_URL || 'https://api.uat.frankie.one';
const CUSTOMER_ID = process.env.FRANKIE_CUSTOMER_ID || '';
const API_KEY = process.env.FRANKIE_API_KEY || '';
const CUSTOMER_CHILD_ID = process.env.FRANKIE_CUSTOMER_CHILD_ID || '';

function headers() {
  const h = {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': CUSTOMER_ID,
    api_key: API_KEY,
  };
  if (CUSTOMER_CHILD_ID) h['X-Frankie-CustomerChildID'] = CUSTOMER_CHILD_ID;
  return h;
}

// ─── args ─────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const COUNTRY = args.country || 'AUS';
const WORKFLOW = args.workflow || process.env.FRANKIE_KYB_WORKFLOW_NAME || 'GLB-Organization-Ownership';
const REG_NUMBER = args.abn || args.acn || '';
const COMPANY_NAME = args.name || '';
const DRY_RUN = !!args['dry-run'];
const CLEANUP = !!args.cleanup;
const WITH_CONTROL = !args['no-control'];

if (!REG_NUMBER && !COMPANY_NAME) {
  console.error('Error: supply --abn, --acn, or --name to identify the business.\n');
  console.error('  node scripts/test-preassociate-then-ubo.mjs --abn 61623506892');
  process.exit(1);
}
if (!DRY_RUN && (!CUSTOMER_ID || !API_KEY)) {
  console.error('Error: FRANKIE_CUSTOMER_ID and FRANKIE_API_KEY must be set (.env.local).');
  process.exit(1);
}

// ─── output helpers ───────────────────────────────────────────────

const OUT_DIR = process.env.TEST_OUT_DIR || join(PROJECT_ROOT, '.test-output');
const created = { organizations: [], individuals: [] };
let stepNo = 0;

function step(title) {
  stepNo++;
  console.log(`\n${'═'.repeat(72)}\nSTEP ${stepNo}: ${title}\n${'═'.repeat(72)}`);
}

function dump(name, obj) {
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    const path = join(OUT_DIR, `${name}.json`);
    writeFileSync(path, JSON.stringify(obj, null, 2));
    console.log(`   ↳ full response saved: ${path}`);
  } catch (e) {
    console.log(`   ↳ (could not save ${name}: ${e.message})`);
  }
}

async function api(method, path, body) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  console.log(`   → ${method} ${url.replace(API_BASE, '')}`);
  const res = await fetch(url, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  console.log(`   ← ${res.status}${data?.errorMsg ? ` — ${data.errorMsg}` : ''}`);
  return { status: res.status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── entity-graph extraction ──────────────────────────────────────

/**
 * Pull every individual referenced by an organization payload, tagged with
 * where it came from, so we can spot the same human appearing twice.
 */
function extractPeople(org) {
  const people = [];
  const linkedIndividuals = org?.linkedIndividuals || {};

  const nameOf = (entityId) => {
    const li = linkedIndividuals[entityId];
    if (!li) return '';
    return (
      li.name?.displayName ||
      [li.name?.givenName, li.name?.middleName, li.name?.familyName].filter(Boolean).join(' ') ||
      ''
    );
  };
  const dobOf = (entityId) => {
    const d = linkedIndividuals[entityId]?.dateOfBirth;
    if (!d) return '';
    if (typeof d === 'string') return d;
    return [d.year, d.month, d.day].filter(Boolean).join('-');
  };
  const roleOf = (o) => (typeof o?.role === 'string' ? o.role : o?.role?.description || o?.role?.code || '');

  const add = (entityId, source, role) => {
    if (!entityId) return;
    people.push({ entityId, name: nameOf(entityId), dob: dobOf(entityId), source, role: role || '' });
  };

  for (const o of org?.officials || []) {
    if ((o.entityType || 'INDIVIDUAL') === 'INDIVIDUAL') add(o.entityId, 'officials', roleOf(o));
  }
  for (const s of org?.shareholders || []) {
    if (s.entityType === 'INDIVIDUAL') add(s.entityId, 'shareholders', 'Shareholder');
  }
  for (const u of org?.ultimateBeneficialOwners || []) {
    if ((u.entityType || 'INDIVIDUAL') === 'INDIVIDUAL') add(u.entityId, 'ultimateBeneficialOwners', 'UBO');
  }
  // Anything in linkedIndividuals that no array above referenced
  const seen = new Set(people.map((p) => p.entityId));
  for (const entityId of Object.keys(linkedIndividuals)) {
    if (!seen.has(entityId)) add(entityId, 'linkedIndividuals (unreferenced)', '');
  }

  return people;
}

function relationshipPeople(relData) {
  const rows = [];
  for (const rel of relData?.entityRelationships || []) {
    const entityId = rel.entity?.entityId;
    if (!entityId) continue;
    const roles = (rel.relationships || [])
      .map((r) => r.role?.description || r.role?.code)
      .filter(Boolean)
      .join(', ');
    const sourceIds = (rel.relationships || []).map((r) => r.sourceId).filter(Boolean);
    rows.push({
      entityId,
      entityType: rel.entity?.entityType || 'INDIVIDUAL',
      roles,
      sourceIds,
    });
  }
  return rows;
}

function table(rows, cols) {
  if (rows.length === 0) {
    console.log('   (none)');
    return;
  }
  const widths = cols.map((c) => Math.max(c.label.length, ...rows.map((r) => String(r[c.key] ?? '').length)));
  const line = (cells) => '   ' + cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(line(cols.map((c) => c.label)));
  console.log(line(widths.map((w) => '─'.repeat(w))));
  for (const r of rows) console.log(line(cols.map((c) => r[c.key])));
}

// ─── API operations ───────────────────────────────────────────────

async function lookupBusiness() {
  const body = { region: { country: COUNTRY } };
  if (COMPANY_NAME) body.organizationName = COMPANY_NAME;
  if (REG_NUMBER) body.organizationNumber = { registrationNumber: REG_NUMBER };

  const { status, data } = await api('POST', '/v2/organizations/lookup', body);
  if (status !== 200) throw new Error(`Lookup failed (${status}): ${data?.errorMsg || 'unknown'}`);

  const matches = data?.matchedOrganizations || [];
  if (matches.length === 0) throw new Error('No matching business found.');

  dump('01-lookup', data);
  const m = matches[0];
  const name =
    m.details?.name?.registeredName || m.details?.name?.name || m.name?.registeredName || m.organizationName || '(unnamed)';
  console.log(`   Matched ${matches.length} business(es); using: ${name}`);
  return { token: m.organizationToken, name };
}

async function createBaseEntity(organizationToken, label) {
  const { status, data } = await api('POST', '/v2/organizations', { organizationToken });
  if (status !== 200 && status !== 201) {
    throw new Error(`Create organization failed (${status}): ${data?.errorMsg || 'unknown'}`);
  }
  const entityId = data?.organization?.entityId || data?.entityId;
  if (!entityId) throw new Error('Organization created but no entityId returned.');
  created.organizations.push(entityId);
  dump(`${label}-create-org`, data);
  console.log(`   Organization entityId: ${entityId}`);
  return { entityId, data };
}

async function getOrg(entityId) {
  return api('GET', `/v2/organizations/${entityId}?include=serviceProfiles`);
}

async function resolveService(entityId, fromArgs) {
  if (fromArgs) return fromArgs;
  const { status, data } = await getOrg(entityId);
  if (status === 200) {
    const svc = data?.serviceProfiles?.[0]?.serviceName;
    if (svc) return svc;
  }
  return 'DEFAULT';
}

async function runOwnershipWorkflow(entityId, serviceName) {
  const wf = encodeURIComponent(WORKFLOW);
  const { status, data } = await api(
    'POST',
    `/v2/organizations/${entityId}/serviceprofiles/${serviceName}/workflows/${wf}/execute`,
    {}
  );

  if (status !== 200 && status !== 201 && status !== 202) {
    throw new Error(`Workflow execute failed (${status}): ${data?.errorMsg || data?.errorCode || 'unknown'}`);
  }

  const execId = data?.workflowExecutionId;
  const svc = data?.serviceName || serviceName;
  console.log(`   workflowExecutionId: ${execId || '(none — synchronous)'}`);

  if (status !== 202 || !execId) return { data, execId, serviceName: svc };

  // Poll the org until the workflow leaves IN_PROGRESS, then fetch the result.
  for (let i = 1; i <= 40; i++) {
    await sleep(5000);
    const orgRes = await getOrg(entityId);
    if (orgRes.status !== 200) continue;
    const sp = orgRes.data?.serviceProfiles?.[0] || {};
    const summaries = sp.workflowSummaries || [];
    const target = summaries.find((w) => w.workflowExecutionId === execId) || summaries[summaries.length - 1];
    const state = target?.workflowExecutionState || '';
    console.log(`   [poll ${i}/40] workflow state: ${state || 'unknown'}`);
    if (state && state !== 'IN_PROGRESS' && state !== 'PENDING') {
      const exec = await api(
        'GET',
        `/v2/organizations/${entityId}/serviceprofiles/${svc}/workflows/${wf}/executions/${execId}`
      );
      if (exec.status === 200) return { data: exec.data, execId, serviceName: svc };
      return { data: orgRes.data, execId, serviceName: svc };
    }
  }
  throw new Error('Workflow did not complete within ~3.5 minutes.');
}

/** The enrichment can arrive on `organization` or nested in a step's supplementaryData. */
function orgFromExecution(data) {
  const org = data?.organization || {};
  const hasData = (org.officials?.length || 0) > 0 || (org.shareholders?.length || 0) > 0;
  if (hasData) return org;

  for (const stepResult of data?.workflowResult?.workflowStepResults || []) {
    for (const pr of stepResult.processResults || []) {
      if (pr.supplementaryData?.organization) {
        return { ...org, ...pr.supplementaryData.organization };
      }
    }
  }
  return org;
}

async function createPerson(p) {
  const individual = {
    name: {
      givenName: p.givenName,
      familyName: p.familyName,
      ...(p.middleName ? { middleName: p.middleName } : {}),
    },
    consents: [
      { type: 'GENERAL', granted: true },
      { type: 'DOCS', granted: true },
      { type: 'CREDITHEADER', granted: true },
    ],
  };
  if (p.dateOfBirth) {
    const [year, month, day] = p.dateOfBirth.split('-');
    if (year && month && day) individual.dateOfBirth = { year, month, day };
  }

  // Deliberately NO workflowName — we only want the entity to exist,
  // so nothing else (KYC, duplicate step) muddies the result.
  const { status, data } = await api('POST', '/v2/individuals', { individual });
  if (status !== 200 && status !== 201) {
    throw new Error(`Create individual failed (${status}): ${data?.errorMsg || 'unknown'}`);
  }
  const entityId = data?.individual?.entityId || data?.entityId;
  if (!entityId) throw new Error('Individual created but no entityId returned.');
  created.individuals.push(entityId);
  console.log(`   ${p.givenName} ${p.familyName} → ${entityId}`);
  return entityId;
}

async function associate(orgEntityId, people) {
  const entityRelationships = people.map((p) => ({
    entity: { entityId: p.entityId, entityType: 'INDIVIDUAL' },
    relationships: [
      {
        type: 'OFFICIAL',
        role: { code: p.roleCode, description: p.roleDescription || p.roleCode },
      },
    ],
  }));
  const { status, data } = await api('PUT', `/v2/organizations/${orgEntityId}/relationships`, { entityRelationships });
  dump('05-put-relationships', { status, data });
  if (status !== 200 && status !== 201) {
    throw new Error(`Add relationships failed (${status}): ${data?.errorMsg || data?.errorCode || 'unknown'}`);
  }
  return data;
}

async function deleteEntity(type, entityId) {
  const path = type === 'org' ? `/v2/organizations/${entityId}` : `/v2/individuals/${entityId}`;
  const { status } = await api('DELETE', path);
  return status;
}

// ─── main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPre-associate → then UBO lookup — duplicate behaviour test`);
  console.log(`API base : ${API_BASE}`);
  console.log(`Business : ${COMPANY_NAME || REG_NUMBER} (${COUNTRY})`);
  console.log(`Workflow : ${WORKFLOW}`);
  console.log(`Output   : ${OUT_DIR}`);

  if (DRY_RUN) {
    console.log('\n--dry-run: no API calls made. Plan:');
    console.log('  1. lookup business → organizationToken');
    console.log('  2. discovery run (unless --person given) to learn real officeholders, then delete it');
    console.log('  3. create a FRESH base entity (no workflow)');
    console.log('  4. create 1 exact-match individual + 1 control individual');
    console.log('  5. PUT them onto the org as manual relationships');
    console.log('  6. run the ownership workflow on that same entity');
    console.log('  7. diff people before vs after → reused / duplicated / dropped');
    return;
  }

  // ── 1. Lookup ──
  step('Look up the business (no entity created yet)');
  const { token, name: businessName } = await lookupBusiness();

  // ── 2. Discovery: who does the registry actually return? ──
  let matchPerson = null;

  if (args.person && typeof args.person === 'string') {
    const [givenName, familyName, dateOfBirth, roleCode] = args.person.split('|').map((s) => (s || '').trim());
    if (!givenName || !familyName) {
      throw new Error('--person must look like "GIVEN|FAMILY|YYYY-MM-DD|ROLECODE" (DOB and role optional)');
    }
    const ROLE_DESCRIPTIONS = {
      DR: 'Director',
      SC: 'Secretary',
      SH: 'Shareholder',
      TR: 'Trustee',
      UBO: 'Ultimate Beneficial Owner',
    };
    const code = roleCode || 'DR';
    matchPerson = {
      givenName,
      familyName,
      dateOfBirth: dateOfBirth || undefined,
      roleCode: code,
      roleDescription: ROLE_DESCRIPTIONS[code] || code,
    };
    step('Using the person supplied via --person (discovery run skipped)');
    console.log(`   ${matchPerson.givenName} ${matchPerson.familyName}` +
      `${matchPerson.dateOfBirth ? ` (DOB ${matchPerson.dateOfBirth})` : ''} as ${matchPerson.roleCode}`);
  } else {
    step('Discovery run — find out who the registry returns for this business');
    console.log('   (throwaway entity; deleted straight after so the real test starts clean)');
    const discovery = await createBaseEntity(token, '02a');
    const discoveryService = await resolveService(discovery.entityId, args.service);
    const discoveryResult = await runOwnershipWorkflow(discovery.entityId, discoveryService);
    dump('02b-discovery-result', discoveryResult.data);

    const discoveredOrg = orgFromExecution(discoveryResult.data);
    const discoveredPeople = extractPeople(discoveredOrg);
    console.log('\n   People the registry returned:');
    table(discoveredPeople, [
      { key: 'name', label: 'NAME' },
      { key: 'dob', label: 'DOB' },
      { key: 'role', label: 'ROLE' },
      { key: 'source', label: 'SOURCE' },
      { key: 'entityId', label: 'ENTITY ID' },
    ]);

    const candidate = discoveredPeople.find((p) => p.name && p.source === 'officials') || discoveredPeople.find((p) => p.name);
    if (!candidate) {
      throw new Error(
        'The ownership workflow returned no named individuals for this business, so there is nothing to duplicate. ' +
        'Try a different business, or pass --person to force one.'
      );
    }

    const parts = candidate.name.trim().split(/\s+/);
    matchPerson = {
      givenName: parts[0],
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
      familyName: parts[parts.length - 1],
      dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(candidate.dob) ? candidate.dob : undefined,
      roleCode: 'DR',
      roleDescription: 'Director',
      registryEntityId: candidate.entityId,
    };
    console.log(`\n   Will pre-associate an exact name match for: ${candidate.name}`);
    console.log(`   (registry gave that person entityId ${candidate.entityId} on the throwaway entity)`);

    console.log('\n   Deleting the throwaway entity so the real test starts from nothing...');
    await deleteEntity('org', discovery.entityId);
    created.organizations = created.organizations.filter((id) => id !== discovery.entityId);
  }

  // ── 3. Create the base entity, no workflow ──
  step('Create the base organization entity — WITHOUT running the UBO lookup');
  const { entityId: orgEntityId } = await createBaseEntity(token, '03');
  const serviceName = await resolveService(orgEntityId, args.service);
  console.log(`   Service profile: ${serviceName}`);

  const beforeOrg = await getOrg(orgEntityId);
  dump('03b-org-before', beforeOrg.data);
  const preWorkflowPeople = extractPeople(orgFromExecution(beforeOrg.data));
  console.log(`   People on the entity at this point: ${preWorkflowPeople.length}`);

  // ── 4. Create the individuals ──
  const attachExisting = typeof args['attach-existing'] === 'string' ? args['attach-existing'] : null;
  const people = [];
  let matchEntityId;

  if (attachExisting) {
    // Mitigation path: reuse an individual that already exists rather than
    // creating a second record for the same person.
    step('Use the EXISTING individual (no new individual created)');
    const { status, data } = await api('GET', `/v2/individuals/${attachExisting}`);
    if (status !== 200) {
      throw new Error(`--attach-existing ${attachExisting} not found (${status})`);
    }
    const ind = data.individual || data;
    const n = ind.name || {};
    matchPerson = {
      ...matchPerson,
      givenName: n.givenName || matchPerson.givenName,
      familyName: n.familyName || matchPerson.familyName,
      dateOfBirth: ind.dateOfBirth
        ? [ind.dateOfBirth.year, ind.dateOfBirth.month, ind.dateOfBirth.day].filter(Boolean).join('-')
        : matchPerson.dateOfBirth,
    };
    matchEntityId = attachExisting;
    console.log(`   ${matchPerson.givenName} ${matchPerson.familyName} → ${matchEntityId} (pre-existing)`);
  } else {
    step('Create the individuals (plain entities, no workflow run on them)');
    matchEntityId = await createPerson(matchPerson);
  }

  people.push({
    label: 'MATCH',
    entityId: matchEntityId,
    displayName: `${matchPerson.givenName} ${matchPerson.familyName}`,
    roleCode: matchPerson.roleCode,
    roleDescription: matchPerson.roleDescription,
  });

  if (WITH_CONTROL) {
    const control = {
      givenName: 'Rowan',
      familyName: 'Testcontrol',
      dateOfBirth: '1980-01-01',
      roleCode: 'UBO',
      roleDescription: 'Ultimate Beneficial Owner',
    };
    const controlEntityId = await createPerson(control);
    people.push({
      label: 'CONTROL',
      entityId: controlEntityId,
      displayName: `${control.givenName} ${control.familyName}`,
      roleCode: control.roleCode,
      roleDescription: control.roleDescription,
    });
  }

  // ── 5. Associate them ──
  step('Associate both individuals with the organization');
  await associate(orgEntityId, people);
  for (const p of people) console.log(`   ${p.label}: ${p.displayName} (${p.entityId}) as ${p.roleCode}`);

  // ── 6. Snapshot BEFORE ──
  step('Snapshot BEFORE the UBO lookup');
  const relBefore = await api('GET', `/v2/organizations/${orgEntityId}/relationships`);
  dump('06-relationships-before', relBefore.data);
  const relBeforeRows = relationshipPeople(relBefore.data);
  console.log('\n   Manual relationships on the org:');
  table(relBeforeRows, [
    { key: 'entityId', label: 'ENTITY ID' },
    { key: 'entityType', label: 'TYPE' },
    { key: 'roles', label: 'ROLES' },
  ]);

  // ── 7. Run the UBO lookup ──
  step('NOW run the UBO / ownership lookup on the same entity');
  const wfResult = await runOwnershipWorkflow(orgEntityId, serviceName);
  dump('07-ownership-result', wfResult.data);

  // ── 8. Snapshot AFTER ──
  step('Snapshot AFTER the UBO lookup');
  const afterOrgRes = await getOrg(orgEntityId);
  dump('08a-org-after', afterOrgRes.data);
  const relAfter = await api('GET', `/v2/organizations/${orgEntityId}/relationships`);
  dump('08b-relationships-after', relAfter.data);

  const wfOrg = orgFromExecution(wfResult.data);
  const orgAfter = orgFromExecution(afterOrgRes.data);
  // Prefer whichever payload actually carries the enrichment.
  const richOrg =
    (wfOrg.officials?.length || wfOrg.shareholders?.length) ? wfOrg : orgAfter;

  const peopleAfter = extractPeople(richOrg);
  console.log('\n   Individuals on the organization after the lookup:');
  table(peopleAfter, [
    { key: 'name', label: 'NAME' },
    { key: 'dob', label: 'DOB' },
    { key: 'role', label: 'ROLE' },
    { key: 'source', label: 'SOURCE' },
    { key: 'entityId', label: 'ENTITY ID' },
  ]);

  const relAfterRows = relationshipPeople(relAfter.data);
  console.log('\n   Manual relationships after the lookup:');
  table(relAfterRows, [
    { key: 'entityId', label: 'ENTITY ID' },
    { key: 'entityType', label: 'TYPE' },
    { key: 'roles', label: 'ROLES' },
  ]);

  // ── 9. Verdict ──
  step('VERDICT');

  const matchName = norm(`${matchPerson.givenName} ${matchPerson.familyName}`);
  const sameName = peopleAfter.filter((p) => {
    const n = norm(p.name);
    // match on given+family appearing in the returned name, in either order
    return n === matchName || (n.includes(norm(matchPerson.givenName)) && n.includes(norm(matchPerson.familyName)));
  });
  const distinctIds = [...new Set(sameName.map((p) => p.entityId))];
  const preAddedStillLinked = relAfterRows.some((r) => r.entityId === matchEntityId);
  const preAddedInOwnership = peopleAfter.some((p) => p.entityId === matchEntityId);

  console.log(`\n   Pre-added person      : ${matchPerson.givenName} ${matchPerson.familyName}` +
    `${matchPerson.dateOfBirth ? ` (DOB ${matchPerson.dateOfBirth})` : ' (no DOB)'}`);
  console.log(`   Our entityId for them : ${matchEntityId}`);
  console.log(`   Same name after lookup: ${distinctIds.length} distinct entityId(s)`);
  for (const p of sameName) {
    const tag = p.entityId === matchEntityId ? '  ← OUR pre-added entity' : '  ← created by the lookup';
    console.log(`     • ${p.entityId}  [${p.source}]${tag}`);
  }

  console.log('');
  if (preAddedInOwnership && distinctIds.length === 1) {
    console.log('   ✅ REUSED — the lookup matched our pre-added individual and did not add them again.');
  } else if (distinctIds.length > 1) {
    console.log('   ⚠️  DUPLICATED — the lookup created a SECOND entity for the same person.');
    console.log('      The registry-sourced official and our manually added associate are separate entities.');
  } else if (sameName.length > 0 && !preAddedInOwnership) {
    console.log('   ⚠️  DUPLICATED (separate lanes) — the person appears in the ownership data under a');
    console.log('      different entityId, while our pre-added entity only exists as a manual relationship.');
  } else {
    console.log('   ❓ INCONCLUSIVE — that name did not come back in the ownership data at all.');
    console.log('      Check the saved JSON in the output directory.');
  }

  console.log(`\n   Manual relationships survived the lookup: ${preAddedStillLinked ? 'YES' : 'NO'}`);
  if (WITH_CONTROL) {
    const controlEntityId = people.find((p) => p.label === 'CONTROL')?.entityId;
    const controlLinked = relAfterRows.some((r) => r.entityId === controlEntityId);
    const controlInOwnership = peopleAfter.some((p) => p.entityId === controlEntityId);
    console.log(`   Control person still a manual relationship: ${controlLinked ? 'YES' : 'NO'}`);
    console.log(`   Control person appears in ownership data  : ${controlInOwnership ? 'YES' : 'NO'}`);
    console.log('      (a control person who is NOT in the registry — proves the lookup does not wipe');
    console.log('       manually added associates, and shows which lane they end up in)');
  }

  console.log('\n   Entities created by this run:');
  console.log(`     organization : ${orgEntityId}`);
  for (const p of people) console.log(`     individual   : ${p.entityId}  (${p.label} — ${p.displayName})`);
  console.log(`\n   Raw JSON for every call: ${OUT_DIR}`);

  if (CLEANUP) {
    step('Cleanup — deleting everything this run created');
    for (const id of created.individuals) await deleteEntity('individual', id);
    for (const id of created.organizations) await deleteEntity('org', id);
  } else {
    console.log('\n   (run again with --cleanup to delete these, or view them in the portal)');
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  if (created.organizations.length || created.individuals.length) {
    console.error('\nEntities created before the failure (clean these up if needed):');
    for (const id of created.organizations) console.error(`  organization: ${id}`);
    for (const id of created.individuals) console.error(`  individual  : ${id}`);
  }
  process.exit(1);
});
