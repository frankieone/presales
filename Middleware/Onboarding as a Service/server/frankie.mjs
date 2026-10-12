/**
 * The platform's FrankieOne client: the only code that holds the API key.
 * Intermediaries never reach it; every call here is made by the platform.
 * Each onboarding call names the intermediary in X-Frankie-Channel, so
 * FrankieOne's audit trail records which intermediary a verification was for.
 */
import { FRANKIE } from './config.mjs';

function headers(channel) {
  return {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': FRANKIE.customerId,
    api_key: FRANKIE.apiKey,
    ...(FRANKIE.customerChildId ? { 'X-Frankie-CustomerChildID': FRANKIE.customerChildId } : {}),
    ...(channel ? { 'X-Frankie-Channel': channel } : {}),
  };
}

async function call(method, path, body, channel) {
  const res = await fetch(`${FRANKIE.server}${path}`, {
    method,
    headers: headers(channel),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`FrankieOne ${method} ${path.split('?')[0]} returned ${res.status}`);
    err.status = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

const sp = FRANKIE.serviceName;

/** Scenario 1: a person new to the network. Create the record and run the workflow in one call. */
export const createAndVerify = (individual, workflow, channel) =>
  call('POST', `/v2/individuals/new/serviceprofiles/${sp}/workflows/${workflow}/execute`, { individual }, channel);

/** Scenario 2: run another intermediary's workflow on the record already held. */
export const verifyExisting = (entityId, workflow, channel) =>
  call('POST', `/v2/individuals/${entityId}/serviceprofiles/${sp}/workflows/${workflow}/execute`, {}, channel);

/** Create a record without running a workflow (the start-up checks use this). */
export const createIndividual = (individual) => call('POST', '/v2/individuals', { individual });

export const getIndividual = (entityId) => call('GET', `/v2/individuals/${entityId}`);

/** Add one intermediary's client reference to the shared record. */
export const addReference = (entityId, ref) =>
  call('PATCH', `/v2/individuals/${entityId}`, { individual: { externalReferences: [ref] } });

/** Remove one intermediary's relationship; the record and every other relationship stay. */
export const removeReference = (entityId, referenceId) =>
  call('DELETE', `/v2/individuals/${entityId}/externalreferences/${referenceId}`);

/**
 * Classify duplicate matches on a record. FALSE_POSITIVE: different people,
 * both stay. TRUE_POSITIVE_REJECT: same person, keep the existing record and
 * retire this one. Setting FALSE_POSITIVE on a confirmed match reverses it.
 */
export const resolveDuplicates = (entityId, processResultIds, manualStatus, text) =>
  call('PATCH', `/v2/individuals/${entityId}/results/duplicate`, { processResults: processResultIds, manualStatus, comment: { text } });

// ── businesses ──────────────────────────────────────────────────────
/** Create a business record. organizationType is free text: COMPANY, TRUST, PARTNERSHIP, OTHER. */
export const createOrganization = (organization) => call('POST', '/v2/organizations', { organization });

export const getOrganization = (entityId) => call('GET', `/v2/organizations/${entityId}`);

/** Add one intermediary's client reference to a business record already held. */
export const addOrganizationReference = (entityId, ref) =>
  call('PATCH', `/v2/organizations/${entityId}`, { organization: { externalReferences: [ref] } });

export const removeOrganizationReference = (entityId, referenceId) =>
  call('DELETE', `/v2/organizations/${entityId}/externalreferences/${referenceId}`);

/** Link a person to a business with their role (director, trustee, partner, owner). */
export const linkPerson = (organizationId, individualId, role) =>
  call('PUT', `/v2/organizations/${organizationId}/relationships`, {
    entityRelationships: [{ entity: { entityId: individualId, entityType: 'INDIVIDUAL' }, relationships: [{ type: 'OFFICIAL', role }] }],
  });

/** Start a business registry check (asynchronous: returns a workflow execution ID). */
export const checkRegistry = (organizationId, workflow, channel) =>
  call('POST', `/v2/organizations/${organizationId}/serviceprofiles/${sp}/workflows/${workflow}/execute`, {}, channel);

export const getRegistryCheck = (organizationId, workflow, executionId) =>
  call('GET', `/v2/organizations/${organizationId}/serviceprofiles/${sp}/workflows/${workflow}/executions/${executionId}`);

export const listWorkflows = () => call('GET', '/v2/workflows');

// ── the client file: history, risk, workflows, documents ────────────
const base = (entityType) => (entityType === 'ORGANIZATION' ? 'organizations' : 'individuals');

/** Every audit event on a record, newest first: checks, status and risk changes, operator actions. */
export async function listAudit(entityId) {
  const events = [];
  for (let page = 1; page <= 5; page++) {
    const r = await call('GET', `/v2/audit?entityId=${entityId}&limit=100&page=${page}`);
    events.push(...(r.events || []));
    if (events.length >= (r.meta?.total || 0) || !(r.events || []).length) break;
  }
  return events;
}

/** The service profile: current state, latest risk assessment and a summary of every workflow run. */
export const getServiceProfile = (entityId, entityType) => call('GET', `/v2/${base(entityType)}/${entityId}/serviceprofiles/${sp}`);

/** Every run of one workflow on a record, with step results. */
export const listExecutions = (entityId, workflow, entityType) =>
  call('GET', `/v2/${base(entityType)}/${entityId}/serviceprofiles/${sp}/workflows/${workflow}/executions`);

/** Documents held against a record, by class, with attachment metadata. */
export const listDocuments = (entityId, entityType) => call('GET', `/v2/${base(entityType)}/${entityId}/documents?level=meta`);

/** One document, with its attachments' data (photos, scans) in base64. */
export const getDocumentData = (entityId, documentId, entityType) =>
  call('GET', `/v2/${base(entityType)}/${entityId}/documents/${documentId}?level=base64`);

/** Attach a standalone document (and its file) to a record. */
export const addDocument = (entityId, document, entityType, channel) =>
  call('POST', `/v2/${base(entityType)}/${entityId}/documents?level=meta`, { document }, channel);

/** A one-time link for the person to photograph their ID and take a selfie on their phone (hosted OneSDK). */
export const hostedIdvUrl = (entityId, flowId) =>
  call('POST', '/v2/individuals/hostedUrl', { entityId, consent: true, oneSDKFlowId: flowId, sendSMS: false });
