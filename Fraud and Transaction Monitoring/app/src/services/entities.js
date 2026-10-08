/**
 * FrankieOne V2 — the entities behind each demo, built from the top down:
 *
 *     CONTAINER (a fund as TRUST, or a business as COMPANY)
 *       ├── primary contact          INDIVIDUAL → Primary Contact
 *       ├── related person           INDIVIDUAL → Trustee / Director
 *       └── corporate trustee        ORGANIZATION → Corporate Trustee (SMSF)
 *
 * POST /v2/organizations needs only `details` and `addresses`, so a container
 * can be created before it has a name or a registration number, and renamed
 * later. Relationships accept ORGANIZATION as well as INDIVIDUAL.
 */

import { getEnvCredentials } from './api';

const proxy = (path) => `/api-proxy${path}`;

function headers() {
  const c = getEnvCredentials();
  const h = {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': c.customerId,
    api_key: c.apiKey,
  };
  if (c.customerChildId) h['X-Frankie-CustomerChildID'] = c.customerChildId;
  return h;
}

async function call(method, path, body) {
  const res = await fetch(proxy(path), {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    // The v2 validation errors are nested and genuinely useful — surface the
    // first one rather than a bare status, or debugging a 400 is guesswork.
    const issue =
      data?.details?.[0]?.issue || data?.errorMsg || data?.message || `HTTP ${res.status}`;
    const err = new Error(issue);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// ─── address helper ───────────────────────────────────────────────
// At least one address is mandatory on create, and its type must come from the
// accepted list — REGISTERED_OFFICE is the safe default for both a fund and a
// trustee company.

function orgAddress(a = {}) {
  return [
    {
      type: 'REGISTERED_OFFICE',
      country: a.country || 'AUS',
      ...(a.unitNumber ? { unitNumber: a.unitNumber } : {}),
      ...(a.streetNumber ? { streetNumber: a.streetNumber } : {}),
      ...(a.streetName ? { streetName: a.streetName } : {}),
      ...(a.streetType ? { streetType: a.streetType } : {}),
      ...(a.locality ? { locality: a.locality } : {}),
      ...(a.state ? { subdivision: a.state } : {}),
      ...(a.postalCode ? { postalCode: a.postalCode } : {}),
    },
  ];
}

// ─── create ───────────────────────────────────────────────────────

/**
 * Create an organization manually — no registry lookup involved.
 *
 * `registrations` is a list of { number, type } where type is ABN or ACN.
 * Pass only an ABN for an SMSF; pass both for a trustee company. Passing none
 * is also accepted by the API, which is the fallback for a fund whose ABN has
 * not been issued yet.
 */
export async function createOrganization({
  name,
  organizationType = 'TRUST',
  registrations = [],
  address,
  customerReference,
}) {
  const details = {
    name: { name },
    organizationType,
    region: { country: 'AUS' },
  };

  const regs = registrations.filter((r) => r && r.number);
  if (regs.length) {
    details.registrationDetails = regs.map((r) => ({
      number: String(r.number).replace(/\s/g, ''),
      type: r.type,
      country: 'AUS',
    }));
  }

  const organization = { addresses: orgAddress(address), details };
  // `type` must be one of SYSTEM, CUSTOMER, ACCOUNT, OTHER — anything else is
  // a 400. `name` says which of the customer's identifiers this is.
  if (customerReference) {
    organization.externalReferences = [{ type: 'CUSTOMER', name: 'APPLICATION_ID', value: customerReference }];
  }

  const data = await call('POST', '/v2/organizations', { organization });
  return data?.organization?.entityId || data?.entityId;
}

/**
 * Give a fund its name once the application supplies one. The container is
 * created at website registration, before the fund has a name, and keeps its
 * entity ID and application ID through the rename.
 */
export async function renameOrganization(entityId, name) {
  return call('PATCH', `/v2/organizations/${entityId}`, {
    organization: { details: { name: { name } } },
  });
}

export async function createPerson({ givenName, middleName, familyName, dateOfBirth, address, email, phone }) {
  const individual = {
    name: {
      givenName,
      familyName,
      ...(middleName ? { middleName } : {}),
    },
    consents: [
      { type: 'GENERAL', granted: true },
      { type: 'DOCS', granted: true },
    ],
  };

  if (dateOfBirth) {
    const [year, month, day] = dateOfBirth.split('-');
    if (year && month && day) individual.dateOfBirth = { year, month, day };
  }

  if (address?.streetName) {
    individual.addresses = [
      {
        type: 'RESIDENTIAL',
        country: address.country || 'AUS',
        ...(address.unitNumber ? { unitNumber: address.unitNumber } : {}),
        streetNumber: address.streetNumber,
        streetName: address.streetName,
        streetType: address.streetType,
        locality: address.locality,
        subdivision: address.state,
        postalCode: address.postalCode,
      },
    ];
  }

  // Typed and preferred, with the phone's country, exactly as the sign-up
  // applicant is created. A bare { email } is stored as type OTHER and a phone
  // without a country cannot be normalised.
  if (email) individual.emailAddresses = [{ email, type: 'PERSONAL', isPreferred: true }];
  // The field is `number`, not `phoneNumber`. Sending `phoneNumber` is accepted
  // with a 201 and the digits are silently discarded — the entity ends up with a
  // phoneNumberId and a type but no number, so nothing downstream (including
  // every Sardine phone rule) has anything to evaluate.
  if (phone) individual.phoneNumbers = [{ number: phone, type: 'MOBILE', country: 'AUS', isPreferred: true }];

  const data = await call('POST', '/v2/individuals', { individual });
  return data?.individual?.entityId || data?.entityId;
}

// ─── link ─────────────────────────────────────────────────────────

/**
 * Attach an entity to a parent organization. `entityType` is INDIVIDUAL or
 * ORGANIZATION — the latter is how the corporate trustee hangs off the fund.
 *
 * This is additive: calling it again for a different entity does not displace
 * the ones already linked.
 */
export async function linkToOrganization(parentId, { entityId, entityType, role }) {
  return call('PUT', `/v2/organizations/${parentId}/relationships`, {
    entityRelationships: [
      {
        entity: { entityId, entityType },
        relationships: [{ type: 'OFFICIAL', role }],
      },
    ],
  });
}

/** Fill in a placeholder member once their details come back. */
export async function updatePerson(entityId, { dateOfBirth, address, email, phone, middleName }) {
  const individual = {};

  if (dateOfBirth) {
    const [year, month, day] = dateOfBirth.split('-');
    if (year && month && day) individual.dateOfBirth = { year, month, day };
  }
  if (middleName) individual.name = { middleName };
  if (email) individual.emailAddresses = [{ email, type: 'PERSONAL', isPreferred: true }];
  // The field is `number`, not `phoneNumber`. Sending `phoneNumber` is accepted
  // with a 201 and the digits are silently discarded — the entity ends up with a
  // phoneNumberId and a type but no number, so nothing downstream (including
  // every Sardine phone rule) has anything to evaluate.
  if (phone) individual.phoneNumbers = [{ number: phone, type: 'MOBILE', country: 'AUS', isPreferred: true }];
  if (address?.streetName) {
    individual.addresses = [{
      type: 'RESIDENTIAL',
      country: address.country || 'AUS',
      streetNumber: address.streetNumber,
      streetName: address.streetName,
      streetType: address.streetType,
      locality: address.locality,
      subdivision: address.state,
      postalCode: address.postalCode,
    }];
  }

  if (!Object.keys(individual).length) return null;
  return call('PATCH', `/v2/individuals/${entityId}`, { individual });
}

/**
 * A member is only checkable once they have a date of birth — identity matching
 * has nothing to work with before that. This is what separates a placeholder
 * from a complete record.
 */
export function isComplete(person) {
  return Boolean(person?.dateOfBirth);
}

// ─── read ─────────────────────────────────────────────────────────

/**
 * Relationships that were added manually. Note this is deliberately the right
 * endpoint here: it returns what we linked ourselves, where a registry-lookup
 * flow would instead find its people on the organization record itself.
 */
export async function getRelationships(organizationId) {
  const data = await call('GET', `/v2/organizations/${organizationId}/relationships`);
  return (data?.entityRelationships || []).map((e) => ({
    entityId: e.entity?.entityId,
    entityType: e.entity?.entityType,
    roles: (e.relationships || [])
      .map((r) => r.role?.description || r.role?.code || r.type)
      .filter(Boolean),
  }));
}

export async function getOrganization(entityId) {
  const data = await call('GET', `/v2/organizations/${entityId}`);
  const org = data?.organization || {};
  return {
    entityId,
    name: org.details?.name?.name || org.name?.name || '(unnamed)',
    organizationType: org.details?.organizationType || null,
    registrations: (org.details?.registrationDetails || []).map((r) => ({
      type: r.type,
      number: r.registrationNumber || r.number,
    })),
    serviceProfiles: data?.serviceProfiles || [],
  };
}

export async function getPerson(entityId) {
  const data = await call('GET', `/v2/individuals/${entityId}`);
  const ind = data?.individual || {};
  const dob = ind.dateOfBirth || {};
  return {
    entityId,
    name:
      ind.name?.displayName ||
      [ind.name?.givenName, ind.name?.familyName].filter(Boolean).join(' ') ||
      '(unnamed)',
    dateOfBirth: dob.normalized || (dob.year ? `${dob.year}-${dob.month}-${dob.day}` : null),
    serviceProfiles: data?.serviceProfiles || [],
  };
}

/**
 * Walk the fund down into a tree. Depth-limited and cycle-guarded: a person can
 * legitimately appear under both the fund and the trustee company, and without
 * a visited set a mutual link would recurse forever.
 */
export async function loadStructure(fundId, depth = 2) {
  const visited = new Set();

  async function node(entityId, entityType, roles, level) {
    const key = `${entityType}:${entityId}`;
    const seen = visited.has(key);
    visited.add(key);

    if (entityType === 'INDIVIDUAL') {
      const p = await getPerson(entityId).catch(() => ({ entityId, name: '(unavailable)' }));
      return { ...p, entityType, roles, children: [] };
    }

    const o = await getOrganization(entityId).catch(() => ({ entityId, name: '(unavailable)' }));
    if (seen || level >= depth) return { ...o, entityType, roles, children: [] };

    const rels = await getRelationships(entityId).catch(() => []);
    const children = [];
    for (const r of rels) {
      children.push(await node(r.entityId, r.entityType, r.roles, level + 1));
    }
    return { ...o, entityType, roles, children };
  }

  return node(fundId, 'ORGANIZATION', ['Fund'], 0);
}

// ─── checks ───────────────────────────────────────────────────────

const WORKFLOW = {
  INDIVIDUAL: import.meta.env.VITE_KYC_WORKFLOW || 'AUS-Basic2V-TwoPlus',
  ORGANIZATION: import.meta.env.VITE_KYB_WORKFLOW || 'GLB-Organization-Ownership',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run the appropriate workflow for an entity and wait for a terminal state. */
export async function runChecks(entityId, entityType, { tries = 45, intervalMs = 2000 } = {}) {
  const base = entityType === 'INDIVIDUAL' ? 'individuals' : 'organizations';
  const workflow = WORKFLOW[entityType];
  const wf = encodeURIComponent(workflow);

  const started = await call('POST', `/v2/${base}/${entityId}/serviceprofiles/DEFAULT/workflows/${wf}/execute`, {});

  // 200 means it finished inline; 202 means poll. The execution-result body
  // carries no entityId, so hold on to the one we already have.
  let result = started;
  if (started?.workflowExecutionId) {
    const service = started.serviceName || 'DEFAULT';
    for (let i = 0; i < tries; i++) {
      await sleep(intervalMs);
      const poll = await call(
        'GET',
        `/v2/${base}/${entityId}/serviceprofiles/${service}/workflows/${wf}/executions/${started.workflowExecutionId}`,
      ).catch(() => null);
      if (!poll) continue;
      result = poll;
      const state = (poll.workflowResult?.status || poll.workflowResult?.result || '').toUpperCase();
      if (state && !['IN_PROGRESS', 'PENDING', 'RUNNING', 'QUEUED'].includes(state)) break;
    }
  }

  return summariseChecks(result, workflow);
}

/**
 * Flatten a workflow result into something displayable.
 *
 * The overall verdict is reported but should not be read as the headline: the
 * standard individual workflow also runs IDV, which needs a verified identity
 * document. Nobody entered through a manual structure build has one, so the
 * overall result is FAIL even when the identity itself matched. The per-step
 * breakdown is what actually carries the signal.
 */
export function summariseChecks(data, workflowName) {
  const wr = data?.workflowResult || {};
  const profile = data?.serviceProfile || data?.serviceProfiles?.[0] || {};
  const summary = profile.workflowSummaries?.[0] || {};
  const steps = wr.steps || summary.steps || {};
  const risk = wr.riskAssessment || summary.riskAssessment || {};

  const passed = steps.passed || [];
  const failed = steps.failed || [];
  const incomplete = steps.incomplete || [];

  const stepState = (name) =>
    passed.includes(name) ? 'PASS' : failed.includes(name) ? 'FAIL' : incomplete.includes(name) ? 'INCOMPLETE' : null;

  return {
    workflowName,
    overall: (wr.result || wr.status || summary.status || 'UNKNOWN').toUpperCase(),
    riskLevel: risk.riskLevel || risk.workflowRiskLevel || null,
    riskScore: risk.riskScore ?? null,
    kyc: stepState('KYC'),
    idv: stepState('IDV'),
    aml: stepState('AML'),
    matchlist: stepState('MATCHLIST'),
    device: stepState('DEVICE') || stepState('FRAUD'),
    steps: { passed, failed, incomplete },
    issues: (wr.issues || summary.issues || []).map((i) => ({
      category: i.category,
      issue: i.issue,
      severity: i.severity,
    })),
  };
}

/* ── onboarding fraud checks ──────────────────────────────────────
 * A different product from the activity monitoring in monitoring.js, and a
 * different place in the Portal. This is the onboarding-fraud path: it runs as
 * a workflow FRAUD step and produces named issues such as FRAUD_PHONE_NUMBER,
 * which appear on the entity's profile. The /v2/activities route instead
 * produces ACTIVITY_FRAUD alerts under transaction monitoring.
 */

// Primary includes the device step, which needs a device payload from the
// OneSDK listener. Without one the step errors with BAD_DATA_DEVICE and the
// whole execute returns 500 — so there is a fallback that checks email and
// phone only and is known to return a result reliably.
const FRAUD_WORKFLOW = import.meta.env.VITE_FRAUD_WORKFLOW || 'Device-Email-Phone-NoAML';
const FRAUD_WORKFLOW_FALLBACK =
  import.meta.env.VITE_FRAUD_WORKFLOW_FALLBACK || 'AUS-Basic1V-TwoPlus-Email-Phone-NoAML';

// Members added by the primary contact: the fraud step on email and phone only
// — no device, no KYC — so a flagged member is stopped before any identity
// check is run on them.
const CONTACT_WORKFLOW = import.meta.env.VITE_CONTACT_WORKFLOW || 'Email-Phone-NoAML';

async function executeAndPoll(entityId, workflowName, { tries = 25, intervalMs = 2000 } = {}) {
  const wf = encodeURIComponent(workflowName);
  const started = await call(
    'POST',
    `/v2/individuals/${entityId}/serviceprofiles/DEFAULT/workflows/${wf}/execute`,
    {},
  );

  let result = started;
  if (started?.workflowExecutionId) {
    const service = started.serviceName || 'DEFAULT';
    for (let i = 0; i < tries; i++) {
      await sleep(intervalMs);
      const poll = await call(
        'GET',
        `/v2/individuals/${entityId}/serviceprofiles/${service}/workflows/${wf}/executions/${started.workflowExecutionId}`,
      ).catch(() => null);
      if (!poll) continue;
      result = poll;
      const state = (poll.workflowResult?.status || poll.workflowResult?.result || '').toUpperCase();
      if (state && !['IN_PROGRESS', 'PENDING', 'RUNNING', 'QUEUED'].includes(state)) break;
    }
  }
  return result;
}

function summariseFraud(data, workflowName, usedFallback) {
  const wr = data?.workflowResult || {};
  const risk = wr.riskAssessment || {};
  const issues = (wr.issues || []).map((i) => ({
    category: i.category,
    issue: i.issue,
    severity: i.severity,
  }));
  // Where the device was, per the FRAUD_IP_ADDRESS result — what the member
  // verification page gates on. Null when the run had no device session.
  const fraudStep = (wr.workflowStepResults || []).find((s) => s.stepName === 'FRAUD');
  const ipInfo = fraudStep?.processResults
    ?.find((p) => p.supplementaryData?.type === 'FRAUD_IP_ADDRESS')
    ?.supplementaryData?.ipAddressInformation;
  return {
    workflowName,
    usedFallback,
    ipCountry: ipInfo?.location?.country || null,
    // Each signal's own risk level (email, phone, device, IP), so one high
    // signal counts even if the overall result does not move.
    signalRisks: (fraudStep?.processResults || [])
      .map((p) => (p.supplementaryData?.riskLevel || '').toUpperCase())
      .filter(Boolean),
    status: (wr.result || wr.status || 'UNKNOWN').toUpperCase(),
    riskLevel: risk.riskLevel || null,
    riskScore: risk.riskScore ?? null,
    steps: wr.steps || {},
    issues,
    // The issues worth showing a reviewer: fraud findings and a risk threshold
    // breach, as opposed to data-quality errors from a missing device payload.
    fraudIssues: issues.filter((i) => i.category === 'FRAUD' || i.category === 'RISK'),
  };
}

/**
 * Whether a fraud result should stop someone going on to identity checks: a
 * FRAUD issue or any signal rated high. Deliberately not the overall status,
 * so that only a fraud signal — never a data-quality issue — holds someone.
 */
export function isFraudFlagged(summary) {
  if (!summary) return false;
  const high = (r) => ['HIGH', 'VERY_HIGH', 'UNACCEPTABLE'].includes(r);
  return (
    summary.fraudIssues.some((i) => i.category === 'FRAUD') ||
    (summary.signalRisks || []).some(high)
  );
}

/**
 * Email and phone checks on details someone else entered — a member added by
 * the primary contact. No device: the device at the keyboard is the primary
 * contact's, already checked on their own runs.
 *
 * In testing, phone rules fired reliably this way, and not when a member was
 * checked under a device session created from the primary contact's browser.
 */
export async function runContactChecks(entityId) {
  const data = await executeAndPoll(entityId, CONTACT_WORKFLOW);
  return summariseFraud(data, CONTACT_WORKFLOW, false);
}

/**
 * Run the onboarding fraud checks on an individual's own details.
 *
 * Tries the device workflow first and falls back to email+phone if it fails —
 * a missing device payload returns 500 rather than a degraded result, and a
 * member being added should not break because of that.
 */
export async function runFraudChecks(entityId) {
  try {
    const data = await executeAndPoll(entityId, FRAUD_WORKFLOW);
    const summary = summariseFraud(data, FRAUD_WORKFLOW, false);
    // A device-data error means the run told us nothing — fall through.
    const deviceBad = summary.issues.some((i) => i.issue === 'BAD_DATA_DEVICE');
    if (!deviceBad) return summary;
    console.warn('[fraud] device data unusable, falling back to email + phone');
  } catch (err) {
    console.warn(`[fraud] ${FRAUD_WORKFLOW} failed (${err.message}) — falling back`);
  }

  const data = await executeAndPoll(entityId, FRAUD_WORKFLOW_FALLBACK);
  return summariseFraud(data, FRAUD_WORKFLOW_FALLBACK, true);
}

/** Read existing check results off an entity without re-running anything. */
export async function loadChecks(entityId, entityType) {
  const base = entityType === 'INDIVIDUAL' ? 'individuals' : 'organizations';
  const data = await call('GET', `/v2/${base}/${entityId}`).catch(() => null);
  if (!data) return null;
  const profile = data.serviceProfiles?.[0];
  if (!profile?.workflowSummaries?.length) return null;
  return summariseChecks({ serviceProfiles: data.serviceProfiles }, profile.workflowSummaries[0].workflowName);
}
