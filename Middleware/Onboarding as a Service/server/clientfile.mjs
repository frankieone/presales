/**
 * The client file: everything FrankieOne holds on a client, as one view.
 *
 *   verifications  every workflow run, with the checks that passed and failed
 *   risk           the latest risk assessment and its factors
 *   documents      identity documents, photos and scans, uploaded files
 *   history        the audit trail, plus what the platform itself did
 *
 * Two versions of the same file:
 *
 *   intermediaryFile  what one intermediary sees: only its own verifications,
 *                     the documents it supplied or collected, and the audit
 *                     events from its own runs. A record shared with other
 *                     intermediaries never shows their runs, documents or
 *                     risk factors, so the file can't reveal who else holds
 *                     the client. Risk is shown as a level and factors,
 *                     without scores.
 *   platformFile      the platform's compliance view: everything on the
 *                     record, with each run and event attributed to the
 *                     intermediary it was for.
 */
import { DUPLICATE_WORKFLOW, IDV_FLOW, POLICY, byId } from './config.mjs';
import * as frankie from './frankie.mjs';
import { store } from './store.mjs';
import { ClientError } from './tier1.mjs';

// ── plain-language labels ───────────────────────────────────────────
const CHECKS = {
  KYC: 'Name, date of birth and address matched against independent data sources',
  IDV: 'Identity document verified',
  AML: 'Sanctions, politically exposed person and adverse media screening',
  MATCHLIST: 'Network blocklist',
  DUPLICATE: 'Duplicate check across the network',
  ORGANIZATION_DATA_FETCH: 'Business register check',
  ORGANIZATION_PROFILE: 'Business register check',
  OCR: 'Document read from photo',
  BIOMETRICS: 'Selfie matched to document photo',
  FRAUD: 'Fraud and device signals',
};
const HIDDEN_STEPS = new Set(['START', 'FINISH', 'DECISION', 'TOGGLE_MONITORING', 'RISK']);
const RESULT = { PASS: 'Passed', CLEAR: 'Passed', COMPLETE: 'Complete', FAIL: 'Failed', REVIEW: 'Needs review', BLOCKED: 'Blocked', UNCHECKED: 'Not checked', NOT_APPLICABLE: 'Not applicable', IN_PROGRESS: 'In progress' };
const DOC_TYPE = {
  DRIVERS_LICENSE: 'Driver licence', PASSPORT: 'Passport', NATIONAL_HEALTH_ID: 'Medicare card', SELF_IMAGE: 'Selfie',
  UTILITY_BILL: 'Utility bill', BANK_STATEMENT: 'Bank statement', TRUST_DEED: 'Trust deed', PARTNERSHIP_AGREEMENT: 'Partnership agreement',
  ATTESTATION: 'Statutory declaration', REPORT: 'Report', OTHER: 'Other document',
  CONSTITUTION: 'Constitution', CERTIFICATE_OF_REGISTRATION: 'Certificate of registration',
};
// Types the platform offers that FrankieOne files as OTHER, keeping the label in the filename.
const SENT_AS = { CONSTITUTION: 'OTHER', CERTIFICATE_OF_REGISTRATION: 'OTHER' };
const band = (level) => {
  const l = String(level || '').toUpperCase();
  return l.startsWith('UNACC') ? 'Unacceptable' : l === 'HIGH' ? 'High' : l === 'MEDIUM' ? 'Medium' : l === 'LOW' ? 'Low' : l ? l[0] + l.slice(1).toLowerCase() : null;
};
const STATUS_TEXT = { VERIFIED: 'Verified', IN_REVIEW: 'In review', ACTION_REQUIRED: 'Action required', DECLINED: 'Declined' };
const last4 = (s) => (s ? String(s).slice(-4) : '');
const workflowKind = (name) => (name === DUPLICATE_WORKFLOW ? 'Duplicate check'
  : /organi[sz]ation/i.test(name || '') ? 'Business register check'
  : /idv|daon|onesdk/i.test(name || '') ? 'ID verification (photo and selfie)'
  : 'Onboarding verification');

function checks(w) {
  const steps = w.steps || {};
  const list = [];
  for (const [bucket, label] of [['passed', 'Passed'], ['failed', 'Failed'], ['incomplete', 'Incomplete']]) {
    for (const s of steps[bucket] || []) {
      if (HIDDEN_STEPS.has(s)) continue;
      // A photo ID step that didn't run (no photo taken) in a run that passed on electronic checks wasn't needed.
      const notDone = s === 'IDV' && label === 'Failed' && w.status === 'PASS';
      list.push({ step: s, check: notDone ? 'Photo ID check' : CHECKS[s] || s.replace(/_/g, ' ').toLowerCase(), result: notDone ? 'Not done' : label });
    }
  }
  return list;
}

const auditText = (e) => {
  const step = e.stepName && !HIDDEN_STEPS.has(e.stepName) ? CHECKS[e.stepName] || e.stepName : null;
  return [e.description, step && `(${step.toLowerCase()})`].filter(Boolean).join(' ');
};

// The audit trail records every internal step (initiated, evaluating, results ready). An
// intermediary's history keeps what a reviewer cares about: each check's result, status and
// risk changes, and anything a person did.
const NOISE = /initiat|evaluating|results ready|enablement|step finished|entity was updated|workflow started/i;
function keyEvents(events) {
  const seen = new Set();
  const out = [];
  for (const e of events) {
    if (NOISE.test(e.description || '')) continue;
    // The run's completion, status and risk changes repeat what the checks and the outcome already say.
    if (['WORKFLOW_COMPLETE', 'WORKFLOW_STATUS_CHANGE', 'WORKFLOW_RISK_CHANGE'].includes(e.type)) continue;
    const step = CHECKS[e.stepName];
    const text = step || e.description;
    const key = `${e.workflowExecutionId}|${text}`;
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push({ at: e.timestamp, source: 'FrankieOne', text, result: RESULT[e.status] && e.status !== 'UNCHECKED' ? RESULT[e.status] : null });
  }
  return out;
}

// ── attribution: which relationship a run belongs to ────────────────
const relsOn = (entityId) => store.allRelationships().filter((r) => r.entityId === entityId);
const runIds = (rel) => new Set([...(rel.executionIds || []), rel.executionId, rel.registryExecutionId].filter(Boolean));

/**
 * The relationships a workflow run was for (one run can serve two: a person
 * who is both a trustee and a client of the same intermediary), or
 * ['platform'], or [] when it isn't the platform's.
 */
function ownersOf(w, rels) {
  const direct = rels.filter((r) => runIds(r).has(w.workflowExecutionId));
  if (direct.length) return direct;
  if (w.workflowName === DUPLICATE_WORKFLOW) return ['platform'];
  // A hosted ID check runs its own workflow: it belongs to whoever sent the most recent link before it started.
  const started = Date.parse(w.startedAt || w.createdAt || 0);
  const sent = rels.flatMap((r) => (r.idvRequests || []).map((q) => ({ r, at: Date.parse(q.at) })))
    .filter((x) => x.at <= started).sort((a, b) => b.at - a.at)[0];
  if (sent && workflowKind(w.workflowName).startsWith('ID verification')) return [sent.r];
  return [];
}

async function loadRecord(entityId, entityType) {
  const [profile, audit, documents] = await Promise.all([
    frankie.getServiceProfile(entityId, entityType).catch(() => ({})),
    frankie.listAudit(entityId).catch(() => []),
    frankie.listDocuments(entityId, entityType).catch(() => ({})),
  ]);
  // The service profile summarises only the latest run of each workflow, so list every run of each one.
  const summaries = profile.serviceProfile?.workflowSummaries || [];
  const names = new Set([...summaries.map((w) => w.workflowName), ...relsOn(entityId).map((r) => r.workflow)].filter(Boolean));
  const lists = await Promise.all([...names].map((n) => frankie.listExecutions(entityId, n, entityType).then((r) => r.workflowResults || []).catch(() => [])));
  const latestRisk = summaries.filter((w) => w.riskAssessment).sort((a, b) => Date.parse(b.startedAt || 0) - Date.parse(a.startedAt || 0))[0]?.riskAssessment || null;
  const runs = lists.flat().map((w) => ({ ...w, risk: [...(w.workflowStepResults || [])].reverse().find((st) => st.risk)?.risk || null }))
    .sort((a, b) => Date.parse(b.startedAt || 0) - Date.parse(a.startedAt || 0));
  const docs = Object.entries(documents).filter(([k, v]) => Array.isArray(v) && k !== 'requestId').flatMap(([cls, list]) => list.map((d) => ({ ...d, class: d.class || cls })))
    // Placeholder entries with nothing in them (no type, number or file) are noise.
    .filter((d) => d.documentId && (d.type || d.primaryIdentifier || d.attachments?.length));
  return { profile: profile.serviceProfile || {}, runs, latestRisk, audit, docs };
}

const verification = (w, scores) => ({
  ref: w.workflowExecutionId,
  workflow: w.workflowName,
  // A hosted ID check run (document photo and selfie), so its photo ID step counts as biometrics.
  photoId: workflowKind(w.workflowName).startsWith('ID verification'),
  startedAt: w.startedAt, endedAt: w.endedAt,
  result: RESULT[w.status] || w.status || 'In progress',
  monitoring: w.lifecyclePhase === 'MONITORING',
  riskLevel: band(w.risk?.level),
  ...(scores || POLICY.shareRiskScore ? { riskScore: w.risk?.overallScore } : {}),
  checks: checks(w),
  issues: (w.issues || []).map((i) => i.description || i.category || i.issue).filter(Boolean),
});

/** Risk: the level from the latest run in view, and the factors those runs contributed. */
function riskFrom(runs, ra, keep, scores) {
  const latest = runs.find((w) => w.risk);
  if (!latest && !ra) return null;
  return {
    level: band(latest?.risk?.level || ra?.workflowRiskLevel),
    ...(scores || POLICY.shareRiskScore ? { score: latest?.risk?.overallScore } : {}),
    ...(scores ? { entityLevel: band(ra?.riskLevel), entityScore: ra?.riskScore } : {}),
    assessedAt: latest?.endedAt || ra?.updatedAt,
    factors: (ra?.riskFactors || []).filter((f) => f.status !== 'OVERRIDDEN' && keep(f)).map((f) => ({
      factor: f.description || f.factor, value: f.value, ...(scores ? { score: f.score, status: f.status } : {}),
    })),
  };
}

function documentView(d, scores) {
  return {
    documentId: d.documentId,
    type: DOC_TYPE[d.type] || (d.type ? d.type.replace(/_/g, ' ').toLowerCase() : 'Unlabelled document'),
    class: d.class, country: d.country,
    number: d.primaryIdentifier ? `•••• ${last4(d.primaryIdentifier)}` : null,
    ...(scores && d.primaryIdentifier ? { fullNumber: d.primaryIdentifier } : {}),
    addedAt: d.createdAt,
    attachments: (d.attachments || []).map((a) => ({ attachmentId: a.attachmentId, filename: a.filename, mimeType: a.mimeType, side: a.side || null, type: a.type || null, addedAt: a.createdAt })),
  };
}

// ── what the platform did, for one relationship ─────────────────────
function platformEvents(rel) {
  const out = [{ at: rel.createdAt, source: 'Platform', text: rel.kind === 'business' ? 'Business submitted for verification' : rel.kind === 'related' ? `Submitted as ${String(rel.roleLabel || 'person').toLowerCase()} of a business client` : 'Submitted for verification' }];
  if (rel.completedAt) out.push({ at: rel.completedAt, source: 'Platform', text: `Status set to ${STATUS_TEXT[rel.status] || rel.status}` });
  for (const u of rel.uploads || []) out.push({ at: u.at, source: 'Platform', text: `Document added: ${u.label}` });
  for (const q of rel.idvRequests || []) out.push({ at: q.at, source: 'Platform', text: 'ID verification link sent to the client' });
  return out;
}

// ── the intermediary's file ─────────────────────────────────────────
async function scopedFile(rel, entityType) {
  const rels = relsOn(rel.entityId);
  const { runs, latestRisk, audit, docs } = await loadRecord(rel.entityId, entityType);
  const mineRuns = runs.filter((w) => ownersOf(w, rels).includes(rel));
  const mineIds = new Set(mineRuns.map((w) => w.workflowExecutionId));
  // Photos and selfies captured by a hosted ID check this intermediary sent: added after its link, by the end of its run.
  const idvWindows = mineRuns.filter((w) => workflowKind(w.workflowName).startsWith('ID verification')).map((w) => {
    const sent = (rel.idvRequests || []).map((q) => Date.parse(q.at)).filter((t) => t <= Date.parse(w.startedAt)).sort((x, y) => y - x)[0];
    return [sent ?? Date.parse(w.startedAt), Date.parse(w.endedAt || w.startedAt) + 60_000];
  });
  const capturedByMyIdv = (d) => idvWindows.some(([from, to]) => Date.parse(d.createdAt) >= from && Date.parse(d.createdAt) <= to);

  const submitted = rel.document;
  const mineDocs = docs.filter((d) =>
    (rel.documentIds || []).includes(d.documentId)
    || (submitted && d.type === submitted.type && last4(d.primaryIdentifier) === submitted.last4)
    || (capturedByMyIdv(d) && !store.allRelationships().some((r) => r !== rel && (r.documentIds || []).includes(d.documentId))));

  return {
    verifications: mineRuns.filter((w) => w.lifecyclePhase !== 'MONITORING').map((w) => verification(w, false)),
    // Risk factors are held on the record, not per run. Any that describe a document this
    // intermediary didn't supply are left out, as they'd show another intermediary's submission.
    risk: mineRuns.length ? riskFrom(mineRuns, latestRisk, (f) => f.factor !== 'document_type' || f.value === submitted?.type, false) : null,
    documents: mineDocs.map((d) => documentView(d, false)),
    history: [
      ...keyEvents(audit.filter((e) => mineIds.has(e.workflowExecutionId))),
      ...platformEvents(rel),
    ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
  };
}

const findClient = (intermediary, handle) => {
  const rel = store.find(intermediary.id, handle);
  if (!rel || rel.kind === 'related') throw new ClientError(404, 'NOT_FOUND', 'No such client.');
  return rel;
};
const peopleOf = (biz) => store.allRelationships().filter((r) => r.kind === 'related' && r.intermediaryId === biz.intermediaryId && r.businessHandle === biz.handle && !r.removedAt);

export async function intermediaryFile(intermediary, handle) {
  const rel = findClient(intermediary, handle);
  store.disclose(intermediary.id, handle, ['verifications', 'risk', 'documents', 'history'], 'file');
  const id = (r) => (POLICY.shareEntityId ? { entityId: r.entityId } : {});
  if (rel.kind !== 'business') return { kind: 'INDIVIDUAL', handle, name: rel.name, ...id(rel), ...(await scopedFile(rel, 'INDIVIDUAL')) };
  const [own, people] = await Promise.all([
    scopedFile(rel, 'ORGANIZATION'),
    Promise.all(peopleOf(rel).map(async (p) => ({ personHandle: p.handle, name: p.name, role: p.roleLabel, status: p.status, ...id(p), ...(await scopedFile(p, 'INDIVIDUAL')) }))),
  ]);
  return { kind: 'BUSINESS', handle, name: rel.name, ...id(rel), ...own, people };
}

/** Stream one attachment, after checking the document is in this intermediary's file. */
export async function intermediaryAttachment(intermediary, handle, documentId, attachmentId, personHandle) {
  const client = findClient(intermediary, handle);
  const rel = personHandle ? peopleOf(client).find((p) => p.handle === personHandle) : client;
  if (!rel) throw new ClientError(404, 'NOT_FOUND', 'No such person.');
  const entityType = rel.kind === 'business' ? 'ORGANIZATION' : 'INDIVIDUAL';
  const file = await scopedFile(rel, entityType);
  if (!file.documents.some((d) => d.documentId === documentId)) throw new ClientError(404, 'NOT_FOUND', 'No such document.');
  return attachment(rel.entityId, documentId, attachmentId, entityType);
}

async function attachment(entityId, documentId, attachmentId, entityType) {
  const d = await frankie.getDocumentData(entityId, documentId, entityType);
  const doc = d.document || d;
  const a = (doc.attachments || []).find((x) => x.attachmentId === attachmentId);
  if (!a?.data?.base64) throw new ClientError(404, 'NOT_FOUND', 'That file is not available.');
  return { mimeType: a.mimeType || 'application/octet-stream', filename: a.filename || attachmentId, bytes: Buffer.from(a.data.base64, 'base64') };
}

// ── adding to the file ──────────────────────────────────────────────
const MAX_BYTES = 6 * 1024 * 1024;

/** Attach a document (and its file) to a client's record, or to one person behind a business. */
export async function addClientDocument(intermediary, client, body) {
  const rel = body.person ? peopleOf(client).find((p) => p.handle === body.person) : client;
  if (!rel) throw new ClientError(404, 'NOT_FOUND', 'No such person.');
  const entityType = rel.kind === 'business' ? 'ORGANIZATION' : 'INDIVIDUAL';
  const type = String(body.type || 'OTHER').toUpperCase();
  const label = DOC_TYPE[type] || type.replace(/_/g, ' ').toLowerCase();
  const attachments = [];
  if (body.file?.base64) {
    if (Buffer.byteLength(body.file.base64, 'base64') > MAX_BYTES) throw new ClientError(413, 'TOO_LARGE', 'Files can be up to 6 MB.');
    attachments.push({ filename: body.file.filename, mimeType: body.file.mimeType, data: { base64: body.file.base64 } });
  }
  const created = await frankie.addDocument(rel.entityId, { type: SENT_AS[type] || type, class: 'SUPPORTING', country: 'AUS', attachments }, entityType, intermediary.id);
  const documentId = created.document?.documentId;
  store.update(rel, {
    documentIds: [...(rel.documentIds || []), documentId].filter(Boolean),
    uploads: [...(rel.uploads || []), { at: new Date().toISOString(), label: body.file?.filename ? `${label} (${body.file.filename})` : label }],
  });
  return { documentId, label, rel };
}

/** A one-time link for the client (or a person behind a business) to photograph their ID and take a selfie. */
export async function sendIdvLink(intermediary, handle, personHandle) {
  const client = findClient(intermediary, handle);
  const rel = personHandle ? peopleOf(client).find((p) => p.handle === personHandle) : client;
  if (!rel || rel.kind === 'business') throw new ClientError(400, 'NOT_A_PERSON', 'ID verification is for a person. Choose one of the people behind the business.');
  const r = await frankie.hostedIdvUrl(rel.entityId, IDV_FLOW);
  store.update(rel, { idvRequests: [...(rel.idvRequests || []), { at: new Date().toISOString() }] });
  store.disclose(intermediary.id, handle, ['idvUrl'], 'idv-link');
  return { url: r.url, expiresAt: r.urlExpiry || null, for: rel.name };
}

// ── the platform's file ─────────────────────────────────────────────
const holderLabel = (owners) => (!owners?.length ? 'Outside the platform' : owners.map((o) => (o === 'platform' ? 'Platform'
  : `${byId[o.intermediaryId]?.name}${o.kind === 'related' ? ` (${String(o.roleLabel).toLowerCase()})` : ''}`)).join(', '));

export async function platformFile(entityId) {
  const rels = relsOn(entityId);
  if (!rels.length) throw new ClientError(404, 'NOT_FOUND', 'No such record on the network.');
  const entityType = rels[0].kind === 'business' ? 'ORGANIZATION' : 'INDIVIDUAL';
  const { profile, runs, latestRisk, audit, docs } = await loadRecord(entityId, entityType);
  const ownerByRun = Object.fromEntries(runs.map((w) => [w.workflowExecutionId, ownersOf(w, rels)]));
  const uploader = (d) => rels.find((r) => (r.documentIds || []).includes(d.documentId));
  return {
    entityId, entityType, name: rels[0].name, state: profile.state,
    verifications: runs.map((w) => ({ ...verification(w, true), for: holderLabel(ownerByRun[w.workflowExecutionId]) })),
    risk: riskFrom(runs, latestRisk, () => true, true),
    documents: docs.map((d) => ({ ...documentView(d, true), addedBy: uploader(d) ? byId[uploader(d).intermediaryId]?.name : null })),
    history: audit.map((e) => ({
      at: e.timestamp, source: e.source || e.channel || 'FrankieOne', type: e.type, text: auditText(e), result: RESULT[e.status] || e.status || null,
      workflow: e.workflowName || null, for: e.workflowExecutionId ? holderLabel(ownerByRun[e.workflowExecutionId]) : null,
    })),
    holders: rels.map((r) => ({ intermediary: byId[r.intermediaryId]?.name, clientRef: r.clientRef, handle: r.handle, role: r.roleLabel || null, removedAt: r.removedAt || null })),
  };
}

export const platformAttachment = (entityId, documentId, attachmentId) => {
  const rel = relsOn(entityId)[0];
  if (!rel) throw new ClientError(404, 'NOT_FOUND', 'No such record on the network.');
  return attachment(entityId, documentId, attachmentId, rel.kind === 'business' ? 'ORGANIZATION' : 'INDIVIDUAL');
};
