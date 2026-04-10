// v2 API base URL (UAT or production)
export const FRANKIE_API_V2_BASE_URL =
  process.env.FRANKIE_API_V2_BASE_URL || 'https://api.uat.frankie.one';

export const FRANKIE_CUSTOMER_ID = process.env.FRANKIE_CUSTOMER_ID || '';
export const FRANKIE_API_KEY = process.env.FRANKIE_API_KEY || '';
export const FRANKIE_CUSTOMER_CHILD_ID = process.env.FRANKIE_CUSTOMER_CHILD_ID || '';

// v2 workflow names
export const DEFAULT_WORKFLOW_NAME = process.env.FRANKIE_WORKFLOW_NAME || 'AUS-Basic2V-TwoPlus';
export const DEFAULT_KYB_WORKFLOW_NAME = process.env.FRANKIE_KYB_WORKFLOW_NAME || 'AUS-Organization-Ownership';

// v2 endpoints
export const V2_ENDPOINTS = {
  ORGANIZATIONS_LOOKUP: '/v2/organizations/lookup',
  ORGANIZATIONS_PROFILE: '/v2/organizations/profile',
  ORGANIZATIONS_CREATE: '/v2/organizations',
  ORGANIZATIONS_BASE: '/v2/organizations',
  INDIVIDUALS_BASE: '/v2/individuals',
  WORKFLOWS: '/v2/workflows',
  ORGANIZATIONS_RELATIONSHIPS: '/v2/organizations', // + /{entityId}/relationships
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
