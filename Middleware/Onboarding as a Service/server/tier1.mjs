/**
 * The platform layer (tier 1): what sits between intermediaries and the one
 * FrankieOne account.
 *
 *   recognise   hash the identity document, look it up in the index
 *   attach      add this intermediary's reference to a record already held,
 *               or create the record
 *   verify      run this intermediary's own workflow on that record
 *   respond     build a new response from the permitted list, never trim
 *               FrankieOne's; hold it to the minimum response time
 *   log         record what was disclosed to whom
 */
import crypto from 'node:crypto';
import { BUSINESS_WORKFLOW, DUPLICATE_WORKFLOW, INTERMEDIARIES, PERMITTED_FIELDS, PERMITTED_PERSON_FIELDS, POLICY, ROLES, SECRET, byId, refName } from './config.mjs';
import * as frankie from './frankie.mjs';
import { store } from './store.mjs';
import { schedule } from './queue.mjs';

const hmac = (purpose, value) => crypto.createHmac('sha256', `${SECRET}:${purpose}`).update(value).digest();
const b32 = (buf) => {
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  let out = '';
  for (const byte of buf) out += alphabet[byte % alphabet.length];
  return out;
};

// ── identity ─────────────────────────────────────────────────────────
/** Match key from an identity document. Email and phone never match on their own. */
export function matchKey(doc) {
  const norm = (s) => String(s || '').toUpperCase().replace(/[\s-]/g, '');
  return hmac('index', `${norm(doc.type)}|${norm(doc.country || 'AUS')}|${norm(doc.number)}`).toString('hex');
}

/** One-way, per-intermediary handle: the same person has a different handle at each intermediary. */
export const handleFor = (intermediaryId, entityId) => `C-${b32(hmac(`handle:${intermediaryId}`, entityId)).slice(0, 8)}`;

/** Access tokens: each one reaches one intermediary's clients only. */
export const tokenFor = (intermediaryId) => `imt_${hmac('token', intermediaryId).toString('hex').slice(0, 32)}`;
const tokens = Object.fromEntries(INTERMEDIARIES.map((i) => [tokenFor(i.id), i.id]));
export const intermediaryForToken = (token) => byId[tokens[token]] || null;

// ── outcome mapping ─────────────────────────────────────────────────
const STEP = (result, name) => (result?.workflowStepResults || []).find((s) => s.stepName === name)?.result;

function outcome(result) {
  const status = result?.status;
  const risk = String(result?.riskAssessment?.riskLevel || result?.riskAssessment?.level || '').toUpperCase();
  const band = risk.startsWith('UNACC') || risk === 'HIGH' ? 'High' : risk === 'MEDIUM' ? 'Medium' : risk === 'LOW' ? 'Low' : status === 'PASS' ? 'Low' : 'Medium';
  if (status === 'PASS') return { status: 'VERIFIED', riskBand: band, actions: [] };
  if (STEP(result, 'MATCHLIST') === 'HIT' || status === 'BLOCKED') {
    // A network decline: never says why, never mentions a blocklist or another intermediary.
    return { status: 'DECLINED', riskBand: 'High', actions: [] };
  }
  if (status === 'FAIL') {
    return {
      status: 'ACTION_REQUIRED', riskBand: band,
      actions: [{ code: 'COLLECT_DOCUMENTS', message: 'Identity could not be verified from the details supplied. Collect a certified identity document from the client.', owner: 'INTERMEDIARY' }],
    };
  }
  return {
    status: 'IN_REVIEW', riskBand: band,
    actions: [{ code: 'UNDER_REVIEW', message: 'This application is being reviewed. You will see the outcome here.', owner: 'PLATFORM' }],
  };
}

// ── responses ───────────────────────────────────────────────────────
/**
 * Build what an intermediary receives from its own relationship record,
 * copying permitted fields only. Everything else is withheld: other
 * intermediaries, reuse, entity IDs, scores, data sources, blocklist detail.
 */
export function respond(rel, action) {
  const out = {};
  const view = { ...rel, kind: rel.kind === 'business' ? 'BUSINESS' : 'INDIVIDUAL' };
  for (const field of PERMITTED_FIELDS) if (view[field] !== undefined) out[field] = view[field];
  if (out.people) out.people = out.people.map((p) => Object.fromEntries(PERMITTED_PERSON_FIELDS.map((f) => [f, p[f]])));
  store.disclose(rel.intermediaryId, rel.handle, Object.keys(out), action);
  return out;
}

async function heldTo(minMs, started, value) {
  const wait = minMs - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return value;
}

// ── probing controls ────────────────────────────────────────────────
function rateLimited(intermediaryId) {
  const since = Date.now() - 60_000;
  return store.submissions().filter((s) => s.intermediaryId === intermediaryId && Date.parse(s.at) > since).length >= POLICY.ratePerMinute;
}

export class ClientError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// ── scenarios ───────────────────────────────────────────────────────
function toIndividual(p, intermediary, clientRef) {
  const doc = p.document;
  const identity = doc.type === 'NATIONAL_HEALTH_ID'
    ? { type: 'NATIONAL_HEALTH_ID', class: 'IDENTITY', primaryIdentifier: doc.number, subtype: doc.cardColour || 'G', country: 'AUS', subdivision: doc.subdivision,
        expiryDate: { year: (doc.expiry || '2030-01-01').slice(0, 4), month: (doc.expiry || '2030-01-01').slice(5, 7), day: (doc.expiry || '2030-01-01').slice(8, 10), unstructured: doc.expiry || '2030-01-01', type: 'GREGORIAN' },
        supplementaryData: { type: 'NATIONAL_HEALTH_ID', reference: doc.cardReference || '1', nameOnCardLine1: doc.nameOnCard || `${p.givenName} ${p.familyName}`.toUpperCase(), nameOnCardLine2: 'null', nameOnCardLine3: 'null', nameOnCardLine4: 'null', middleNameOnCard: 'null' } }
    : { type: doc.type, class: 'IDENTITY', primaryIdentifier: doc.number, ...(doc.secondary ? { secondaryIdentifier: doc.secondary } : {}), country: doc.country || 'AUS', ...(doc.subdivision ? { subdivision: doc.subdivision } : {}),
        ...(doc.expiry ? { expiryDate: { year: doc.expiry.slice(0, 4), month: doc.expiry.slice(5, 7), day: doc.expiry.slice(8, 10), type: 'GREGORIAN' } } : {}) };
  const [year, month, day] = p.dateOfBirth.split('-');
  return {
    name: { givenName: p.givenName, ...(p.middleName ? { middleName: p.middleName } : {}), familyName: p.familyName },
    dateOfBirth: { year, month, day },
    addresses: [{ type: 'RESIDENTIAL', status: 'CURRENT', ...p.address, country: p.address?.country || 'AUS' }],
    documents: { IDENTITY: [identity] },
    ...(p.email ? { emailAddresses: [{ email: p.email, type: 'PERSONAL', isPreferred: true }] } : {}),
    ...(p.phone ? { phoneNumbers: [{ number: p.phone, type: 'MOBILE', country: 'AUS', isPreferred: true }] } : {}),
    externalReferences: [reference(intermediary, clientRef)],
    consents: [{ type: 'GENERAL' }, { type: 'DOCS' }, { type: 'CREDITHEADER' }],
  };
}

const reference = (intermediary, clientRef) => ({ name: refName(intermediary.id), value: clientRef, type: 'CUSTOMER', description: `${intermediary.name} client reference` });

// ── activity log (platform view only) ──────────────────────────────
const short = (id) => (id ? id.slice(0, 8) : '');
const poss = (name) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
const holders = (entityId) => [...new Set(store.relationshipsOf(entityId).map((r) => byId[r.intermediaryId]?.name))].join(', ') || 'no one';
const DOC_LABEL = { DRIVERS_LICENSE: 'driver licence', PASSPORT: 'passport', NATIONAL_HEALTH_ID: 'Medicare card' };
const STATUS_LABEL = { VERIFIED: 'Verified', IN_REVIEW: 'In review', ACTION_REQUIRED: 'Action required', DECLINED: 'Declined' };

function tracer(intermediary, clientRef, title) {
  const entry = { id: `A-${Date.now().toString(36).toUpperCase()}`, at: new Date().toISOString(), intermediary: intermediary.name, clientRef, title, steps: [] };
  return {
    step: (text, kind = 'platform') => entry.steps.push({ at: new Date().toISOString(), text, kind }),
    done: (result) => { entry.result = result; store.addActivity(entry); },
  };
}

// ── duplicates (scenario 3) ─────────────────────────────────────────
const dupStep = (run) => (run?.workflowResult?.workflowStepResults || []).find((s) => s.stepName === 'DUPLICATE');
const openMatches = (run) => (dupStep(run)?.processResults || []).filter((p) => p.class === 'DUPLICATE' && p.result === 'HIT' && !p.manualStatus);
const matchedOn = (pr) => (pr.supplementaryData?.matchedFields || []).map((f) => f.objectType);

/** The merge policy: identity document and exact date of birth, and nothing else in contention. */
function meetsMergePolicy(candidates) {
  if (!POLICY.autoMergeOnDocumentAndDob || candidates.length !== 1) return false;
  const f = candidates[0].supplementaryData?.matchedFields || [];
  const exact = (t) => f.some((x) => x.objectType === t && x.matchStrength >= 100);
  return exact('DOCUMENT') && exact('DATE_OF_BIRTH');
}

/**
 * Read the duplicate check on a newly created record. Returns { clear } when
 * nothing in the platform's network matches, { merge } when the merge policy
 * is met, or { hold } for a person to decide.
 */
async function checkDuplicates(entityId, run) {
  const matches = openMatches(run);
  const network = store.networkEntities();
  network.delete(entityId);
  const inNetwork = (p) => !POLICY.sharedDemoAccount || network.has(p.supplementaryData?.duplicateEntityId);
  const outside = matches.filter((p) => !inNetwork(p));
  const candidates = matches.filter(inNetwork);
  if (outside.length) {
    // Other demos' test people on a shared account; tidy them away, best effort.
    await frankie.resolveDuplicates(entityId, outside.map((p) => p.processResultId), 'FALSE_POSITIVE',
      'Outside the platform network (shared demo account); not a platform record.').catch(() => {});
  }
  if (!candidates.length) return { clear: true, setAside: outside.length };
  return meetsMergePolicy(candidates) ? { merge: candidates[0], setAside: outside.length } : { hold: candidates, setAside: outside.length };
}

/**
 * Same person: keep the record the platform already holds, retire the new
 * one, move this intermediary's reference across, and run its verification
 * on the surviving record. Results are never moved between records.
 */
async function mergeInto(retiredId, pr, intermediary, rel, reason, decidedBy) {
  const survivor = pr.supplementaryData.duplicateEntityId;
  await frankie.resolveDuplicates(retiredId, [pr.processResultId], 'TRUE_POSITIVE_REJECT', reason);
  if (rel.referenceId) await frankie.removeReference(retiredId, rel.referenceId).catch(() => {});
  const patched = await frankie.addReference(survivor, reference(intermediary, rel.clientRef));
  const run = await frankie.verifyExisting(survivor, intermediary.workflow, intermediary.id);
  if (rel.matchKey) store.remember(rel.matchKey, survivor);
  const merge = store.addMerge({
    id: `M-${Date.now().toString(36).toUpperCase()}`, at: new Date().toISOString(),
    intermediaryId: intermediary.id, handle: rel.handle, retiredId, survivorId: survivor,
    processResultId: pr.processResultId, matchedOn: matchedOn(pr), reason, decidedBy, reversedAt: null,
  });
  return {
    merge,
    changes: {
      entityId: survivor,
      referenceId: (patched.individual?.externalReferences || []).find((r) => r.name === refName(intermediary.id))?.referenceId,
      executionId: run.workflowResult?.workflowExecutionId, workflowStatus: run.workflowResult?.status,
      reusedRecord: true, mergedFrom: retiredId, completedAt: new Date().toISOString(),
      ...outcome(run.workflowResult || {}),
    },
  };
}

// ── people (individual clients, and the people behind a business) ───
const fullName = (p) => [p.givenName, p.middleName, p.familyName].filter(Boolean).join(' ').toUpperCase();

/**
 * Recognise, record and verify one person for one intermediary. Used for an
 * individual client, and for each director, trustee, partner or owner of a
 * business client (opts.related). Returns { rel, repeat }.
 */
async function verifyPerson(intermediary, person, refValue, log, opts = {}) {
  const name = fullName(person);
  const docLabel = DOC_LABEL[person.document.type] || 'identity document';
  const who = opts.related ? `${opts.roleLabel} ${name}` : name;
  const key = matchKey(person.document);
  const known = store.lookup(key);
  log.step(known
    ? `${who}: identity index matches record ${short(known)} on the ${docLabel}, already held by ${holders(known)}.`
    : `${who}: identity index has no match for this ${docLabel}.`);

  const now = new Date().toISOString();
  const handle = opts.related ? `P-${b32(hmac(`handle:${intermediary.id}`, `${key}|${opts.businessHandle}`)).slice(0, 8)}` : null;

  // Already known to this intermediary: no new reference, no new verification.
  const mine = known && store.findByEntity(intermediary.id, known);
  const asClient = known && store.allRelationships().find((r) => r.intermediaryId === intermediary.id && r.entityId === known && r.kind !== 'related' && r.kind !== 'business' && !r.removedAt);
  if (!opts.related && asClient) {
    log.step(`Already ${poss(intermediary.name)} client, so the platform returns the existing relationship. No FrankieOne call.`);
    return { rel: asClient, repeat: true };
  }
  if (mine) {
    log.step(`${who}: already known to ${intermediary.name}, so the platform reuses that verification. No FrankieOne call.`);
    const rel = store.add({
      kind: opts.related ? 'related' : 'client', intermediaryId: intermediary.id, entityId: known,
      handle: opts.related ? handle : handleFor(intermediary.id, known),
      ...(opts.related ? { businessHandle: opts.businessHandle, role: opts.role, roleLabel: opts.roleLabel } : {}),
      matchKey: key, clientRef: refValue, name, dateOfBirth: person.dateOfBirth,
      document: mine.document, workflow: mine.workflow, executionId: mine.executionId, workflowStatus: mine.workflowStatus,
      status: mine.status, riskBand: mine.riskBand, actions: mine.actions, method: mine.method, reusedRecord: true,
      completedAt: mine.completedAt, createdAt: now,
    });
    return { rel };
  }

  const result = await schedule(intermediary.id, known || key, async () => {
    if (known) {
      // Another intermediary already holds this person.
      const patched = await frankie.addReference(known, reference(intermediary, refValue));
      const run = await frankie.verifyExisting(known, intermediary.workflow, intermediary.id);
      return { entityId: known, reused: true, run, refs: patched.individual?.externalReferences };
    }
    // New to the platform's index: create the record and run the platform's
    // duplicate check in one call. The intermediary's own verification follows.
    const run = await frankie.createAndVerify(toIndividual(person, intermediary, refValue), DUPLICATE_WORKFLOW, intermediary.id);
    return { entityId: run.individual?.entityId, reused: false, created: true, run, refs: run.individual?.externalReferences };
  });
  if (!result.entityId) throw new ClientError(502, 'UNAVAILABLE', 'Onboarding is temporarily unavailable.');
  log.step(result.created
    ? `FrankieOne: created record ${short(result.entityId)} for ${who} with ${poss(intermediary.name)} reference, and ran the platform's duplicate check (${DUPLICATE_WORKFLOW}).`
    : `FrankieOne: added ${poss(intermediary.name)} reference to record ${short(result.entityId)}. No new record, so checks already held can be reused.`, 'frankieone');

  const rel = store.add({
    kind: opts.related ? 'related' : 'client',
    intermediaryId: intermediary.id,
    entityId: result.entityId,
    referenceId: (result.refs || []).find((r) => r.name === refName(intermediary.id))?.referenceId,
    // Fixed for this relationship, even if the record is later merged.
    handle: opts.related ? handle : handleFor(intermediary.id, result.entityId),
    ...(opts.related ? { businessHandle: opts.businessHandle, role: opts.role, roleLabel: opts.roleLabel } : {}),
    matchKey: key,
    clientRef: refValue,
    name,
    dateOfBirth: person.dateOfBirth,
    document: { type: person.document.type, last4: String(person.document.number).slice(-4) },
    workflow: intermediary.workflow,
    reusedRecord: result.reused,
    method: 'Electronic',
    createdAt: now,
  });

  // When the index missed: FrankieOne's duplicate check may have found a possible match.
  const settled = result.created ? await checkDuplicates(result.entityId, result.run) : { clear: true, run: result.run };
  if (settled.setAside) log.step(`Duplicate check: set aside ${settled.setAside} matches against records that aren't the platform's (shared demo account).`);
  if (settled.merge) {
    const target = settled.merge.supplementaryData.duplicateEntityId;
    log.step(`Duplicate check: ${who} matches record ${short(target)} (held by ${holders(target)}) on ${matchedOn(settled.merge).join(', ').toLowerCase()}. The merge policy is met, so the platform merges without a person.`);
    const { changes } = await mergeInto(result.entityId, settled.merge, intermediary, rel,
      `Merged automatically: matched on ${matchedOn(settled.merge).join(', ').toLowerCase()} under the merge policy.`, 'Merge policy');
    store.update(rel, changes);
    log.step(`FrankieOne: kept record ${short(target)}, retired ${short(result.entityId)}, moved ${poss(intermediary.name)} reference and ran ${intermediary.workflow} → ${changes.workflowStatus}.`, 'frankieone');
  } else if (settled.hold) {
    const c = settled.hold[0];
    log.step(`Duplicate check: ${who} may be record ${short(c.supplementaryData.duplicateEntityId)} (held by ${holders(c.supplementaryData.duplicateEntityId)}), matched on ${matchedOn(c).join(', ').toLowerCase()}. No document match, so the merge policy isn't met: held for compliance.`);
    const review = store.addReview({
      id: `R-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`, kind: 'person', at: now, intermediaryId: intermediary.id, handle: rel.handle,
      newEntityId: result.entityId,
      candidates: settled.hold.map((p) => ({ entityId: p.supplementaryData.duplicateEntityId, processResultId: p.processResultId, matchedOn: matchedOn(p), rules: (p.supplementaryData.matchedRules || []).map((r) => r.name) })),
      decidedAt: null, decision: null,
    });
    store.update(rel, { reviewId: review.id, workflowStatus: 'REVIEW', completedAt: now, ...outcome({ status: 'REVIEW' }) });
  } else {
    if (result.created) log.step(`Duplicate check: no match for ${who} in the platform's network.`);
    if (!known) store.remember(key, result.entityId);
    const run = settled.run || await schedule(intermediary.id, result.entityId, () => frankie.verifyExisting(result.entityId, intermediary.workflow, intermediary.id));
    const wr = run.workflowResult || {};
    store.update(rel, { executionId: wr.workflowExecutionId, workflowStatus: wr.status, completedAt: now, ...outcome(wr) });
    log.step(`FrankieOne: ran ${poss(intermediary.name)} own workflow (${intermediary.workflow}) on record ${short(result.entityId)} → ${wr.status}.`, 'frankieone');
  }
  return { rel };
}

function validPerson(p) {
  return p?.givenName && p?.familyName && p?.dateOfBirth && p?.document?.number && p?.document?.type;
}

/** An intermediary submits an individual client: scenarios 1, 2 and 3, and the repeat case. */
export async function onboard(intermediary, body) {
  if (body?.business) return onboardBusiness(intermediary, body);
  const started = Date.now();
  const { clientRef, consent, person } = body || {};
  if (!consent) throw new ClientError(400, 'CONSENT_REQUIRED', 'A consent record from the applicant is required for every submission.');
  if (!clientRef || !validPerson(person)) {
    throw new ClientError(400, 'INCOMPLETE', 'clientRef, name, date of birth and an identity document are required.');
  }
  if (rateLimited(intermediary.id)) throw new ClientError(429, 'RATE_LIMITED', 'Too many submissions. Try again shortly.');

  const log = tracer(intermediary, clientRef, `${intermediary.name} submitted ${fullName(person)}`);
  log.step(`Received an individual client from ${poss(intermediary.name)} console: consent recorded, within its rate limit.`);
  const { rel } = await verifyPerson(intermediary, person, clientRef, log);
  store.submitted(intermediary.id, rel.status);
  log.step(`Built the reply from the permitted fields only, and held it to the ${POLICY.minResponseMs / 1000}-second minimum.`);
  log.done(`${intermediary.name} sees ${STATUS_LABEL[rel.status]}`);
  return heldTo(POLICY.minResponseMs, started, respond(rel, 'onboard'));
}

// ── businesses ──────────────────────────────────────────────────────
const BUSINESS_TYPES = { COMPANY: 'Company', TRUST: 'Trust', PARTNERSHIP: 'Partnership', OTHER: 'Other organisation' };
const normName = (s) => String(s || '').toUpperCase().replace(/\b(PTY|LTD|LIMITED|PROPRIETARY|THE|TRUSTEE|FOR|ATF)\b/g, '').replace(/[^A-Z0-9]/g, '');

/**
 * Recognising a business. With an ABN or ACN, the number identifies it, as
 * it does in FrankieOne. Without either there's nothing reliable to match
 * on, and FrankieOne has no duplicate check for organisations, so the
 * platform compares the normalised name and postcode and holds any match for
 * a person. It never merges a business on a name.
 */
function businessKeys(b) {
  const num = String(b.acn || b.abn || '').replace(/\s/g, '');
  const strong = num ? hmac('index', `ORG|${b.acn ? 'ACN' : 'ABN'}|${num}`).toString('hex') : null;
  const weak = hmac('index', `ORGNAME|${normName(b.legalName)}|${b.address?.postalCode || ''}`).toString('hex');
  return { strong, weak };
}

/** Work out a business client's status from its gates: every person, the registry check, the documents. */
function businessOutcome(biz) {
  const people = store.allRelationships().filter((r) => r.kind === 'related' && r.intermediaryId === biz.intermediaryId && r.businessHandle === biz.handle && !r.removedAt);
  const order = ['VERIFIED', 'ACTION_REQUIRED', 'IN_REVIEW', 'DECLINED'];
  let status = 'VERIFIED';
  const worse = (s) => { if (order.indexOf(s) > order.indexOf(status)) status = s; };
  const actions = [];
  for (const p of people) {
    if (p.status === 'DECLINED') worse('DECLINED');
    else if (p.status === 'IN_REVIEW') worse('IN_REVIEW');
    else if (p.status === 'ACTION_REQUIRED') {
      worse('ACTION_REQUIRED');
      actions.push({ code: 'PERSON_DOCUMENTS', message: `${p.roleLabel} ${p.name} couldn't be verified from the details supplied. Collect a certified identity document from them.`, owner: 'INTERMEDIARY' });
    }
  }
  if (biz.reviewId) worse('IN_REVIEW');
  if (biz.registry === 'IN_PROGRESS') {
    worse('IN_REVIEW');
    actions.push({ code: 'REGISTRY_CHECK', message: 'The business register check is in progress.', owner: 'PLATFORM' });
  }
  if (biz.registry === 'FAILED') {
    worse('ACTION_REQUIRED');
    actions.push({ code: 'CHECK_REGISTRATION', message: "The business couldn't be confirmed from the ABN or ACN supplied. Check the number, or provide a document that establishes the business.", owner: 'INTERMEDIARY' });
  }
  if (biz.registry === 'NONE' && !biz.establishingDocument) {
    worse('ACTION_REQUIRED');
    actions.push({ code: 'PROVIDE_ESTABLISHING_DOCUMENT', message: "This business has no ABN or ACN, so there's no register to check it against. Provide the document that establishes it, such as a trust deed or partnership agreement.", owner: 'INTERMEDIARY' });
  }
  if (status === 'IN_REVIEW' && !actions.some((a) => a.owner === 'PLATFORM')) {
    actions.push({ code: 'UNDER_REVIEW', message: 'This application is being reviewed. You will see the outcome here.', owner: 'PLATFORM' });
  }
  const riskBand = people.some((p) => p.riskBand === 'High') ? 'High' : people.some((p) => p.riskBand === 'Medium') ? 'Medium' : 'Low';
  return { status, actions, riskBand, people: people.map((p) => ({ name: p.name, role: p.roleLabel, status: p.status })) };
}

async function pollRegistry(biz, attempts = 4) {
  for (let i = 0; i < attempts && biz.registry === 'IN_PROGRESS'; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const w = (await frankie.getRegistryCheck(biz.entityId, BUSINESS_WORKFLOW, biz.registryExecutionId)).workflowResult || {};
      const state = w.workflowExecutionState;
      if (state === 'ERROR' || w.status === 'FAIL') biz.registry = 'FAILED';
      else if (state === 'COMPLETED' && ['PASS', 'CLEAR', 'COMPLETE'].includes(w.status)) biz.registry = 'PASSED';
      else if (state === 'COMPLETED') biz.registry = 'FAILED';
    } catch { /* still running */ }
  }
}

/** An intermediary submits a business client, with the people behind it. */
export async function onboardBusiness(intermediary, body) {
  const started = Date.now();
  const { clientRef, consent, business, people = [] } = body || {};
  if (!consent) throw new ClientError(400, 'CONSENT_REQUIRED', 'A consent record is required for every submission.');
  if (!clientRef || !business?.legalName || !BUSINESS_TYPES[business.type] || !people.length || !people.every((x) => ROLES[x.role] && validPerson(x.person))) {
    throw new ClientError(400, 'INCOMPLETE', 'clientRef, the business name and type, and at least one person (with role, name, date of birth and an identity document) are required.');
  }
  if (rateLimited(intermediary.id)) throw new ClientError(429, 'RATE_LIMITED', 'Too many submissions. Try again shortly.');

  const typeLabel = BUSINESS_TYPES[business.type];
  const number = business.acn ? `ACN ${business.acn}` : business.abn ? `ABN ${business.abn}` : null;
  const log = tracer(intermediary, clientRef, `${intermediary.name} submitted ${business.legalName.toUpperCase()} (${typeLabel.toLowerCase()})`);
  log.step(`Received a business client from ${poss(intermediary.name)} console with ${people.length} ${people.length === 1 ? 'person' : 'people'}: consent recorded, within its rate limit.`);

  const keys = businessKeys(business);
  const knownStrong = keys.strong && store.lookup(keys.strong);
  const knownWeak = !keys.strong && store.lookup(keys.weak);
  const mine = knownStrong && store.findByEntity(intermediary.id, knownStrong);
  if (mine) {
    log.step(`Business index: ${number} is already ${poss(intermediary.name)} client. No FrankieOne call.`);
    log.done(`${intermediary.name} sees ${STATUS_LABEL[mine.status]}`);
    return heldTo(POLICY.minBusinessResponseMs, started, respond(mine, 'onboard'));
  }
  log.step(knownStrong ? `Business index: ${number} matches business record ${short(knownStrong)}, held by ${holders(knownStrong)}.`
    : number ? `Business index: no match for ${number}.`
    : knownWeak ? `Business index: no ABN or ACN. A business with the same name and postcode is already on the platform (record ${short(knownWeak)}), so a person decides whether it's the same one.`
    : `Business index: no ABN or ACN, and no business with the same name and postcode.`);

  const ref = reference(intermediary, clientRef);
  let entityId;
  if (knownStrong) {
    await frankie.addOrganizationReference(knownStrong, ref);
    entityId = knownStrong;
    log.step(`FrankieOne: added ${poss(intermediary.name)} reference to business record ${short(entityId)}.`, 'frankieone');
  } else {
    const a = business.address || {};
    const created = await frankie.createOrganization({
      addresses: [{ type: 'REGISTERED_OFFICE', ...a, country: a.country || 'AUS' }],
      details: {
        name: { name: business.legalName.toUpperCase() },
        organizationType: business.type,
        region: { country: 'AUS' },
        ...(business.tradingName ? { tradingNames: [{ name: business.tradingName }] } : {}),
        ...(business.acn || business.abn ? { registrationDetails: [
          ...(business.acn ? [{ number: String(business.acn).replace(/\s/g, ''), type: 'ACN', country: 'AUS' }] : []),
          ...(business.abn ? [{ number: String(business.abn).replace(/\s/g, ''), type: 'ABN', country: 'AUS' }] : []),
        ] } : {}),
      },
      externalReferences: [ref],
    });
    entityId = created.organization?.entityId;
    if (!entityId) throw new ClientError(502, 'UNAVAILABLE', 'Onboarding is temporarily unavailable.');
    log.step(`FrankieOne: created business record ${short(entityId)} (${typeLabel.toLowerCase()}${number ? `, ${number}` : ', no registration number'}) with ${poss(intermediary.name)} reference.`, 'frankieone');
    if (keys.strong) store.remember(keys.strong, entityId);
    else if (!knownWeak) store.remember(keys.weak, entityId);
  }

  const now = new Date().toISOString();
  const biz = store.add({
    kind: 'business', intermediaryId: intermediary.id, entityId, entityType: 'ORGANIZATION',
    referenceId: null, handle: handleFor(intermediary.id, entityId), clientRef,
    name: business.legalName.toUpperCase(), businessType: typeLabel, registration: number,
    reusedRecord: !!knownStrong, method: 'Electronic', createdAt: now,
    registry: number ? 'IN_PROGRESS' : 'NONE',
  });

  if (knownWeak) {
    const review = store.addReview({
      id: `R-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`, kind: 'business', at: now, intermediaryId: intermediary.id, handle: biz.handle,
      newEntityId: entityId, candidates: [{ entityId: knownWeak, matchedOn: ['NAME', 'POSTCODE'], rules: ['Platform: normalised name and postcode (no ABN or ACN)'] }],
      decidedAt: null, decision: null,
    });
    biz.reviewId = review.id;
  }

  // The registry check, where there's a number to check.
  if (number) {
    try {
      const run = await frankie.checkRegistry(entityId, BUSINESS_WORKFLOW, intermediary.id);
      biz.registryExecutionId = run.workflowExecutionId;
      log.step(`FrankieOne: started the business register check (${BUSINESS_WORKFLOW}) on the ${number}. It runs asynchronously.`, 'frankieone');
    } catch {
      biz.registry = 'FAILED';
    }
  } else {
    log.step('No ABN or ACN, so there is no register to check against. The intermediary is asked for the document that establishes the business.');
  }

  // Each person goes through the same recognition as any individual, then is linked to the business.
  // Each person gets their own reference value: one shared value would make
  // FrankieOne's external-reference duplicate rule match them to each other.
  await Promise.all(people.map(async ({ role, person }, i) => {
    const { rel } = await verifyPerson(intermediary, person, `${clientRef}-P${i + 1}`, log, { related: true, businessHandle: biz.handle, role, roleLabel: ROLES[role].description });
    try {
      await frankie.linkPerson(entityId, rel.entityId, ROLES[role]);
      log.step(`FrankieOne: linked ${ROLES[role].description.toLowerCase()} ${rel.name} to business record ${short(entityId)}.`, 'frankieone');
    } catch (err) {
      log.step(`FrankieOne: could not link ${rel.name} as ${ROLES[role].description.toLowerCase()} (${err.status || 'error'}).`, 'frankieone');
    }
  }));

  if (biz.registryExecutionId) {
    await pollRegistry(biz);
    log.step(biz.registry === 'IN_PROGRESS' ? 'Business register check still running; the intermediary sees it in progress.'
      : `Business register check: ${biz.registry === 'PASSED' ? 'confirmed' : 'could not confirm the business from that number'}.`, 'frankieone');
  }
  store.update(biz, { completedAt: new Date().toISOString(), ...businessOutcome(biz) });
  store.submitted(intermediary.id, biz.status);
  log.step(`Built the reply from the permitted fields only (each person as name, role and status), held to the ${POLICY.minBusinessResponseMs / 1000}-second minimum for businesses.`);
  log.done(`${intermediary.name} sees ${STATUS_LABEL[biz.status]}`);
  return heldTo(POLICY.minBusinessResponseMs, started, respond(biz, 'onboard'));
}

/** The intermediary has provided the document that establishes a business with no ABN or ACN. */
export async function provideDocument(intermediary, handle, body) {
  const biz = store.find(intermediary.id, handle);
  if (!biz || biz.kind !== 'business') throw new ClientError(404, 'NOT_FOUND', 'No such business client.');
  biz.establishingDocument = { type: body?.type || 'Establishing document', at: new Date().toISOString() };
  store.update(biz, businessOutcome(biz));
  const log = tracer(intermediary, biz.clientRef, `${intermediary.name} provided a document for ${biz.name}`);
  log.step(`Recorded "${biz.establishingDocument.type}" against business record ${short(biz.entityId)}. In production the file is attached to the record (POST /v2/organizations/{id}/documents) for compliance to review.`);
  log.done(`${intermediary.name} sees ${STATUS_LABEL[biz.status]}`);
  return respond(biz, 'document');
}

// ── compliance decisions (the platform's own staff, never intermediaries) ──
const relFor = (intermediaryId, handle) => store.allRelationships().find((r) => r.intermediaryId === intermediaryId && r.handle === handle);
function rollUp(rel) {
  if (rel?.kind !== 'related') return;
  const biz = relFor(rel.intermediaryId, rel.businessHandle);
  if (biz) store.update(biz, businessOutcome(biz));
}

/** A possible same business (no ABN or ACN, same name and postcode): same business, or different. */
async function decideBusiness(review, decision) {
  const intermediary = byId[review.intermediaryId];
  const biz = relFor(review.intermediaryId, review.handle);
  const existing = review.candidates[0].entityId;
  const log = tracer(intermediary, biz.clientRef, `Compliance decided: ${decision === 'merge' ? 'same business' : 'different businesses'}`);
  if (decision === 'merge') {
    // No duplicate API for organisations: the platform moves the relationship itself.
    await frankie.addOrganizationReference(existing, reference(intermediary, biz.clientRef));
    const refs = (await frankie.getOrganization(review.newEntityId).catch(() => ({}))).organization?.externalReferences || [];
    const r = refs.find((x) => x.name === refName(intermediary.id));
    if (r) await frankie.removeOrganizationReference(review.newEntityId, r.referenceId).catch(() => {});
    const people = store.allRelationships().filter((x) => x.kind === 'related' && x.businessHandle === biz.handle && !x.removedAt);
    for (const p of people) await frankie.linkPerson(existing, p.entityId, ROLES[p.role]).catch(() => {});
    store.update(biz, { entityId: existing, mergedFrom: review.newEntityId, reusedRecord: true });
    log.step(`FrankieOne: moved ${poss(intermediary.name)} reference to business record ${short(existing)} and linked its people there. Record ${short(review.newEntityId)} is no longer used.`, 'frankieone');
  } else {
    store.remember(businessKeys({ legalName: biz.name, address: {} }).weak, review.newEntityId);
    log.step('Both businesses stay as separate records.');
  }
  biz.reviewId = null;
  store.update(biz, businessOutcome(biz));
  Object.assign(review, { decidedAt: new Date().toISOString(), decision });
  store.touch();
  log.done(`${intermediary.name} sees ${STATUS_LABEL[biz.status]}`);
  return review;
}

/** A compliance officer decides a held possible duplicate: same person (merge) or different people. */
export async function decide(reviewId, decision, candidateEntityId) {
  const review = store.review(reviewId);
  if (!review || review.decidedAt) throw new ClientError(404, 'NOT_FOUND', 'No open review with that id.');
  if (review.kind === 'business') return decideBusiness(review, decision);
  const intermediary = byId[review.intermediaryId];
  const rel = relFor(review.intermediaryId, review.handle);
  if (decision === 'merge') {
    const chosen = review.candidates.find((c) => c.entityId === candidateEntityId) || review.candidates[0];
    const others = review.candidates.filter((c) => c !== chosen).map((c) => c.processResultId);
    if (others.length) await frankie.resolveDuplicates(review.newEntityId, others, 'FALSE_POSITIVE', 'Compliance: a different person.');
    const { changes, merge } = await mergeInto(review.newEntityId, { processResultId: chosen.processResultId, supplementaryData: { duplicateEntityId: chosen.entityId, matchedFields: chosen.matchedOn.map((t) => ({ objectType: t })) } },
      intermediary, rel, 'Compliance: confirmed the same person after comparing the records.', 'Compliance');
    store.update(rel, { ...changes, reviewId: null });
    Object.assign(review, { decidedAt: new Date().toISOString(), decision: 'merge', mergeId: merge.id });
    const log = tracer(intermediary, rel.clientRef, `Compliance decided: same person`);
    log.step(`FrankieOne: confirmed the duplicate (TRUE_POSITIVE_REJECT): kept record ${short(chosen.entityId)}, retired ${short(review.newEntityId)}.`, 'frankieone');
    log.step(`FrankieOne: moved ${poss(intermediary.name)} reference to ${short(chosen.entityId)} and ran ${intermediary.workflow} → ${changes.workflowStatus}.`, 'frankieone');
    log.done(`${intermediary.name} sees ${STATUS_LABEL[rel.status]}, with the same handle`);
  } else {
    await frankie.resolveDuplicates(review.newEntityId, review.candidates.map((c) => c.processResultId), 'FALSE_POSITIVE', 'Compliance: different people.');
    const wr = (await frankie.verifyExisting(review.newEntityId, intermediary.workflow, intermediary.id)).workflowResult || {};
    if (rel.matchKey) store.remember(rel.matchKey, review.newEntityId);
    store.update(rel, { reviewId: null, executionId: wr.workflowExecutionId, workflowStatus: wr.status, completedAt: new Date().toISOString(), ...outcome(wr) });
    Object.assign(review, { decidedAt: new Date().toISOString(), decision: 'different' });
    const log = tracer(intermediary, rel.clientRef, `Compliance decided: different people`);
    log.step(`FrankieOne: dismissed the match (FALSE_POSITIVE). Both records stay.`, 'frankieone');
    log.step(`FrankieOne: ran ${intermediary.workflow} on record ${short(review.newEntityId)} → ${wr.status}.`, 'frankieone');
    log.done(`${intermediary.name} sees ${STATUS_LABEL[rel.status]}`);
  }
  store.touch();
  rollUp(rel);
  return review;
}

/** A merge proves wrong: restore the retired record and re-run that intermediary's verification on it. */
export async function reverseMerge(mergeId) {
  const merge = store.merge(mergeId);
  if (!merge || merge.reversedAt) throw new ClientError(404, 'NOT_FOUND', 'No active merge with that id.');
  const intermediary = byId[merge.intermediaryId];
  const rel = relFor(merge.intermediaryId, merge.handle);
  await frankie.resolveDuplicates(merge.retiredId, [merge.processResultId], 'FALSE_POSITIVE', 'Merge reversed: different people.');
  if (rel.referenceId) await frankie.removeReference(merge.survivorId, rel.referenceId).catch(() => {});
  const patched = await frankie.addReference(merge.retiredId, reference(intermediary, rel.clientRef));
  const wr = (await frankie.verifyExisting(merge.retiredId, intermediary.workflow, intermediary.id)).workflowResult || {};
  if (rel.matchKey) store.remember(rel.matchKey, merge.retiredId);
  store.update(rel, {
    entityId: merge.retiredId, mergedFrom: null, reusedRecord: false,
    referenceId: (patched.individual?.externalReferences || []).find((r) => r.name === refName(intermediary.id))?.referenceId,
    executionId: wr.workflowExecutionId, workflowStatus: wr.status, completedAt: new Date().toISOString(), ...outcome(wr),
  });
  merge.reversedAt = new Date().toISOString();
  store.touch();
  const log = tracer(intermediary, rel.clientRef, `Compliance reversed a merge`);
  log.step(`FrankieOne: reversed the duplicate decision, restoring record ${short(merge.retiredId)}.`, 'frankieone');
  log.step(`FrankieOne: moved ${poss(intermediary.name)} reference back and ran ${intermediary.workflow} on ${short(merge.retiredId)} → ${wr.status}.`, 'frankieone');
  log.done(`${intermediary.name} sees ${STATUS_LABEL[rel.status]}, with the same handle`);
  rollUp(rel);
  return merge;
}

/** Presenter tool: drop a record's index entries, as if an existing client had never been indexed. */
export function forgetIndex(entityId) {
  store.forget(entityId);
  return { forgotten: entityId };
}

/** Re-read one intermediary's own verification, e.g. after compliance resolves it in the Portal. */
export async function refresh(intermediary, handle) {
  const rel = store.find(intermediary.id, handle);
  if (!rel || rel.kind === 'related') throw new ClientError(404, 'NOT_FOUND', 'No such client.');
  if (rel.kind === 'business') {
    const people = store.allRelationships().filter((r) => r.kind === 'related' && r.intermediaryId === intermediary.id && r.businessHandle === handle && !r.removedAt);
    await Promise.all(people.map(refreshPerson));
    if (rel.registry === 'IN_PROGRESS') await pollRegistry(rel, 2);
    store.update(rel, businessOutcome(rel));
    return respond(rel, 'read');
  }
  await refreshPerson(rel);
  return respond(rel, 'read');
}

async function refreshPerson(rel) {
  if (!rel.executionId) return;
  try {
    const data = await frankie.getIndividual(rel.entityId);
    const summaries = (data.serviceProfiles || []).flatMap((s) => s.workflowSummaries || []);
    const mine = summaries.find((w) => w.workflowExecutionId === rel.executionId)
      || summaries.find((w) => w.workflowName === rel.workflow && w.lifecyclePhase !== 'MONITORING');
    if (mine && mine.status && mine.status !== rel.workflowStatus) {
      store.update(rel, { workflowStatus: mine.status, ...outcome({ ...mine, workflowStepResults: [] }) });
    }
  } catch { /* keep the last known state */ }
}

/** A client leaves this intermediary. Only its reference goes; the record and other relationships stay. */
export async function offboard(intermediary, handle) {
  const rel = store.find(intermediary.id, handle);
  if (!rel || rel.kind === 'related') throw new ClientError(404, 'NOT_FOUND', 'No such client.');
  if (rel.kind === 'business') {
    const refs = (await frankie.getOrganization(rel.entityId).catch(() => ({}))).organization?.externalReferences || [];
    const mineRef = refs.find((r) => r.name === refName(intermediary.id) && r.value === rel.clientRef);
    if (mineRef) await frankie.removeOrganizationReference(rel.entityId, mineRef.referenceId);
    const people = store.allRelationships().filter((r) => r.kind === 'related' && r.intermediaryId === intermediary.id && r.businessHandle === handle && !r.removedAt);
    for (const p of people) {
      const stillHeld = store.allRelationships().some((r) => r !== p && r.intermediaryId === intermediary.id && r.entityId === p.entityId && !r.removedAt && r.businessHandle !== handle);
      if (p.referenceId && !stillHeld) await frankie.removeReference(p.entityId, p.referenceId).catch(() => {});
      store.update(p, { removedAt: new Date().toISOString() });
    }
    store.update(rel, { removedAt: new Date().toISOString() });
    const log = tracer(intermediary, rel.clientRef, `${intermediary.name}: business client has left`);
    log.step(`FrankieOne: removed ${poss(intermediary.name)} reference from business record ${short(rel.entityId)}, and from its people where ${intermediary.name} holds them for nothing else. The records and their checks stay.`, 'frankieone');
    log.done(`Still held by ${holders(rel.entityId)}`);
    return { handle, removed: true };
  }
  if (rel.referenceId) await frankie.removeReference(rel.entityId, rel.referenceId);
  store.update(rel, { removedAt: new Date().toISOString() });
  const log = tracer(intermediary, rel.clientRef, `${intermediary.name}: client has left`);
  log.step(`FrankieOne: removed ${poss(intermediary.name)} reference from record ${short(rel.entityId)}. The record, its checks and other intermediaries' relationships stay.`, 'frankieone');
  log.done(`Still held by ${holders(rel.entityId)}`);
  return { handle, removed: true };
}

export function list(intermediary) {
  return store.relationshipsFor(intermediary.id).filter((r) => r.kind !== 'related').map((r) => respond(r, 'list'));
}

// ── the platform's own view (compliance and operations, never intermediaries) ──
export function network() {
  const rels = store.allRelationships();
  const investors = {};
  for (const r of rels) {
    const inv = (investors[r.entityId] ||= { entityId: r.entityId, name: r.name, dateOfBirth: r.dateOfBirth, entityType: r.kind === 'business' ? 'ORGANIZATION' : 'INDIVIDUAL', businessType: r.businessType, registration: r.registration, relationships: [] });
    const parent = r.kind === 'related' ? rels.find((b) => b.intermediaryId === r.intermediaryId && b.handle === r.businessHandle) : null;
    inv.relationships.push({
      kind: r.kind || 'client', role: r.roleLabel || null, business: parent?.name || null,
      intermediary: byId[r.intermediaryId]?.name, intermediaryId: r.intermediaryId,
      clientRef: r.clientRef, handle: r.handle, workflow: r.workflow, workflowStatus: r.workflowStatus,
      status: r.status, reusedRecord: r.reusedRecord, createdAt: r.createdAt, removedAt: r.removedAt || null,
      mergedFrom: r.mergedFrom || null, reviewId: r.reviewId || null, document: r.document,
    });
  }
  const active = new Set(rels.filter((r) => !r.removedAt).map((r) => r.intermediaryId));
  const subs = store.submissions();
  const perIntermediary = {};
  for (const s of subs) {
    const p = (perIntermediary[s.intermediaryId] ||= { submissions: 0, verified: 0 });
    p.submissions += 1;
    if (s.outcome === 'VERIFIED') p.verified += 1;
  }
  return {
    intermediariesConfigured: INTERMEDIARIES.length,
    intermediariesActive: active.size,
    investors: Object.values(investors).sort((a, b) => b.relationships.length - a.relationships.length),
    relationships: rels.filter((r) => !r.removedAt).length,
    reusedOnboardings: rels.filter((r) => r.reusedRecord).length,
    indexKeys: store.stats().indexKeys,
    submissions: Object.entries(perIntermediary).map(([id, v]) => ({ intermediary: byId[id]?.name, ...v })),
    disclosures: store.disclosures().slice(-40).reverse().map((d) => ({ ...d, intermediary: byId[d.intermediaryId]?.name })),
    policy: POLICY,
    permittedFields: PERMITTED_FIELDS,
    reviews: store.reviews().filter((r) => !r.decidedAt).map((r) => {
      const rel = store.allRelationships().find((x) => x.intermediaryId === r.intermediaryId && x.handle === r.handle);
      return {
        ...r,
        intermediary: byId[r.intermediaryId]?.name,
        submitted: rel && { name: rel.name, dateOfBirth: rel.dateOfBirth, document: rel.document, clientRef: rel.clientRef },
        candidates: r.candidates.map((c) => {
          const held = store.allRelationships().filter((x) => x.entityId === c.entityId && !x.removedAt);
          return { ...c, name: held[0]?.name, dateOfBirth: held[0]?.dateOfBirth, document: held[0]?.document,
            heldBy: held.map((x) => byId[x.intermediaryId]?.name) };
        }),
      };
    }),
    merges: store.merges().slice().reverse().map((m) => ({ ...m, intermediary: byId[m.intermediaryId]?.name })),
    activity: store.activity().slice(-15).reverse(),
  };
}
