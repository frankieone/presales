/**
 * A stand-in for FrankieOne, used only for generated demo records (entity
 * IDs starting "feed"). It answers the same API calls the platform makes —
 * records, workflow runs, documents, audit trail, comments, duplicate
 * results — so every platform feature runs unchanged on demo data, without
 * sending anything to FrankieOne. Real records never reach it.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DUPLICATE_WORKFLOW, PLATFORM, requiredChecks } from './config.mjs';

const FILE = path.join(PLATFORM.dataDir, 'standin.json');
let db = load();
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { records: {}, blocked: [] }; } }
let timer = null;
// Writes are batched: the generator can create hundreds of events.
function save() { clearTimeout(timer); timer = setTimeout(() => { fs.mkdirSync(PLATFORM.dataDir, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); }, 300); }

const hex = (n) => crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
export const newEntityId = () => `feed${hex(4)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
const ulid = () => `01S${hex(23).toUpperCase()}`;
export const isStandin = (id) => typeof id === 'string' && id.startsWith('feed');
const ID_IN_PATH = /\/(feed[0-9a-f]{4}-[0-9a-f-]{27})(?:[/?]|$)/;

/** Does this FrankieOne call concern a demo record? */
export function owns(apiPath, body) {
  return ID_IN_PATH.test(apiPath) || isStandin(body?.entityId) || isStandin(body?.comment?.entityId) || /[?&]entityId=feed/.test(apiPath);
}

export const clear = () => { db = { records: {}, blocked: [] }; save(); };
export const record = (id) => db.records[id];
export const count = () => Object.keys(db.records).length;

/** Is this person on the network blocklist? (The platform keeps the list; the stand-in's matchlist step reads it.) */
export const setBlocked = (ids) => { db.blocked = ids; save(); };

// ── creating records (the generator calls these directly) ───────────
export function createRecord({ person, documents, at, refs = [], flags = {} }) {
  const entityId = newEntityId();
  const iso = new Date(at).toISOString();
  db.records[entityId] = {
    entityId, createdAt: iso, state: 'ACTIVE', person, flags,
    documents: documents.map((d) => ({ documentId: crypto.randomUUID(), class: 'IDENTITY', country: 'AUS', createdAt: iso, entityId, attachments: [], ...d })),
    refs: refs.map((r) => ({ referenceId: crypto.randomUUID(), ...r })),
    runs: [], audit: [{ timestamp: iso, type: 'ENTITY_CREATE', description: 'Entity was created', source: '', functionName: 'CreateIndividual' }],
  };
  save();
  return db.records[entityId];
}

const ORDER = ['MATCHLIST', 'DUPLICATE', 'KYC', 'IDV', 'BIOMETRICS', 'AML'];
const EVENT_STATUS = { CLEAR: 'PASS', MATCH: 'PASS', PASS: 'PASS', NO_MATCH: 'FAIL', FAIL: 'FAIL', HIT: 'REVIEW' };

/** Run a workflow on a demo record: each required check, a risk assessment, and the audit events FrankieOne would write. */
export function execute(entityId, workflowName, at = Date.now(), opts = {}) {
  const rec = db.records[entityId];
  const steps = workflowName === DUPLICATE_WORKFLOW ? ['MATCHLIST', 'DUPLICATE'] : requiredChecks(workflowName).slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const f = { ...rec.flags, ...opts.flags };
  const blocked = db.blocked.includes(entityId);
  const result = {
    MATCHLIST: blocked ? 'HIT' : 'CLEAR',
    DUPLICATE: opts.duplicateOf ? 'HIT' : 'CLEAR',
    KYC: f.kycFail ? 'NO_MATCH' : 'MATCH',
    IDV: f.idvFail ? 'FAIL' : 'PASS',
    BIOMETRICS: f.idvFail ? 'FAIL' : 'PASS',
    AML: f.amlHit ? 'HIT' : 'CLEAR',
  };
  const failed = steps.filter((s) => !['CLEAR', 'MATCH', 'PASS'].includes(result[s]));
  const status = blocked ? 'FAIL' : failed.some((s) => ['KYC', 'IDV', 'BIOMETRICS', 'DUPLICATE'].includes(s)) ? 'FAIL' : failed.includes('AML') ? 'REVIEW' : 'PASS';
  const score = blocked ? 100 : 4 + (f.amlHit ? 45 : 0) + (f.kycFail ? 18 : 0) + (f.idvFail ? 15 : 0) + Math.floor(Math.random() * 6);
  const level = score >= 90 ? 'UNACCEPTABLE' : score >= 50 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
  const started = new Date(at).toISOString();
  const ended = new Date(at + 1500 + Math.floor(Math.random() * 2500)).toISOString();
  const id = ulid();
  const doc = rec.documents[0];
  const run = {
    workflowExecutionId: id, workflowName, entityId, status, result: status, workflowExecutionState: 'COMPLETED',
    lifecyclePhase: opts.monitoring ? 'MONITORING' : 'ONBOARDING', createdAt: started, startedAt: started, endedAt: ended,
    steps: { order: ['START', ...steps, 'DECISION', 'FINISH'], passed: ['START', ...steps.filter((s) => !failed.includes(s)), 'DECISION', 'FINISH'], failed, incomplete: [], notApplicable: [] },
    workflowStepResults: [...steps.map((s) => ({ stepName: s, result: result[s] })), { stepName: 'DECISION', result: 'COMPLETE', risk: { level, overallScore: score } }],
    issues: f.amlHit ? [{ description: 'Possible adverse media match' }] : [],
    riskAssessment: {
      riskLevel: level, riskScore: score, workflowRiskLevel: level, workflowRiskScore: score, updatedAt: ended,
      riskFactors: [
        { description: 'Entity Type', factor: 'entity_type', value: 'INDIVIDUAL', score: 2, status: 'VALID', createdWorkflowExecutionId: id },
        { description: 'ID Document Type', factor: 'document_type', value: doc?.type, score: 1, status: 'VALID', createdWorkflowExecutionId: id },
        { description: 'Residential address country', factor: 'address_country', value: 'AUS', score: 1, status: 'VALID', createdWorkflowExecutionId: id },
        ...(f.amlHit ? [{ description: 'Adverse media', factor: 'aml_media', value: 'POSSIBLE_MATCH', score: 45, status: 'VALID', createdWorkflowExecutionId: id }] : []),
        ...(blocked ? [{ description: 'Network blocklist', factor: 'matchlist', value: 'HIT', score: 100, status: 'VALID', createdWorkflowExecutionId: id }] : []),
      ],
    },
  };
  rec.runs.push(run);
  const ev = (type, description, extra = {}) => rec.audit.push({ timestamp: ended, type, description, workflowExecutionId: id, workflowName, source: '', channel: 'API', ...extra });
  ev('WORKFLOW_EVENT', 'Workflow started', { status: 'COMPLETE' });
  for (const s of steps) ev('WORKFLOW_EVENT', 'Step completed', { stepName: s, status: EVENT_STATUS[result[s]] || result[s] });
  ev('WORKFLOW_RISK_CHANGE', 'Workflow risk has changed', { riskLevel: level, riskScore: score });
  ev('WORKFLOW_COMPLETE', 'Workflow completed', { status });
  save();
  return run;
}

export function addRef(entityId, ref) {
  const rec = db.records[entityId];
  const r = { referenceId: crypto.randomUUID(), ...ref };
  rec.refs.push(r);
  save();
  return r;
}

export function markDuplicate(entityId, survivorId, at, text, author) {
  const rec = db.records[entityId];
  rec.state = 'DUPLICATE';
  rec.audit.push({ timestamp: new Date(at).toISOString(), type: 'ENTITY_UPDATE', description: 'Process result(s) have been updated', source: author || '', userComment: text ? { commentId: ulid(), text } : undefined });
  save();
}

// ── the API surface the platform uses ───────────────────────────────
const summaries = (rec) => {
  const latest = {};
  for (const r of rec.runs) if (!latest[r.workflowName] || Date.parse(r.startedAt) > Date.parse(latest[r.workflowName].startedAt)) latest[r.workflowName] = r;
  return Object.values(latest).map((r) => ({ ...r, workflowStepResults: undefined }));
};
const individual = (rec) => ({
  entityId: rec.entityId, entityType: 'INDIVIDUAL', createdAt: rec.createdAt,
  name: { givenName: rec.person.givenName, middleName: rec.person.middleName, familyName: rec.person.familyName, displayName: [rec.person.givenName, rec.person.middleName, rec.person.familyName].filter(Boolean).join(' ').toUpperCase() },
  dateOfBirth: { normalized: rec.person.dateOfBirth },
  addresses: [{ ...rec.person.address, country: 'AUS', status: 'CURRENT', type: 'RESIDENTIAL' }],
  emailAddresses: rec.person.email ? [{ email: rec.person.email }] : [],
  phoneNumbers: rec.person.phone ? [{ number: rec.person.phone }] : [],
  externalReferences: rec.refs,
  documents: { IDENTITY: rec.documents.filter((d) => d.class === 'IDENTITY') },
});
const fail = (status, message) => { const e = new Error(message); e.status = status; e.detail = { errorMsg: message }; throw e; };

export function handle(method, apiPath, body, channel, username) {
  const [p, qs] = apiPath.split('?');
  const q = new URLSearchParams(qs || '');
  const now = new Date().toISOString();
  if (p === '/v2/individuals/hostedUrl') fail(400, 'This is generated demo data, not a FrankieOne record, so there is no ID check link.');
  if (p === '/v2/audit') {
    const rec = db.records[q.get('entityId')];
    if (!rec) fail(404, 'Not found');
    const events = rec.audit.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return { events, meta: { total: events.length, count: events.length, page: 1 } };
  }
  if (p === '/v2/comments' && method === 'POST') {
    const rec = db.records[body.comment.entityId];
    const comment = { commentId: ulid(), text: body.comment.text, entityId: rec.entityId, entityType: 'INDIVIDUAL' };
    rec.audit.push({ timestamp: now, type: 'OTHER', description: 'Comment was added', functionName: 'AddComment', source: username || '', channel: 'API', userComment: { commentId: comment.commentId, text: comment.text } });
    save();
    return { comment };
  }
  const m = p.match(/^\/v2\/individuals\/(feed[0-9a-f-]+)(\/.*)?$/);
  const rec = m && db.records[m[1]];
  if (!rec) fail(404, 'Not found');
  const rest = m[2] || '';
  if (rest === '' && method === 'GET') return { individual: individual(rec), serviceProfiles: [{ serviceName: 'DEFAULT', state: rec.state, workflowSummaries: summaries(rec) }] };
  if (rest === '' && method === 'PATCH') {
    for (const r of body.individual?.externalReferences || []) addRef(rec.entityId, r);
    return { individual: individual(rec) };
  }
  if (rest.startsWith('/externalreferences/') && method === 'DELETE') { rec.refs = rec.refs.filter((r) => r.referenceId !== rest.split('/')[2]); save(); return {}; }
  if (rest === '/serviceprofiles/DEFAULT' && method === 'GET') {
    const s = summaries(rec);
    const latest = s.slice().sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
    return { serviceProfile: { state: rec.state, latestRiskAssessmentId: latest ? 'x' : null, workflowSummaries: s.map((w) => ({ ...w, riskAssessment: w.riskAssessment })) } };
  }
  const wf = rest.match(/^\/serviceprofiles\/DEFAULT\/workflows\/([^/]+)\/(executions|execute)$/);
  if (wf && method === 'GET') return { workflowResults: rec.runs.filter((r) => r.workflowName === decodeURIComponent(wf[1])).slice().reverse() };
  if (wf && method === 'POST') return { workflowResult: execute(rec.entityId, decodeURIComponent(wf[1])) };
  if (rest === '/documents' && method === 'GET') {
    const out = {};
    for (const d of rec.documents) (out[d.class] ||= []).push({ ...d, attachments: d.attachments.map(({ data, ...a }) => a) });
    return out;
  }
  if (rest === '/documents' && method === 'POST') {
    const d = { documentId: crypto.randomUUID(), entityId: rec.entityId, createdAt: now, country: 'AUS', ...body.document,
      attachments: (body.document.attachments || []).map((a) => ({ attachmentId: crypto.randomUUID(), createdAt: now, ...a })) };
    rec.documents.push(d);
    rec.audit.push({ timestamp: now, type: 'ENTITY_UPDATE', description: `Supporting document '${d.type}' added. Awaiting review.`, functionName: 'CreateDocuments', source: '', supplementaryData: { documentId: d.documentId, documentType: d.type } });
    save();
    return { document: { ...d, attachments: d.attachments.map(({ data, ...a }) => a) } };
  }
  const doc = rest.match(/^\/documents\/([0-9a-f-]+)$/);
  if (doc && method === 'GET') return rec.documents.find((d) => d.documentId === doc[1]) || fail(404, 'Not found');
  if (rest === '/results/duplicate' && method === 'PATCH') {
    rec.audit.push({ timestamp: now, type: 'ENTITY_UPDATE', description: 'Process result(s) have been updated', source: username || '', userComment: body.comment?.text ? { commentId: ulid(), text: body.comment.text } : undefined });
    if (body.manualStatus === 'TRUE_POSITIVE_REJECT') rec.state = 'DUPLICATE';
    if (body.manualStatus === 'FALSE_POSITIVE' && rec.state === 'DUPLICATE') rec.state = 'ACTIVE';
    save();
    return {};
  }
  fail(404, `The demo stand-in doesn't support ${method} ${p}`);
}
