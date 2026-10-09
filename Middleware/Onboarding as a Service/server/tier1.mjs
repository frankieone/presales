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
import { DUPLICATE_WORKFLOW, INTERMEDIARIES, PERMITTED_FIELDS, POLICY, SECRET, byId, refName } from './config.mjs';
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
  for (const field of PERMITTED_FIELDS) if (rel[field] !== undefined) out[field] = rel[field];
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
  if (!candidates.length) return { clear: true };
  return meetsMergePolicy(candidates) ? { merge: candidates[0] } : { hold: candidates };
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

/** An intermediary submits a client: scenarios 1, 2 and 3, and the repeat case. */
export async function onboard(intermediary, body) {
  const started = Date.now();
  const { clientRef, consent, person } = body || {};
  if (!consent) throw new ClientError(400, 'CONSENT_REQUIRED', 'A consent record from the applicant is required for every submission.');
  if (!clientRef || !person?.givenName || !person?.familyName || !person?.dateOfBirth || !person?.document?.number) {
    throw new ClientError(400, 'INCOMPLETE', 'clientRef, name, date of birth and an identity document are required.');
  }
  if (rateLimited(intermediary.id)) throw new ClientError(429, 'RATE_LIMITED', 'Too many submissions. Try again shortly.');

  const key = matchKey(person.document);
  const known = store.lookup(key);

  // The same person submitted again by the same intermediary: no new reference, no new verification.
  const existingRel = known && store.findByEntity(intermediary.id, known);
  if (existingRel) {
    store.submitted(intermediary.id, 'repeat');
    return heldTo(POLICY.minResponseMs, started, respond(existingRel, 'onboard'));
  }

  const result = await schedule(intermediary.id, known || key, async () => {
    if (known) {
      // Scenario 2: another intermediary already holds this investor.
      const patched = await frankie.addReference(known, reference(intermediary, clientRef));
      const run = await frankie.verifyExisting(known, intermediary.workflow, intermediary.id);
      return { entityId: known, reused: true, run, refs: patched.individual?.externalReferences };
    }
    // New to the platform's index: create the record and run the platform's
    // duplicate check in one call. The intermediary's own verification follows.
    const run = await frankie.createAndVerify(toIndividual(person, intermediary, clientRef), DUPLICATE_WORKFLOW, intermediary.id);
    return { entityId: run.individual?.entityId, reused: false, created: true, run, refs: run.individual?.externalReferences };
  });

  if (!result.entityId) throw new ClientError(502, 'UNAVAILABLE', 'Onboarding is temporarily unavailable.');

  const now = new Date().toISOString();
  const rel = store.add({
    intermediaryId: intermediary.id,
    entityId: result.entityId,
    referenceId: (result.refs || []).find((r) => r.name === refName(intermediary.id))?.referenceId,
    handle: handleFor(intermediary.id, result.entityId), // fixed for this relationship, even if the record is later merged
    matchKey: key,
    clientRef,
    name: [person.givenName, person.middleName, person.familyName].filter(Boolean).join(' ').toUpperCase(),
    dateOfBirth: person.dateOfBirth,
    document: { type: person.document.type, last4: String(person.document.number).slice(-4) },
    workflow: intermediary.workflow,
    reusedRecord: result.reused,
    method: 'Electronic',
    createdAt: now,
  });

  // Scenario 3: the index missed, and FrankieOne's duplicate check found a possible match.
  const settled = result.created ? await checkDuplicates(result.entityId, result.run) : { clear: true, run: result.run };
  if (settled.merge) {
    const { changes } = await mergeInto(result.entityId, settled.merge, intermediary, rel,
      `Merged automatically: matched on ${matchedOn(settled.merge).join(', ').toLowerCase()} under the merge policy.`, 'Merge policy');
    store.update(rel, changes);
  } else if (settled.hold) {
    const review = store.addReview({
      id: `R-${Date.now().toString(36).toUpperCase()}`, at: now, intermediaryId: intermediary.id, handle: rel.handle,
      newEntityId: result.entityId,
      candidates: settled.hold.map((p) => ({ entityId: p.supplementaryData.duplicateEntityId, processResultId: p.processResultId, matchedOn: matchedOn(p), rules: (p.supplementaryData.matchedRules || []).map((r) => r.name) })),
      decidedAt: null, decision: null,
    });
    store.update(rel, { reviewId: review.id, workflowStatus: 'REVIEW', completedAt: now, ...outcome({ status: 'REVIEW' }) });
  } else {
    // Scenario 1 (new to the network) or 2 (already held): this intermediary's own verification.
    if (!known) store.remember(key, result.entityId);
    const run = settled.run || await schedule(intermediary.id, result.entityId, () => frankie.verifyExisting(result.entityId, intermediary.workflow, intermediary.id));
    const wr = run.workflowResult || {};
    store.update(rel, { executionId: wr.workflowExecutionId, workflowStatus: wr.status, completedAt: now, ...outcome(wr) });
  }
  store.submitted(intermediary.id, rel.status);
  return heldTo(POLICY.minResponseMs, started, respond(rel, 'onboard'));
}

// ── compliance decisions (the platform's own staff, never intermediaries) ──
const relFor = (intermediaryId, handle) => store.allRelationships().find((r) => r.intermediaryId === intermediaryId && r.handle === handle);

/** A compliance officer decides a held possible duplicate: same person (merge) or different people. */
export async function decide(reviewId, decision, candidateEntityId) {
  const review = store.review(reviewId);
  if (!review || review.decidedAt) throw new ClientError(404, 'NOT_FOUND', 'No open review with that id.');
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
  } else {
    await frankie.resolveDuplicates(review.newEntityId, review.candidates.map((c) => c.processResultId), 'FALSE_POSITIVE', 'Compliance: different people.');
    const wr = (await frankie.verifyExisting(review.newEntityId, intermediary.workflow, intermediary.id)).workflowResult || {};
    if (rel.matchKey) store.remember(rel.matchKey, review.newEntityId);
    store.update(rel, { reviewId: null, executionId: wr.workflowExecutionId, workflowStatus: wr.status, completedAt: new Date().toISOString(), ...outcome(wr) });
    Object.assign(review, { decidedAt: new Date().toISOString(), decision: 'different' });
  }
  store.touch();
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
  if (!rel) throw new ClientError(404, 'NOT_FOUND', 'No such client.');
  try {
    const data = await frankie.getIndividual(rel.entityId);
    const summaries = (data.serviceProfiles || []).flatMap((s) => s.workflowSummaries || []);
    const mine = summaries.find((w) => w.workflowExecutionId === rel.executionId)
      || summaries.find((w) => w.workflowName === rel.workflow && w.lifecyclePhase !== 'MONITORING');
    if (mine && mine.status && mine.status !== rel.workflowStatus) {
      store.update(rel, { workflowStatus: mine.status, ...outcome({ ...mine, workflowStepResults: [] }) });
    }
  } catch { /* keep the last known state */ }
  return respond(rel, 'read');
}

/** A client leaves this intermediary. Only its reference goes; the record and other relationships stay. */
export async function offboard(intermediary, handle) {
  const rel = store.find(intermediary.id, handle);
  if (!rel) throw new ClientError(404, 'NOT_FOUND', 'No such client.');
  if (rel.referenceId) await frankie.removeReference(rel.entityId, rel.referenceId);
  store.update(rel, { removedAt: new Date().toISOString() });
  return { handle, removed: true };
}

export function list(intermediary) {
  return store.relationshipsFor(intermediary.id).map((r) => respond(r, 'list'));
}

// ── the platform's own view (compliance and operations, never intermediaries) ──
export function network() {
  const rels = store.allRelationships();
  const investors = {};
  for (const r of rels) {
    const inv = (investors[r.entityId] ||= { entityId: r.entityId, name: r.name, dateOfBirth: r.dateOfBirth, relationships: [] });
    inv.relationships.push({
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
  };
}
