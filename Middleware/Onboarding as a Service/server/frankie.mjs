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

export const listWorkflows = () => call('GET', '/v2/workflows');
