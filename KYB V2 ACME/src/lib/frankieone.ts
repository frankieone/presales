import {
  FRANKIE_API_V2_BASE_URL,
  FRANKIE_CUSTOMER_ID,
  FRANKIE_API_KEY,
  FRANKIE_CUSTOMER_CHILD_ID,
  V2_ENDPOINTS,
} from './constants';

// ─── Shared Headers ────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': FRANKIE_CUSTOMER_ID,
    'api_key': FRANKIE_API_KEY,
  };
  if (FRANKIE_CUSTOMER_CHILD_ID) {
    headers['X-Frankie-CustomerChildID'] = FRANKIE_CUSTOMER_CHILD_ID;
  }
  return headers;
}

// ─── v2: Organization Lookup ───────────────────────────────────────
// Replaces v1 POST /business/international/search

export async function lookupOrganizations(
  country: string,
  name?: string,
  number?: string,
  registryCode?: string
) {
  const body: Record<string, unknown> = {
    region: { country },
  };
  if (name) body.organizationName = name;
  if (number) {
    body.organizationNumber = {
      registrationNumber: number,
      ...(registryCode ? { registryCode } : {}),
    };
  }

  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_LOOKUP}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Organization Profile ──────────────────────────────────────
// Replaces v1 POST /business/international/profile

export async function getOrganizationProfile(options: {
  organizationToken?: string;
  registrationNumber?: string;
  registryCode?: string;
  country: string;
  entityId?: string;
}) {
  const body: Record<string, unknown> = {};

  if (options.organizationToken) {
    body.organizationToken = options.organizationToken;
  }
  if (options.registrationNumber) {
    body.organizationRegistration = {
      organizationNumbers: [{
        registrationNumber: options.registrationNumber,
        ...(options.registryCode ? { registryCode: options.registryCode } : {}),
      }],
      region: { country: options.country },
    };
  }
  if (options.entityId) {
    body.entityId = options.entityId;
  }

  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_PROFILE}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Create Organization ───────────────────────────────────────

export async function createOrganization(organizationToken: string, serviceName?: string) {
  const body: Record<string, unknown> = { organizationToken };
  if (serviceName) body.serviceName = serviceName;

  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_CREATE}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Get Organization ──────────────────────────────────────────

export async function getOrganization(entityId: string) {
  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${entityId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function getOrganizationWithProfiles(entityId: string) {
  const res = await fetch(
    `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${entityId}?include=serviceProfiles`,
    { method: 'GET', headers: getHeaders() }
  );

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Update Organization ───────────────────────────────────────

export async function updateOrganization(entityId: string, organization: Record<string, unknown>, comment?: string) {
  const body: Record<string, unknown> = { organization };
  if (comment) {
    body.comment = { text: comment, entityId, entityType: 'ORGANIZATION' };
  }

  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${entityId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Get Workflows ────────────────────────────────────────────

export async function getWorkflows(serviceName?: string) {
  const url = new URL(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.WORKFLOWS}`);
  if (serviceName) url.searchParams.set('serviceName', serviceName);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Create Individual ─────────────────────────────────────────
// Replaces v1 POST /entity/new/verify/{checkType}/{resultLevel}
// In v2, creating an individual with a workflowName triggers the workflow automatically.

export async function createIndividual(
  individual: {
    givenName: string;
    middleName?: string;
    familyName: string;
    dateOfBirth?: string;
    address?: {
      streetAddress?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  },
  options?: {
    workflowName?: string;
    serviceName?: string;
  }
) {
  const individualPayload: Record<string, unknown> = {
    name: {
      givenName: individual.givenName,
      familyName: individual.familyName,
      ...(individual.middleName ? { middleName: individual.middleName } : {}),
    },
    consents: [
      { type: 'GENERAL', granted: true },
      { type: 'DOCS', granted: true },
      { type: 'CREDITHEADER', granted: true },
    ],
  };

  if (individual.dateOfBirth) {
    // v2 expects { year: "YYYY", month: "MM", day: "DD" } as strings
    const parts = individual.dateOfBirth.split('-');
    if (parts.length >= 3) {
      individualPayload.dateOfBirth = { year: parts[0], month: parts[1], day: parts[2] };
    } else if (parts.length === 2) {
      individualPayload.dateOfBirth = { year: parts[0], month: parts[1] };
    }
  }

  if (individual.address) {
    const addr: Record<string, string> = {};
    if (individual.address.streetAddress) addr.streetAddress = individual.address.streetAddress;
    if (individual.address.city) addr.town = individual.address.city;
    if (individual.address.state) addr.state = individual.address.state;
    if (individual.address.postalCode) addr.postalCode = individual.address.postalCode;
    if (individual.address.country) addr.country = individual.address.country;
    individualPayload.addresses = [addr];
  }

  const body: Record<string, unknown> = { individual: individualPayload };
  if (options?.workflowName) body.workflowName = options.workflowName;
  if (options?.serviceName) body.serviceName = options.serviceName;

  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.INDIVIDUALS_BASE}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Update Individual ────────────────────────────────────────

export async function updateIndividual(entityId: string, individual: Record<string, unknown>) {
  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.INDIVIDUALS_BASE}/${entityId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ individual }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Execute Individual Workflow ──────────────────────────────

export async function executeIndividualWorkflow(
  entityId: string,
  workflowName: string,
  serviceName = 'DEFAULT'
) {
  const encodedWorkflow = encodeURIComponent(workflowName);
  const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.INDIVIDUALS_BASE}/${entityId}/serviceprofiles/${serviceName}/workflows/${encodedWorkflow}/execute`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({}),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Get Individual ────────────────────────────────────────────

export async function getIndividual(entityId: string) {
  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.INDIVIDUALS_BASE}/${entityId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Delete Individual ─────────────────────────────────────────

export async function deleteIndividual(entityId: string) {
  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.INDIVIDUALS_BASE}/${entityId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  const data = await res.json().catch(() => null);
  return { data, status: res.status };
}

// ─── v2: Delete Organization ──────────────────────────────────────

export async function deleteOrganization(entityId: string) {
  const res = await fetch(`${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${entityId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  const data = await res.json().catch(() => null);
  return { data, status: res.status };
}

// ─── v2: Execute Organization Workflow ────────────────────────────
// Replaces v1 POST /business/ownership/query + polling.
// In v2, ownership/UBO discovery is handled by executing a KYB workflow.

export async function executeOrganizationWorkflow(options: {
  organizationToken?: string;
  entityId?: string;
  registrationNumber?: string;
  registrationType?: string;
  country?: string;
  workflowName: string;
  serviceName?: string;
}) {
  const body: Record<string, unknown> = {};
  const encodedWorkflow = encodeURIComponent(options.workflowName);

  if (options.serviceName) body.serviceName = options.serviceName;

  let res: Response;

  if (options.entityId) {
    // Execute on existing entity
    const service = options.serviceName || 'DEFAULT';
    const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${options.entityId}/serviceprofiles/${service}/workflows/${encodedWorkflow}/execute`;
    res = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  } else {
    // Execute with organization details (creates entity if needed)
    if (options.organizationToken) {
      body.organizationToken = options.organizationToken;
    } else if (options.registrationNumber) {
      body.organization = {
        details: {
          registrationDetails: [{
            number: options.registrationNumber,
            type: options.registrationType || 'ABN',
            country: options.country || 'AUS',
          }],
        },
      };
    }

    const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/workflows/${encodedWorkflow}/execute`;
    res = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  }

  const data = await res.json();

  // If async (202), poll for completion. Use serviceName from the response.
  if (res.status === 202 && data.entityId && data.workflowExecutionId) {
    const resolvedService = data.serviceName || options.serviceName || 'DEFAULT';
    return pollWorkflowExecution(data.entityId, resolvedService, options.workflowName, data.workflowExecutionId);
  }

  return { data, status: res.status };
}

async function getWorkflowExecutionResult(
  entityId: string,
  serviceName: string,
  workflowName: string,
  executionId: string
) {
  const encodedWorkflow = encodeURIComponent(workflowName);
  const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${entityId}/serviceprofiles/${serviceName}/workflows/${encodedWorkflow}/executions/${executionId}`;
  const res = await fetch(url, { method: 'GET', headers: getHeaders() });
  const data = await res.json();
  return { data, status: res.status };
}

async function pollWorkflowExecution(
  entityId: string,
  serviceName: string,
  workflowName: string,
  executionId: string,
  maxAttempts = 30,
  intervalMs = 5000
) {
  const orgUrl = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${entityId}`;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    // Poll the org to check workflow completion status
    const res = await fetch(orgUrl, { method: 'GET', headers: getHeaders() });

    if (res.status === 200) {
      const data = await res.json();
      const sp = data.serviceProfiles?.[0] || {};

      // Check if the workflow execution has completed
      const workflows = sp.workflowSummaries || [];
      const targetWorkflow = workflows.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (w: any) => w.workflowExecutionId === executionId || w.workflowName === workflowName
      );
      const wfState = targetWorkflow?.workflowExecutionState || '';
      const wfComplete = wfState && wfState !== 'IN_PROGRESS' && wfState !== 'PENDING';

      if (wfComplete) {
        // Workflow done — fetch the execution result endpoint which has full enrichment data
        console.log(`[Polling] Workflow completed (${wfState}), fetching execution result...`);
        const result = await getWorkflowExecutionResult(entityId, serviceName, workflowName, executionId);
        if (result.status === 200) {
          return result;
        }
        // Fallback to the org data if execution result fails
        console.log(`[Polling] Execution result fetch failed (${result.status}), using org data`);
        return { data, status: 200 };
      }

      console.log(`[Polling] Attempt ${i + 1}/${maxAttempts} — workflow state: ${wfState || 'unknown'}`);
    }
  }

  // Timed out — try the execution result endpoint anyway, then fall back to org
  console.log('[Polling] Timed out, attempting execution result fetch...');
  const result = await getWorkflowExecutionResult(entityId, serviceName, workflowName, executionId);
  if (result.status === 200) {
    return result;
  }
  const orgRes = await fetch(orgUrl, { method: 'GET', headers: getHeaders() });
  const orgData = await orgRes.json();
  return { data: orgData, status: orgRes.status };
}

// ─── v2: Organization Relationships ──────────────────────────────
// PUT /v2/organizations/{entityId}/relationships — add/update associates
// GET /v2/organizations/{entityId}/relationships — list associates
// DELETE /v2/organizations/{entityId}/relationships — remove associates

export interface EntityRelationship {
  entity: {
    entityId: string;
    entityType: 'INDIVIDUAL' | 'ORGANIZATION';
  };
  relationships: Array<{
    type: 'OFFICIAL';
    role: {
      code: string;
      description: string;
    };
  }>;
}

export async function addOrganizationRelationships(
  orgEntityId: string,
  entityRelationships: EntityRelationship[]
) {
  const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${orgEntityId}/relationships`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ entityRelationships }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function getOrganizationRelationships(orgEntityId: string) {
  const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${orgEntityId}/relationships`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function deleteOrganizationRelationships(
  orgEntityId: string,
  entityRelationships: EntityRelationship[]
) {
  const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${orgEntityId}/relationships`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ entityRelationships }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Generate Hosted Onboarding URL ──────────────────────────

export async function generateHostedOnboardingUrl(options: {
  entityId?: string;
  givenName: string;
  familyName: string;
  country?: string;
  flowId?: string;
  phoneNumber?: string;
  phoneCode?: string;
  sendSMS?: boolean;
}) {
  const url = `${FRANKIE_API_V2_BASE_URL}/v2/individuals/hostedUrl`;

  const body: Record<string, unknown> = {
    consent: true,
    oneSDKFlowId: options.flowId || 'idv',
  };

  if (options.entityId) {
    body.entityId = options.entityId;
  } else {
    body.customerRef = `${options.givenName}-${options.familyName}-${Date.now()}`;
  }

  if (options.phoneNumber) {
    body.phoneNumber = options.phoneNumber;
    body.phoneCode = options.phoneCode || '+61';
  }
  if (options.sendSMS) {
    body.sendSMS = true;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Document Upload ──────────────────────────────────────────
// Uses POST /v2/organizations/{entityId}/documents for org documents.

export async function uploadDocumentToEntity(
  entityId: string,
  file: { data: string; filename: string; mimeType: string },
  docType: string
) {
  const url = `${FRANKIE_API_V2_BASE_URL}${V2_ENDPOINTS.ORGANIZATIONS_BASE}/${entityId}/documents`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      document: {
        type: docType,
        class: 'SUPPORTING',
        country: 'AUS',
        attachments: [
          {
            data: { base64: file.data },
            filename: file.filename,
            mimeType: file.mimeType,
            side: 'FRONT',
          },
        ],
      },
    }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

// ─── v2: Trust Analysis (already v2) ──────────────────────────────

export async function triggerTrustAnalysis(entityId: string, documentId: string) {
  const url = `${FRANKIE_API_V2_BASE_URL}/v2/organizations/${entityId}/documents/${documentId}/analysis`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function getTrustAnalysisStatus(documentId: string) {
  const url = `${FRANKIE_API_V2_BASE_URL}/data/v2/business/trust-deeds/${documentId}/analyse`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function getTrustAnalysisResults(entityId: string, documentId: string) {
  const url = `${FRANKIE_API_V2_BASE_URL}/data/v2/business/trust-deeds/${entityId}/analysis-result/${documentId}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}
