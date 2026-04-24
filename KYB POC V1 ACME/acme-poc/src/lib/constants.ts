export const FRANKIE_API_BASE_URL =
  process.env.FRANKIE_API_BASE_URL || 'https://api.demo.frankiefinancial.io/compliance/v1.2';

export const FRANKIE_API_V2_BASE_URL =
  process.env.FRANKIE_API_V2_BASE_URL || 'https://api.uat.frankie.one';

// Derive the experimental base URL from the v1.2 base URL
// e.g. https://api.demo.frankiefinancial.io/compliance/v1.2 -> https://api.kycaml.demo.frankiefinancial.io/experimental
// e.g. https://api.kycaml.uat.frankiefinancial.io/compliance/v1.2 -> https://api.kycaml.uat.frankiefinancial.io/experimental
function deriveExperimentalUrl(): string {
  const base = (process.env.FRANKIE_API_BASE_URL || 'https://api.demo.frankiefinancial.io/compliance/v1.2')
    .replace(/\/compliance\/v1\.2\/?$/, '');
  // Ensure we're on the kycaml subdomain
  const kycamlBase = base.includes('kycaml') ? base : base.replace('://api.', '://api.kycaml.');
  return `${kycamlBase}/experimental`;
}

export const FRANKIE_API_EXPERIMENTAL_BASE_URL =
  process.env.FRANKIE_API_EXPERIMENTAL_BASE_URL || deriveExperimentalUrl();

export const FRANKIE_CUSTOMER_ID = process.env.FRANKIE_CUSTOMER_ID || '';
export const FRANKIE_API_KEY = process.env.FRANKIE_API_KEY || '';
export const FRANKIE_CUSTOMER_CHILD_ID = process.env.FRANKIE_CUSTOMER_CHILD_ID || '';

export const DEFAULT_CHECK_TYPE = 'profile';
export const DEFAULT_RESULT_LEVEL = 'summary';
export const DEFAULT_ENTITY_PROFILE = 'safe_harbour';

export const KYC_CONSENT_EXTRA_DATA = [
  { kvpKey: 'kyc.method', kvpValue: 'electronic' },
  { kvpKey: 'consent.general', kvpValue: 'true' },
  { kvpKey: 'consent.docs', kvpValue: 'true' },
  { kvpKey: 'consent.creditHeader', kvpValue: 'true' },
];

export const ENDPOINTS = {
  BUSINESS_SEARCH: '/business/international/search',
  BUSINESS_PROFILE: '/business/international/profile',
  BUSINESS_OWNERSHIP: '/business/ownership/query',
  ENTITY_VERIFY: '/entity/new/verify',
  ENTITY_VERIFY_EXISTING: '/entity',
  ENTITY_BASE: '/entity',
} as const;

export const DOCUMENT_TYPES = [
  { value: 'TRUST_DEED', label: 'Trust Deed' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'UTILITY_BILL', label: 'Utility Bill' },
  { value: 'COMPANY_EXTRACT', label: 'Company Extract' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const SAMPLE_TRUST_PDFS = [
  { filename: 'discretionary-lennox-family.pdf', label: 'Lennox Family Trust' },
  { filename: 'discretionary-rex.pdf', label: 'Rex Trust' },
  { filename: 'discretionary-tom-lane.pdf', label: 'Tom Lane Trust' },
] as const;
