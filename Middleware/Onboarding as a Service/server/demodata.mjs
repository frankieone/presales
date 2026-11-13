/**
 * Demo data: fills the network with generated people and the things that
 * happen to them, so the platform view shows a busy network. Nothing here
 * reaches FrankieOne: every record lives in the stand-in (standin.mjs), and
 * the platform's own logic (recognition, reuse, decisions, the client file)
 * runs on it unchanged.
 *
 * Six of the generated intermediaries run different checks, so the same
 * person can be identity-checked at one, screened at another, and asked for
 * a photo ID and selfie at a third.
 */
import { DUPLICATE_WORKFLOW, INTERMEDIARIES, PLATFORM_STAFF, POLICY, REQUIRED_CHECKS, byId, refName, requiredChecks } from './config.mjs';
import { store } from './store.mjs';
import * as standin from './standin.mjs';
import { handleFor, matchKey, outcome } from './tier1.mjs';

// ── who takes part, and what each checks ────────────────────────────
const PROFILES = {
  'AUS-KYC-Only': ['MATCHLIST', 'KYC'],
  'AUS-AML-Screening': ['MATCHLIST', 'AML'],
  'AUS-IDV-Biometrics': ['MATCHLIST', 'IDV', 'BIOMETRICS'],
  'AUS-Full-IDV': ['MATCHLIST', 'KYC', 'AML', 'IDV', 'BIOMETRICS'],
};
Object.assign(REQUIRED_CHECKS, PROFILES);
const GENERIC = { 'im-001': 'AUS-KYC-Only', 'im-002': 'AUS-AML-Screening', 'im-003': 'AUS-IDV-Biometrics', 'im-004': 'AUS-Full-IDV', 'im-005': 'AUS-Basic2V-TwoPlus', 'im-006': 'AUS-KYC-Only' };
for (const [id, wf] of Object.entries(GENERIC)) byId[id].workflow = wf;
const PARTICIPANTS = ['northgate', 'bluewave', 'kestrel', ...Object.keys(GENERIC)].map((id) => byId[id]);
const WEIGHT = { northgate: 4, bluewave: 4, kestrel: 3 };

// ── fictional people ────────────────────────────────────────────────
const GIVEN = ['Olivia', 'Liam', 'Charlotte', 'Noah', 'Amelia', 'Jack', 'Isla', 'William', 'Mia', 'Oliver', 'Ava', 'Henry', 'Grace', 'Leo', 'Chloe', 'Lucas', 'Zoe', 'Thomas', 'Ruby', 'James', 'Sienna', 'Ethan', 'Harper', 'Samuel', 'Matilda', 'Arjun', 'Mei', 'Hamish', 'Priya', 'Mateo', 'Aisha', 'Kenji', 'Freya', 'Tariq', 'Elena', 'Callum', 'Nadia', 'Hugo', 'Leila', 'Declan'];
const FAMILY = ['Whitfield', 'Okafor', 'Nguyen', 'Castellano', 'Brennan', 'Haddad', 'Lindqvist', 'Moreau', 'Patel', 'Fitzgerald', 'Takahashi', 'Ramirez', 'Kowalski', 'Ashworth', 'Delacroix', 'Mahoney', 'Iyer', 'Sorensen', 'Abernethy', 'Kaur', 'Vasquez', 'Holloway', 'Chen', 'Marsden', 'Petrov', 'Galloway', 'Osei', 'Fairbairn', 'Russo', 'Lachlan', 'Doherty', 'Yamamoto', 'Beaumont', 'Achebe', 'Quinlan', 'Sato', 'Pemberton', 'Novak', 'Ellery', 'Tran'];
const STREETS = [['Acacia', 'AVENUE'], ['Banksia', 'STREET'], ['Coral', 'ROAD'], ['Dunmore', 'STREET'], ['Elderberry', 'COURT'], ['Fernleigh', 'DRIVE'], ['Glenview', 'ROAD'], ['Harbour', 'STREET'], ['Ironbark', 'CRESCENT'], ['Jacaranda', 'WAY'], ['Kurrajong', 'AVENUE'], ['Lilly Pilly', 'LANE']];
const PLACES = [['RICHMOND', 'VIC', '3121'], ['BALMAIN', 'NSW', '2041'], ['NEW FARM', 'QLD', '4005'], ['NORWOOD', 'SA', '5067'], ['SUBIACO', 'WA', '6008'], ['SANDY BAY', 'TAS', '7005'], ['BRADDON', 'ACT', '2612'], ['PARAP', 'NT', '0820'], ['FITZROY', 'VIC', '3065'], ['MANLY', 'NSW', '2095']];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const digits = (n) => Array.from({ length: n }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10))).join('');
const iso = (ms) => new Date(ms).toISOString();

function makePerson() {
  const [locality, subdivision, postalCode] = pick(PLACES);
  const [streetName, streetType] = pick(STREETS);
  const givenName = pick(GIVEN);
  const familyName = pick(FAMILY);
  const year = 1948 + Math.floor(Math.random() * 56);
  return {
    givenName, middleName: Math.random() < 0.4 ? pick(GIVEN).toUpperCase() : undefined, familyName,
    dateOfBirth: `${year}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
    address: { streetNumber: String(1 + Math.floor(Math.random() * 180)), streetName: streetName.toUpperCase(), streetType, locality, subdivision, postalCode },
    email: Math.random() < 0.6 ? `${givenName}.${familyName}@example.com`.toLowerCase() : undefined,
  };
}
const licence = (p) => ({ type: 'DRIVERS_LICENSE', primaryIdentifier: digits(9), secondaryIdentifier: `P${digits(7)}`, subdivision: p.address.subdivision });
const passport = () => ({ type: 'PASSPORT', primaryIdentifier: `PA${digits(7)}`, expiryDate: { normalized: `20${30 + Math.floor(Math.random() * 6)}-0${1 + Math.floor(Math.random() * 9)}-15` } });
const medicare = (p) => ({ type: 'NATIONAL_HEALTH_ID', primaryIdentifier: digits(10), subdivision: p.address.subdivision, subtype: 'G', supplementaryData: { reference: '1', nameOnCardLine1: [p.givenName, p.familyName].join(' ').toUpperCase() }, expiryDate: { normalized: '2031-04-01' } });
const fullName = (p) => [p.givenName, p.middleName, p.familyName].filter(Boolean).join(' ').toUpperCase();
const keyOf = (d) => matchKey({ type: d.type, number: d.primaryIdentifier });

// ── bookkeeping ─────────────────────────────────────────────────────
const prefix = (im) => im.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
let seq = 2000;
const nextRef = (im) => `${prefix(im)}-${++seq}`;
const STATUS = { VERIFIED: 'Verified', IN_REVIEW: 'In review', ACTION_REQUIRED: 'Action required', DECLINED: 'Declined' };
const short = (id) => id.slice(0, 8);
const poss = (n) => (n.endsWith('s') ? `${n}'` : `${n}'s`);
const DAY = 24 * 3600 * 1000;

function log(im, clientRef, title, at, steps, result) {
  store.addActivity({ id: `A-${Math.floor(at).toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`, at: iso(at), intermediary: im.name, clientRef, title, synthetic: true,
    steps: steps.map(([kind, text], i) => ({ at: iso(at + i * 400), kind, text })), result });
}

function addRel(im, entityId, doc, person, clientRef, at, extra = {}) {
  return store.add({
    kind: 'client', intermediaryId: im.id, entityId, synthetic: true,
    referenceId: standin.record(entityId).refs.find((r) => r.name === refName(im.id))?.referenceId,
    handle: handleFor(im.id, entityId), matchKey: keyOf(doc), clientRef, name: fullName(person), dateOfBirth: person.dateOfBirth,
    document: { type: doc.type, last4: doc.primaryIdentifier.slice(-4) }, workflow: im.workflow, method: 'Electronic',
    createdAt: iso(at), ...extra,
  });
}
const settle = (rel, run, at, more = {}) => {
  Object.assign(rel, { executionId: run.workflowExecutionId, executionIds: [...(rel.executionIds || []), run.workflowExecutionId], workflowStatus: run.status, completedAt: iso(at + 4000), updatedAt: iso(at + 4000), ...outcome(run), ...more });
  store.touch();
};
const holdersOf = (entityId) => [...new Set(store.relationshipsOf(entityId).map((r) => byId[r.intermediaryId]?.name))];
const synthRels = () => store.allRelationships().filter((r) => r.synthetic && !r.removedAt);
const blockedIds = () => store.blocklist().map((b) => b.entityId);
const runFor = (rel) => standin.record(rel.entityId)?.runs.find((r) => r.workflowExecutionId === rel.executionId);

/** A passed run on the record, inside the reuse window, covering every check this workflow needs. */
function reusable(entityId, workflow, at) {
  const need = requiredChecks(workflow);
  return (standin.record(entityId)?.runs || [])
    .filter((r) => r.status === 'PASS' && r.workflowName !== DUPLICATE_WORKFLOW && at - Date.parse(r.endedAt) <= POLICY.reuseWindowDays * DAY && Date.parse(r.endedAt) <= at)
    .filter((r) => need.every((c) => r.steps.passed.includes(c)))
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))[0] || null;
}
function noteReuse(entityId, im, src, at) {
  standin.record(entityId).audit.push({ timestamp: iso(at), type: 'OTHER', description: 'Comment was added', functionName: 'AddComment', source: 'Platform',
    userComment: { commentId: `C${Math.random().toString(36).slice(2, 12)}`, text: `Evidence reused: ${poss(im.name)} verification (${im.workflow}) relies on run ${src.workflowExecutionId} (${src.workflowName}, passed ${src.endedAt.slice(0, 10)}). No new checks were run.` } });
}

// ── what happens on the network ─────────────────────────────────────
function weightedIntermediary(exclude = []) {
  const pool = PARTICIPANTS.filter((im) => !exclude.includes(im.id)).flatMap((im) => Array(WEIGHT[im.id] || 2).fill(im));
  return pick(pool);
}

/** Someone new to the network onboards with one intermediary. */
function newClient(at, im = weightedIntermediary()) {
  const person = makePerson();
  const primary = Math.random() < 0.65 ? licence(person) : passport();
  person.altDoc = medicare(person);
  const r = Math.random();
  const flags = r < 0.05 ? { kycFail: true } : r < 0.10 ? { amlHit: true } : r < 0.13 ? { idvFail: true } : {};
  const ref = nextRef(im);
  const rec = standin.createRecord({ person, documents: [primary], at, refs: [{ name: refName(im.id), value: ref, type: 'CUSTOMER' }], flags });
  standin.execute(rec.entityId, DUPLICATE_WORKFLOW, at + 1000);
  const run = standin.execute(rec.entityId, im.workflow, at + 3000);
  const rel = addRel(im, rec.entityId, primary, person, ref, at);
  settle(rel, run, at);
  store.remember(keyOf(primary), rec.entityId);
  const failed = run.steps.failed;
  log(im, ref, `${im.name} submitted ${fullName(person)}`, at, [
    ['platform', `${fullName(person)}: identity index has no match for this ${primary.type === 'PASSPORT' ? 'passport' : 'driver licence'}.`],
    ['frankieone', `FrankieOne: created record ${short(rec.entityId)} and ran the platform's duplicate check (${DUPLICATE_WORKFLOW}). No match on the network.`],
    ['frankieone', `FrankieOne: ran ${poss(im.name)} workflow (${im.workflow}: ${requiredChecks(im.workflow).join(', ')}) → ${run.status}${failed.length ? `, ${failed.join(', ')} not passed` : ''}.`],
  ], `${im.name} sees ${STATUS[rel.status]}`);
  return rel;
}

/** Someone already on the network onboards with another intermediary: reuse what covers it, run what doesn't. */
function joinExisting(at) {
  const blocked = blockedIds();
  const candidates = synthRels().filter((r) => !blocked.includes(r.entityId) && standin.record(r.entityId)?.state === 'ACTIVE' && !r.reviewId && Date.parse(r.createdAt) < at);
  if (!candidates.length) return newClient(at);
  const base = pick(candidates);
  const held = store.relationshipsOf(base.entityId).map((r) => r.intermediaryId);
  const im = weightedIntermediary(held);
  if (!im) return null;
  const rec = standin.record(base.entityId);
  const doc = rec.documents[0];
  const ref = nextRef(im);
  standin.addRef(rec.entityId, { name: refName(im.id), value: ref, type: 'CUSTOMER' });
  const rel = addRel(im, rec.entityId, doc, rec.person, ref, at, { reusedRecord: true });
  const src = reusable(rec.entityId, im.workflow, at);
  const steps = [['platform', `${rel.name}: identity index matches record ${short(rec.entityId)}, already held by ${holdersOf(rec.entityId).filter((n) => n !== im.name).join(', ')}.`],
    ['frankieone', `FrankieOne: added ${poss(im.name)} reference to the same record.`]];
  if (src) {
    noteReuse(rec.entityId, im, src, at);
    Object.assign(rel, { workflowStatus: src.status, completedAt: iso(at + 2000), ...outcome(src), reuses: [{ at: iso(at + 2000), sourceExecutionId: src.workflowExecutionId, sourceWorkflow: src.workflowName, workflow: im.workflow }] });
    store.touch();
    steps.push(['platform', `Evidence reuse: ${src.workflowName} passed ${Math.round((at - Date.parse(src.endedAt)) / DAY)} days ago and covers everything ${im.workflow} needs (${requiredChecks(im.workflow).join(', ')}). No new checks.`]);
  } else {
    const have = new Set((rec.runs.filter((r) => r.status === 'PASS').flatMap((r) => r.steps.passed)));
    const missing = requiredChecks(im.workflow).filter((c) => !have.has(c));
    const run = standin.execute(rec.entityId, im.workflow, at + 2000);
    settle(rel, run, at);
    steps.push(['platform', missing.length
      ? `Checks already held don't cover ${missing.join(', ')}, which ${im.workflow} needs.`
      : `Checks already held are outside the ${POLICY.reuseWindowDays}-day window or didn't pass.`]);
    steps.push(['frankieone', `FrankieOne: ran ${poss(im.name)} workflow (${im.workflow}) → ${run.status}.`]);
  }
  log(im, ref, `${im.name} submitted ${rel.name}`, at, steps, `${im.name} sees ${STATUS[rel.status]}`);
  return rel;
}

/** The same person, with a different document: the index misses, the duplicate check doesn't. */
function duplicateHeld(at, im) {
  const blocked = blockedIds();
  const pool = synthRels().filter((r) => !blocked.includes(r.entityId) && standin.record(r.entityId)?.person.altDoc && standin.record(r.entityId)?.state === 'ACTIVE' && Date.parse(r.createdAt) < at);
  if (!pool.length) return null;
  const base = pick(pool);
  const existing = standin.record(base.entityId);
  im ||= weightedIntermediary(store.relationshipsOf(base.entityId).map((r) => r.intermediaryId));
  const person = existing.person;
  const doc = person.altDoc;
  const ref = nextRef(im);
  const rec = standin.createRecord({ person: { ...person, altDoc: undefined }, documents: [doc], at, refs: [{ name: refName(im.id), value: ref, type: 'CUSTOMER' }], flags: existing.flags });
  const dup = standin.execute(rec.entityId, DUPLICATE_WORKFLOW, at + 1000, { duplicateOf: existing.entityId });
  const review = store.addReview({
    id: `R-${Math.floor(at).toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`, kind: 'person', at: iso(at), intermediaryId: im.id, handle: handleFor(im.id, rec.entityId),
    newEntityId: rec.entityId, synthetic: true,
    candidates: [{ entityId: existing.entityId, processResultId: `PR${dup.workflowExecutionId}`, matchedOn: ['NAME', 'DATE_OF_BIRTH', 'ADDRESS'], rules: ['Given_+_Family_name', 'Given_+_Family_name_+_Date_of_birth', 'Given_+_Family_name_+_Short_form_normalised_address'] }],
    decidedAt: null, decision: null,
  });
  const rel = addRel(im, rec.entityId, doc, person, ref, at, { reviewId: review.id, workflowStatus: 'REVIEW', completedAt: iso(at + 3000), ...outcome({ status: 'REVIEW' }) });
  log(im, ref, `${im.name} submitted ${rel.name}`, at, [
    ['platform', `${rel.name}: identity index has no match for this Medicare card.`],
    ['frankieone', `FrankieOne: created record ${short(rec.entityId)} and ran the duplicate check (${DUPLICATE_WORKFLOW}).`],
    ['platform', `Duplicate check: may be record ${short(existing.entityId)} (held by ${holdersOf(existing.entityId).filter((n) => n !== im.name).join(', ')}), matched on name, date of birth and address. No document in common: held for a decision.`],
  ], `${im.name} sees In review`);
  return { review, rel, existing, rec };
}

/** A staff member decides a held duplicate (for the seeded history). */
function decideHeld(held, at, staff, decision, note) {
  const { review, rel, existing, rec } = held;
  const im = byId[review.intermediaryId];
  if (decision === 'merge') {
    const r = standin.addRef(existing.entityId, { name: refName(im.id), value: rel.clientRef, type: 'CUSTOMER' });
    standin.markDuplicate(rec.entityId, existing.entityId, at, `Same person. ${note} (${staff.name}, ${staff.role})`, staff.name);
    const merge = store.addMerge({ id: `M-${Math.floor(at).toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`, at: iso(at), intermediaryId: im.id, handle: rel.handle, retiredId: rec.entityId, survivorId: existing.entityId,
      processResultId: review.candidates[0].processResultId, matchedOn: review.candidates[0].matchedOn, reason: `Same person. ${note} (${staff.name}, ${staff.role})`, decidedBy: staff.name, decidedKind: 'person', staff, reversedAt: null });
    Object.assign(rel, { entityId: existing.entityId, referenceId: r.referenceId, mergedFrom: rec.entityId, reusedRecord: true, reviewId: null });
    const src = reusable(existing.entityId, im.workflow, at);
    if (src) {
      noteReuse(existing.entityId, im, src, at);
      Object.assign(rel, { workflowStatus: src.status, completedAt: iso(at), ...outcome(src), reuses: [{ at: iso(at), sourceExecutionId: src.workflowExecutionId, sourceWorkflow: src.workflowName, workflow: im.workflow }] });
    } else settle(rel, standin.execute(existing.entityId, im.workflow, at + 1000), at);
    Object.assign(review, { decidedAt: iso(at), decision: 'merge', mergeId: merge.id, survivorId: existing.entityId, decidedBy: staff, note });
  } else {
    settle(rel, standin.execute(rec.entityId, im.workflow, at + 1000), at, { reviewId: null });
    store.remember(keyOf(rec.documents[0]), rec.entityId);
    Object.assign(review, { decidedAt: iso(at), decision: 'different', decidedBy: staff, note });
  }
  store.touch();
  log(im, rel.clientRef, `${staff.name} decided: ${decision === 'merge' ? 'same person' : 'different people'}`, at, [
    ['platform', `Signed off by ${staff.name} (${staff.role}): ${note}`],
    ['frankieone', decision === 'merge' ? `FrankieOne: kept record ${short(existing.entityId)}, retired ${short(rec.entityId)} and moved ${poss(im.name)} reference.` : 'FrankieOne: dismissed the match. Both records stay.'],
  ], `${im.name} sees ${STATUS[rel.status]}`);
}

/** Staff add someone to the network blocklist; their relationships are declined. */
function blocklist(at, staff, reason) {
  const pool = synthRels().filter((r) => !blockedIds().includes(r.entityId) && r.status === 'VERIFIED');
  if (!pool.length) return null;
  const base = pick(pool);
  const rec = standin.record(base.entityId);
  store.addBlock({ id: `B-${Math.floor(at).toString(36).toUpperCase()}`, entityId: rec.entityId, name: base.name, dateOfBirth: base.dateOfBirth, reason, addedBy: staff, at: iso(at), attempts: [] });
  standin.setBlocked(blockedIds());
  for (const r of store.relationshipsOf(rec.entityId)) Object.assign(r, { status: 'DECLINED', riskBand: 'High', actions: [], updatedAt: iso(at) });
  store.touch();
  log(byId[base.intermediaryId], base.clientRef, `${staff.name} added ${base.name} to the network blocklist`, at, [
    ['platform', `Reason: ${reason}`],
    ['platform', `Every intermediary holding them (${holdersOf(rec.entityId).join(', ')}) now sees Declined, with no reason given.`],
  ], 'Blocklisted');
  return base;
}

/** A blocklisted person tries to onboard somewhere else. */
function blockedAttempt(at) {
  const entries = store.blocklist();
  if (!entries.length) return null;
  const b = pick(entries);
  const rec = standin.record(b.entityId);
  if (!rec) return null;
  const im = weightedIntermediary(store.relationshipsOf(b.entityId).map((r) => r.intermediaryId));
  if (!im) return null;
  const ref = nextRef(im);
  standin.addRef(rec.entityId, { name: refName(im.id), value: ref, type: 'CUSTOMER' });
  const rel = addRel(im, rec.entityId, rec.documents[0], rec.person, ref, at, { reusedRecord: true });
  settle(rel, standin.execute(rec.entityId, im.workflow, at + 1500), at);
  b.attempts.push({ at: iso(at), intermediary: im.name });
  store.touch();
  log(im, ref, `${im.name} submitted ${rel.name}`, at, [
    ['platform', `${rel.name}: identity index matches record ${short(rec.entityId)}.`],
    ['frankieone', `FrankieOne: network blocklist hit (MATCHLIST). Onboarding declined.`],
    ['platform', `${im.name} sees Declined, with no reason and no mention of a blocklist or another intermediary.`],
  ], `${im.name} sees Declined`);
  return rel;
}

/** An intermediary re-runs checks: reused where a passed run covers it. */
function rerun(at) {
  const pool = synthRels().filter((r) => r.status === 'VERIFIED' && !blockedIds().includes(r.entityId) && Date.parse(r.createdAt) < at - DAY);
  if (!pool.length) return null;
  const rel = pick(pool);
  const im = byId[rel.intermediaryId];
  const src = reusable(rel.entityId, im.workflow, at);
  if (src) {
    noteReuse(rel.entityId, im, src, at);
    Object.assign(rel, { completedAt: iso(at), updatedAt: iso(at), reuses: [...(rel.reuses || []), { at: iso(at), sourceExecutionId: src.workflowExecutionId, sourceWorkflow: src.workflowName, workflow: im.workflow }] });
    store.touch();
  } else settle(rel, standin.execute(rel.entityId, im.workflow, at), at);
  log(im, rel.clientRef, `${im.name} re-ran checks for ${rel.name}`, at, src
    ? [['platform', `Evidence reuse: ${src.workflowName} passed ${Math.max(0, Math.round((at - Date.parse(src.endedAt)) / DAY))} days ago and covers ${im.workflow}. No new checks.`]]
    : [['frankieone', `FrankieOne: nothing reusable, so ran ${im.workflow} → ${rel.workflowStatus}.`]], `${im.name} sees ${STATUS[rel.status]}`);
  return rel;
}

/** Ongoing AML monitoring finds something: everyone holding the person sees In review. */
function monitoringAlert(at) {
  const pool = synthRels().filter((r) => r.status === 'VERIFIED' && !blockedIds().includes(r.entityId));
  if (!pool.length) return null;
  const base = pick(pool);
  const rec = standin.record(base.entityId);
  rec.flags = { ...rec.flags, amlHit: true };
  const run = standin.execute(rec.entityId, 'AUS-AML-Screening', at, { monitoring: true });
  for (const r of store.relationshipsOf(rec.entityId)) Object.assign(r, { status: 'IN_REVIEW', riskBand: 'High', updatedAt: iso(at), actions: [{ code: 'UNDER_REVIEW', message: 'This client is being reviewed. You will see the outcome here.', owner: 'PLATFORM' }] });
  store.touch();
  log(byId[base.intermediaryId], base.clientRef, `Ongoing monitoring: possible adverse media for ${base.name}`, at, [
    ['frankieone', `FrankieOne: AML monitoring found a possible adverse media match (run ${short(run.workflowExecutionId)}).`],
    ['platform', `Held by ${holdersOf(rec.entityId).join(', ')}: each now sees In review. Compliance works the alert in the FrankieOne Portal.`],
  ], 'In review for every holder');
  return base;
}

/** The merge policy settles a duplicate on its own: same document, exact date of birth. */
function autoMerge(at) {
  const held = duplicateHeld(at);
  if (!held) return null;
  const { review, rel, existing, rec } = held;
  const im = byId[review.intermediaryId];
  store.reviews().splice(store.reviews().indexOf(review), 1);
  const r = standin.addRef(existing.entityId, { name: refName(im.id), value: rel.clientRef, type: 'CUSTOMER' });
  standin.markDuplicate(rec.entityId, existing.entityId, at + 2000, 'Merged automatically under the merge policy.', 'Platform merge policy');
  store.addMerge({ id: `M-${Math.floor(at).toString(36).toUpperCase()}A`, at: iso(at + 2000), intermediaryId: im.id, handle: rel.handle, retiredId: rec.entityId, survivorId: existing.entityId, processResultId: review.candidates[0].processResultId,
    matchedOn: ['NAME', 'DATE_OF_BIRTH', 'ADDRESS'], reason: 'Merged automatically: matched on exact name, date of birth and address under the merge policy.', decidedBy: 'Merge policy', decidedKind: 'policy', staff: null, reversedAt: null });
  Object.assign(rel, { entityId: existing.entityId, referenceId: r.referenceId, mergedFrom: rec.entityId, reusedRecord: true, reviewId: null });
  const src = reusable(existing.entityId, im.workflow, at);
  if (src) Object.assign(rel, { workflowStatus: src.status, completedAt: iso(at + 2000), ...outcome(src), reuses: [{ at: iso(at + 2000), sourceExecutionId: src.workflowExecutionId, sourceWorkflow: src.workflowName, workflow: im.workflow }] });
  else settle(rel, standin.execute(existing.entityId, im.workflow, at + 3000), at);
  store.touch();
  log(im, rel.clientRef, `Merge policy resolved ${rel.name}`, at + 2000, [['platform', 'Exact name, date of birth and address on a single candidate: merged without a person.']], `${im.name} sees ${STATUS[rel.status]}`);
  return rel;
}

// ── filling the network ─────────────────────────────────────────────
const NOTES_MERGE = ['Same name, date of birth and address; the Medicare card and licence are both theirs.', 'Confirmed with the intermediary: same client.', 'Exact match on name, DOB and address; no conflicting details.'];
const NOTES_SEPARATE = ['Different middle names and the documents don’t match the record held.', 'Father and son at the same address: different people.'];
const REASONS = ['Confirmed identity fraud: forged licence presented at another institution.', 'Sanctions match confirmed by compliance.', 'Money mule activity reported by an intermediary.', 'Fraudulent documents detected during review.'];

/** Generate about two weeks of network history, plus decisions still waiting. */
export function fill({ people = 60 } = {}) {
  const now = Date.now();
  const start = now - 14 * DAY;
  const events = [];
  for (let i = 0; i < people; i++) events.push({ at: start + Math.random() * 13 * DAY, kind: 'new' });
  for (let i = 0; i < Math.round(people * 0.55); i++) events.push({ at: start + 2 * DAY + Math.random() * 11.5 * DAY, kind: 'join' });
  for (let i = 0; i < Math.round(people * 0.15); i++) events.push({ at: start + 5 * DAY + Math.random() * 8.5 * DAY, kind: 'rerun' });
  for (let i = 0; i < 3; i++) events.push({ at: start + 6 * DAY + Math.random() * 7 * DAY, kind: 'monitor' });
  for (let i = 0; i < 4; i++) events.push({ at: start + 3 * DAY + i * 2.5 * DAY, kind: 'block', i });
  for (let i = 0; i < 6; i++) events.push({ at: start + 8 * DAY + Math.random() * 5.5 * DAY, kind: 'attempt' });
  for (let i = 0; i < 7; i++) events.push({ at: start + 4 * DAY + Math.random() * 9 * DAY, kind: 'decided', i });
  for (let i = 0; i < 2; i++) events.push({ at: start + 7 * DAY + Math.random() * 6 * DAY, kind: 'auto' });
  events.sort((a, b) => a.at - b.at);
  for (const e of events) {
    if (e.kind === 'new') newClient(e.at);
    else if (e.kind === 'join') joinExisting(e.at);
    else if (e.kind === 'rerun') rerun(e.at);
    else if (e.kind === 'monitor') monitoringAlert(e.at);
    else if (e.kind === 'block') blocklist(e.at, PLATFORM_STAFF[e.i % 2], REASONS[e.i % REASONS.length]);
    else if (e.kind === 'attempt') blockedAttempt(e.at);
    else if (e.kind === 'auto') autoMerge(e.at);
    else if (e.kind === 'decided') {
      const held = duplicateHeld(e.at);
      if (held) {
        const merge = e.i % 4 !== 3;
        decideHeld(held, e.at + (10 + Math.random() * 200) * 60000, PLATFORM_STAFF[e.i % 2], merge ? 'merge' : 'different', merge ? pick(NOTES_MERGE) : pick(NOTES_SEPARATE));
      }
    }
  }
  // Decisions still waiting, from just now to over a day: the queue the platform needs to clear.
  for (const minutes of [6, 28, 75, 240, 1560]) duplicateHeld(now - minutes * 60000);
  return summary();
}

// ── live activity ───────────────────────────────────────────────────
let live = null;
const LIVE_MIX = [['new', 34], ['join', 28], ['rerun', 12], ['duplicate', 8], ['attempt', 7], ['monitor', 5], ['auto', 6]];
function liveEvent() {
  if (standin.count() > 800) return stopLive();
  let r = Math.random() * 100;
  const kind = LIVE_MIX.find(([, w]) => (r -= w) < 0)?.[0] || 'new';
  const at = Date.now();
  try {
    ({ new: () => newClient(at), join: () => joinExisting(at), rerun: () => rerun(at), duplicate: () => duplicateHeld(at), attempt: () => blockedAttempt(at), monitor: () => monitoringAlert(at), auto: () => autoMerge(at) })[kind]();
  } catch (err) { console.error('demo event failed', err.message); }
}
export function startLive(everyMs = 5000) { if (!live) live = setInterval(liveEvent, everyMs); return summary(); }
export function stopLive() { clearInterval(live); live = null; return summary(); }

export function clearAll() {
  stopLive();
  store.reset();
  standin.clear();
  return summary();
}

export function summary() {
  const rels = synthRels();
  return {
    live: !!live,
    records: standin.count(),
    relationships: rels.length,
    intermediaries: new Set(rels.map((r) => r.intermediaryId)).size,
    waiting: store.reviews().filter((r) => !r.decidedAt).length,
    blocklisted: store.blocklist().length,
    checkProfiles: PARTICIPANTS.map((im) => ({ intermediary: im.name, workflow: im.workflow, checks: requiredChecks(im.workflow) })),
  };
}
