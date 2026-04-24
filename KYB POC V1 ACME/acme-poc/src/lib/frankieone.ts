import { FRANKIE_API_BASE_URL, FRANKIE_API_V2_BASE_URL, FRANKIE_API_EXPERIMENTAL_BASE_URL, FRANKIE_CUSTOMER_ID, FRANKIE_API_KEY, FRANKIE_CUSTOMER_CHILD_ID, ENDPOINTS, DEFAULT_CHECK_TYPE, DEFAULT_RESULT_LEVEL, DEFAULT_ENTITY_PROFILE, KYC_CONSENT_EXTRA_DATA } from './constants';

export async function createOrganizationDocument(
  entityId: string,
  file: { data: string; filename: string; mimeType: string },
  docType: string,
  country: string = 'AUS'
) {
  const url = `${FRANKIE_API_V2_BASE_URL}/v2/organizations/${entityId}/documents`;
  console.log('[OrgDocCreate] POST', url, 'type:', docType, 'country:', country);

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      document: {
        type: docType,
        country,
        class: 'SUPPORTING',
        attachments: [
          {
            data: `data:${file.mimeType};base64,${file.data}`,
            filename: file.filename,
            mimeType: file.mimeType,
            side: 'F',
            type: 'SCAN',
          },
        ],
      },
    }),
  });

  const data = await res.json();
  console.log('[OrgDocCreate] Response:', res.status, JSON.stringify(data).slice(0, 500));
  return { data, status: res.status };
}

export async function uploadDocumentToEntity(
  entityId: string,
  file: { data: string; filename: string; mimeType: string },
  docType: string,
  country: string = 'AUS'
) {
  const scanType = file.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE';

  // Map docType to a human-readable label for the portal
  const docLabels: Record<string, string> = {
    TRUST_DEED: 'Trust Deed',
    DEED_OF_VARIATION: 'Deed of Variation',
    REGISTER_OF_UNIT_HOLDERS: 'Register of Unit Holders',
    PARTNERSHIP_AGREEMENT: 'Partnership Agreement',
    ATTESTATION: 'Attestation',
    UTILITY_BILL: 'Utility Bill',
    BANK_STATEMENT: 'Bank Statement',
  };

  const url = `${FRANKIE_API_BASE_URL}${ENDPOINTS.ENTITY_BASE}/${entityId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      entityId,
      entityType: 'ORGANISATION',
      identityDocs: [
        {
          idType: docType,
          country,
          extraData: [
            {
              kvpKey: 'supporting_docs.label',
              kvpValue: docLabels[docType] || docType,
            },
            {
              kvpKey: 'supporting_docs.status',
              kvpValue: 'Needs Review',
            },
          ],
          docScan: [
            {
              scanData: file.data,
              scanFilename: file.filename,
              scanMIME: file.mimeType,
              scanSide: 'F',
              scanType,
            },
          ],
        },
      ],
    }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

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

async function getBackendToken(): Promise<string> {
  const backendUrl = FRANKIE_API_BASE_URL.replace(/\/compliance\/v1\.2\/?$/, '').replace('api.kycaml', 'backend.kycaml');
  const credentials = Buffer.from(`${FRANKIE_CUSTOMER_ID}:${FRANKIE_API_KEY}`).toString('base64');

  const res = await fetch(`${backendUrl}/auth/v2/machine-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': `machine ${credentials}`,
    },
    body: JSON.stringify({ permissions: { preset: 'smart-ui' } }),
  });

  const data = await res.json();
  return data.token;
}

export async function searchAustralianBusiness(search: string) {
  const backendUrl = FRANKIE_API_BASE_URL.replace(/\/compliance\/v1\.2\/?$/, '').replace('api.kycaml', 'backend.kycaml');
  const token = await getBackendToken();
  const url = `${backendUrl}/data/v2/businesses?search=${encodeURIComponent(search)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'authorization': token },
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function searchBusiness(country: string, name?: string, number?: string) {
  const body: Record<string, unknown> = { country };
  if (name) body.organisation_name = name;
  if (number) body.organisation_number = number;

  const res = await fetch(`${FRANKIE_API_BASE_URL}${ENDPOINTS.BUSINESS_SEARCH}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function getBusinessProfile(country: string, companyCode: string, registrationAuthorityCode?: string) {
  const body: Record<string, unknown> = {
    country,
    company_code: companyCode,
  };
  if (registrationAuthorityCode) {
    body.registration_authority_code = registrationAuthorityCode;
  }

  const res = await fetch(`${FRANKIE_API_BASE_URL}${ENDPOINTS.BUSINESS_PROFILE}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function queryAustralianOwnership(acn?: string, abn?: string, companyName?: string) {
  const organisation: Record<string, unknown> = {
    entityType: 'ORGANISATION',
    extraData: [] as Array<{ kvpKey: string; kvpType: string; kvpValue: string }>,
  };

  if (acn) {
    (organisation.extraData as Array<{ kvpKey: string; kvpType: string; kvpValue: string }>).push({
      kvpKey: 'ACN',
      kvpType: 'id.external',
      kvpValue: acn,
    });
  }
  if (abn) {
    (organisation.extraData as Array<{ kvpKey: string; kvpType: string; kvpValue: string }>).push({
      kvpKey: 'ABN',
      kvpType: 'id.external',
      kvpValue: abn,
    });
  }
  if (companyName) {
    organisation.name = { displayName: companyName };
  }

  const url = new URL(`${FRANKIE_API_BASE_URL}${ENDPOINTS.BUSINESS_OWNERSHIP}`);
  url.searchParams.set('ownershipMode', 'full');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ organisation }),
  });

  const data = await res.json();

  // If 202 (async), poll the retrieve endpoint
  if (res.status === 202 && data.requestId) {
    return pollForResult(data.requestId);
  }

  return { data, status: res.status };
}

async function pollForResult(requestId: string, maxAttempts = 20, intervalMs = 3000) {
  const retrieveUrl = `${FRANKIE_API_BASE_URL}/retrieve/response/${requestId}`;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const res = await fetch(retrieveUrl, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (res.status === 200) {
      const raw = await res.json();
      let payload = raw.payload || raw;
      // The retrieve endpoint returns payload as a JSON string
      if (typeof payload === 'string') {
        payload = JSON.parse(payload);
      }
      return { data: payload, status: raw.origHTTPstatus || 200 };
    }

    // 404 means not ready yet, keep polling
    if (res.status !== 404) {
      const data = await res.json();
      return { data, status: res.status };
    }
  }

  return { data: { errorMsg: 'Ownership query timed out. Please try again.' }, status: 408 };
}

export async function verifyEntity(entity: {
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
}) {
  const checkType = DEFAULT_CHECK_TYPE;
  const resultLevel = DEFAULT_RESULT_LEVEL;

  const frankieEntity: Record<string, unknown> = {
    entityType: 'INDIVIDUAL',
    entityProfile: DEFAULT_ENTITY_PROFILE,
    name: {
      givenName: entity.givenName,
      familyName: entity.familyName,
      ...(entity.middleName ? { middleName: entity.middleName } : {}),
    },
    extraData: [...KYC_CONSENT_EXTRA_DATA],
  };

  if (entity.dateOfBirth) {
    frankieEntity.dateOfBirth = {
      dateOfBirth: entity.dateOfBirth,
    };
  }

  if (entity.address) {
    const addr: Record<string, string> = {};
    if (entity.address.streetAddress) addr.streetName = entity.address.streetAddress;
    if (entity.address.city) addr.town = entity.address.city;
    if (entity.address.state) addr.state = entity.address.state;
    if (entity.address.postalCode) addr.postalCode = entity.address.postalCode;
    if (entity.address.country) addr.country = entity.address.country;

    frankieEntity.addresses = [addr];
  }

  const url = `${FRANKIE_API_BASE_URL}${ENDPOINTS.ENTITY_VERIFY}/${checkType}/${resultLevel}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ entity: frankieEntity }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function verifyExistingEntity(entityId: string) {
  const checkType = DEFAULT_CHECK_TYPE;
  const resultLevel = DEFAULT_RESULT_LEVEL;

  const url = `${FRANKIE_API_BASE_URL}${ENDPOINTS.ENTITY_VERIFY_EXISTING}/${entityId}/verify/${checkType}/${resultLevel}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      entity: {
        entityId,
        entityType: 'INDIVIDUAL',
        entityProfile: DEFAULT_ENTITY_PROFILE,
        extraData: [...KYC_CONSENT_EXTRA_DATA],
      },
    }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function updateEntity(entityId: string, entity: {
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
}) {
  const frankieEntity: Record<string, unknown> = {
    entityId,
    entityType: 'INDIVIDUAL',
    name: {
      givenName: entity.givenName,
      familyName: entity.familyName,
      ...(entity.middleName ? { middleName: entity.middleName } : {}),
    },
  };

  if (entity.dateOfBirth) {
    frankieEntity.dateOfBirth = { dateOfBirth: entity.dateOfBirth };
  }

  if (entity.address) {
    const addr: Record<string, string> = {};
    if (entity.address.streetAddress) addr.streetName = entity.address.streetAddress;
    if (entity.address.city) addr.town = entity.address.city;
    if (entity.address.state) addr.state = entity.address.state;
    if (entity.address.postalCode) addr.postalCode = entity.address.postalCode;
    if (entity.address.country) addr.country = entity.address.country;
    frankieEntity.addresses = [addr];
  }

  // POST /entity/{entityId}/evaluate — updates entity data without running new checks
  const url = `${FRANKIE_API_BASE_URL}/entity/${entityId}/evaluate`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ entity: frankieEntity }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

async function getExperimentalToken(): Promise<string> {
  // Derive the auth URL from the experimental base URL's host
  const expBase = FRANKIE_API_EXPERIMENTAL_BASE_URL.replace(/\/experimental\/?$/, '');
  const backendUrl = expBase.replace('api.kycaml', 'backend.kycaml');
  const credentials = Buffer.from(`${FRANKIE_CUSTOMER_ID}:${FRANKIE_API_KEY}`).toString('base64');

  console.log('[ExperimentalAuth] POST', `${backendUrl}/auth/v2/machine-session`);

  const res = await fetch(`${backendUrl}/auth/v2/machine-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': `machine ${credentials}`,
    },
    body: JSON.stringify({ permissions: { preset: 'smart-ui' } }),
  });

  const data = await res.json();
  console.log('[ExperimentalAuth] Response:', res.status);
  return data.token;
}

async function getExperimentalHeaders(): Promise<Record<string, string>> {
  const token = await getExperimentalToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'authorization': `bearer ${token}`,
  };
  if (FRANKIE_CUSTOMER_CHILD_ID) {
    headers['X-Frankie-CustomerChildID'] = FRANKIE_CUSTOMER_CHILD_ID;
  }
  return headers;
}

export async function triggerTrustAnalysis(entityId: string, documentId: string) {
  const url = `${FRANKIE_API_EXPERIMENTAL_BASE_URL}/v2/organizations/documents/analyze`;
  console.log('[TrustAnalyzer] Trigger URL:', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      entityId,
      documentId,
      analysisType: 'TRUST_DOCUMENT',
    }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function confirmTrustAnalysis(entityId: string, documentId: string, analysisId: string, documentInformation: unknown) {
  const url = `${FRANKIE_API_EXPERIMENTAL_BASE_URL}/v2/organizations/${entityId}/documents/${documentId}/analyses/${analysisId}/confirm`;
  console.log('[TrustAnalyzer] Confirm URL:', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(documentInformation),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function getTrustAnalysisResults(entityId: string, documentId: string) {
  const url = `${FRANKIE_API_EXPERIMENTAL_BASE_URL}/v2/organizations/${entityId}/documents/${documentId}/analyses?showResults=LATEST`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function addUboToOrganisation(orgEntityId: string, individual: {
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
  shareholdingPercentage?: string;
}) {
  const entity: Record<string, unknown> = {
    entityType: 'INDIVIDUAL',
    name: {
      givenName: individual.givenName,
      familyName: individual.familyName,
      ...(individual.middleName ? { middleName: individual.middleName } : {}),
    },
  };

  if (individual.dateOfBirth) {
    entity.dateOfBirth = { dateOfBirth: individual.dateOfBirth };
  }

  if (individual.address) {
    const addr: Record<string, string> = {};
    if (individual.address.streetAddress) addr.streetName = individual.address.streetAddress;
    if (individual.address.city) addr.town = individual.address.city;
    if (individual.address.state) addr.state = individual.address.state;
    if (individual.address.postalCode) addr.postalCode = individual.address.postalCode;
    if (individual.address.country) addr.country = individual.address.country;
    entity.addresses = [addr];
  }

  // POST /business/{orgEntityId}/associateEntity/new — creates entity + associates with org
  const url = `${FRANKIE_API_BASE_URL}/business/${orgEntityId}/associateEntity/new`;

  const body: Record<string, unknown> = { entity };

  // At least one of roles or percentageHeld is required
  body.roles = [{ type: 'UBO', typeDescription: 'Ultimate Beneficial Owner' }];
  if (individual.shareholdingPercentage) {
    body.percentageHeld = {
      beneficially: parseFloat(individual.shareholdingPercentage),
      total: parseFloat(individual.shareholdingPercentage),
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function associateExistingEntity(
  orgEntityId: string,
  entityId: string,
  roles: Array<{ type: string; typeDescription: string }>
) {
  const url = `${FRANKIE_API_BASE_URL}/business/${orgEntityId}/associateEntity/${entityId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ roles }),
  });
  const data = await res.json();
  return { data, status: res.status };
}

export async function getParentAssociations(entityId: string) {
  const url = `${FRANKIE_API_BASE_URL}/business/${entityId}/parentAssociations`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  const data = await res.json();
  return { data, status: res.status };
}

export async function disassociateEntity(orgEntityId: string, childEntityId: string) {
  const url = `${FRANKIE_API_BASE_URL}/business/${orgEntityId}/associateEntity/${childEntityId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return { status: res.status };
}

export async function generateOnboardingUrl(params: {
  entityId?: string;
  givenName?: string;
  familyName?: string;
  flowId: string;
  phoneNumber: string;
  phoneCode: string;
  sendSMS: boolean;
  recipientName?: string;
}) {
  // The hosted URL endpoint lives on the kycaml host under /idv/v2/
  // e.g. api.kycaml.uat.frankiefinancial.io or api.kycaml.demo.frankiefinancial.io
  const baseHost = FRANKIE_API_BASE_URL.replace(/\/compliance\/v1\.2\/?$/, '');
  // Ensure we're hitting the kycaml subdomain
  const kycamlHost = baseHost.includes('kycaml')
    ? baseHost
    : baseHost.replace('://api.', '://api.kycaml.');
  const url = `${kycamlHost}/idv/v2/idvalidate/onboarding-url`;

  const body: Record<string, unknown> = {
    consent: true,
    sendSMS: params.sendSMS,
    phoneNumber: params.phoneNumber,
    phoneCode: params.phoneCode,
    flowId: params.flowId,
  };

  if (params.entityId) {
    body.entityId = params.entityId;
  }
  if (params.recipientName) {
    body.recipientName = params.recipientName;
  }
  // customerRef is required when no entityId — use a generated reference
  if (!params.entityId) {
    body.customerRef = `onboarding-${Date.now()}`;
  }

  console.log('[Onboarding URL] POST', url, JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log('[Onboarding URL] Response:', res.status, JSON.stringify(data, null, 2));
  return { data, status: res.status };
}

export async function deleteEntity(entityId: string) {
  const url = `${FRANKIE_API_BASE_URL}${ENDPOINTS.ENTITY_BASE}/${entityId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(),
  });

  if (res.status === 204 || res.status === 200) {
    return { data: null, status: res.status };
  }

  const data = await res.json().catch(() => null);
  return { data, status: res.status };
}
