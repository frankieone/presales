const API_BASE = process.env.FRANKIE_API_BASE_URL || 'https://api.uat.frankie.one';
const CUSTOMER_ID = process.env.FRANKIE_CUSTOMER_ID || '';
const CUSTOMER_CHILD_ID = process.env.FRANKIE_CUSTOMER_CHILD_ID || '';
const API_KEY = process.env.FRANKIE_API_KEY || '';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Frankie-CustomerID': CUSTOMER_ID,
    'api_key': API_KEY,
  };
  if (CUSTOMER_CHILD_ID) {
    headers['X-Frankie-CustomerChildID'] = CUSTOMER_CHILD_ID;
  }
  return headers;
}

export async function generateHostedOnboardingUrl(options: {
  entityId?: string;
  flowId?: string;
}) {
  const body: Record<string, unknown> = {
    consent: true,
    oneSDKFlowId: options.flowId || 'idv',
    sendSMS: false,
  };

  if (options.entityId) {
    body.entityId = options.entityId;
  } else {
    body.customerRef = `onboarding-${Date.now()}`;
  }

  const res = await fetch(`${API_BASE}/v2/individuals/hostedUrl`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export interface MedicareDocument {
  type: 'NATIONAL_HEALTH_ID';
  cardNumber: string;
  cardType: 'G' | 'B' | 'Y';
  subdivision: string;
  expiryDate: string;
  reference?: string;
  middleNameOnCard?: string;
  attachmentBase64?: string;
}

export interface BirthCertDocument {
  type: 'BIRTH_CERT';
  registrationNumber: string;
  certificateNumber?: string;
  subdivision: string;
  registrationDate?: string;
  dateOfPrint?: string;
  registeredFamilyName?: string;
  registeredGivenName?: string;
  registeredOtherNames?: string;
  attachmentBase64?: string;
}

export type AltDocument = MedicareDocument | BirthCertDocument;

export interface PersonalDetails {
  givenName: string;
  middleName?: string;
  familyName: string;
  dateOfBirth: string; // YYYY-MM-DD
  streetNumber: string;
  streetName: string;
  streetType: string;
  locality: string;
  subdivision: string;
  postalCode: string;
}

export async function createIndividualWithDocument(
  personal: PersonalDetails,
  doc: AltDocument,
  customAttributes?: Record<string, string>,
) {
  const individual: Record<string, unknown> = {
    name: {
      givenName: personal.givenName,
      middleName: personal.middleName || '',
      familyName: personal.familyName,
    },
    dateOfBirth: {
      year: personal.dateOfBirth.split('-')[0],
      month: personal.dateOfBirth.split('-')[1],
      day: personal.dateOfBirth.split('-')[2],
    },
    addresses: [
      {
        type: 'RESIDENTIAL',
        streetNumber: personal.streetNumber,
        streetName: personal.streetName,
        streetType: personal.streetType,
        locality: personal.locality,
        subdivision: personal.subdivision,
        postalCode: personal.postalCode,
        country: 'AUS',
      },
    ],
    consents: [{ type: 'GENERAL' }, { type: 'DOCS' }],
  };

  // Build document object
  let document: Record<string, unknown>;

  if (doc.type === 'NATIONAL_HEALTH_ID') {
    const supplementaryData: Record<string, unknown> = { type: 'NATIONAL_HEALTH_ID' };
    if (doc.reference) supplementaryData.reference = doc.reference;
    if (doc.middleNameOnCard) supplementaryData.middleNameOnCard = doc.middleNameOnCard;

    document = {
      type: 'NATIONAL_HEALTH_ID',
      country: 'AUS',
      primaryIdentifier: doc.cardNumber,
      subtype: doc.cardType,
      subdivision: doc.subdivision,
      expiryDate: {
        year: doc.expiryDate.split('-')[0],
        month: doc.expiryDate.split('-')[1],
        day: doc.expiryDate.split('-')[2] || '01',
      },
      supplementaryData,
    };
  } else {
    const supplementaryData: Record<string, unknown> = { type: 'BIRTH_CERT' };
    if (doc.registrationDate) supplementaryData.registrationDate = doc.registrationDate;
    if (doc.dateOfPrint) supplementaryData.dateOfPrint = doc.dateOfPrint;
    if (doc.registeredFamilyName) supplementaryData.registeredFamilyName = doc.registeredFamilyName;
    if (doc.registeredGivenName) supplementaryData.registeredGivenName = doc.registeredGivenName;
    if (doc.registeredOtherNames) supplementaryData.registeredOtherNames = doc.registeredOtherNames;

    document = {
      type: 'BIRTH_CERT',
      country: 'AUS',
      primaryIdentifier: doc.registrationNumber,
      subdivision: doc.subdivision,
      ...(doc.certificateNumber && { secondaryIdentifier: doc.certificateNumber }),
      supplementaryData,
    };
  }

  // Add attachment if provided
  if (doc.attachmentBase64) {
    (document as Record<string, unknown>).attachments = [
      {
        filename: doc.type === 'NATIONAL_HEALTH_ID' ? 'medicare.jpg' : 'birth_cert.jpg',
        mimeType: 'image/jpeg',
        side: 'FRONT',
        data: { base64: doc.attachmentBase64 },
      },
    ];
  }

  individual.documents = { IDENTITY: [document] };

  if (customAttributes) {
    const attrs: Record<string, { type: string; value: string }> = {};
    for (const [key, value] of Object.entries(customAttributes)) {
      attrs[key] = { type: 'STRING', value };
    }
    individual.customAttributes = attrs;
  }

  const res = await fetch(`${API_BASE}/v2/individuals`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ individual }),
  });

  const data = await res.json();
  return { data, status: res.status };
}

export async function executeWorkflow(entityId: string, workflowName: string, serviceName = 'KYC') {
  const res = await fetch(
    `${API_BASE}/v2/individuals/${entityId}/serviceprofiles/${serviceName}/workflows/${workflowName}/execute`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    },
  );

  const data = await res.json();
  return { data, status: res.status };
}

export async function updateEntityCustomAttributes(
  entityId: string,
  attributes: Record<string, string>
) {
  const customAttributes: Record<string, { type: string; value: string }> = {};
  for (const [key, value] of Object.entries(attributes)) {
    customAttributes[key] = { type: 'STRING', value };
  }

  const res = await fetch(`${API_BASE}/v2/individuals/${entityId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      individual: { customAttributes },
    }),
  });

  const data = await res.json();
  return { data, status: res.status };
}
