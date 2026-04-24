export interface BusinessAddress {
  addressInOneLine?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  cityTown?: string;
  postcode?: string;
  regionState?: string;
  country?: string;
}

export interface BusinessSearchResult {
  code: string;
  companyId: string;
  name: string;
  address?: string;
  legalStatus?: string;
  legalForm?: string;
  registrationAuthority?: string;
  registrationAuthorityCode?: string;
  source?: string;
}

export interface DirectorDTO {
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  address5?: string;
  address6?: string;
  postcode?: string;
  birthdate?: string;
  nationality?: string;
  title?: string;
  directorNumber?: string;
}

export interface ShareholderDTO {
  name: string;
  address?: string;
  nationality?: string;
  percentage?: string;
  shareCount?: number;
  shareType?: string;
  shareholderType?: string;
  totalShares?: number;
}

export interface PSCDetail {
  Name: string;
  Address?: string;
  CountryOfResidence?: string;
  DOBDay?: number;
  DOBMonth?: number;
  DOBYear?: number;
  Nationality?: string;
  NatureOfControlList?: string[];
  NotifiedOn?: string;
  CeasedOn?: string;
  Kind?: string;
}

export interface OfficerDTO {
  Name: string;
  Address?: string;
  Title?: string;
  Type?: string;
  Date?: string;
}

export interface BusinessProfile {
  name: string;
  code: string;
  registrationNumber?: string;
  legalForm?: string;
  legalStatus?: string;
  registrationDate?: string;
  address?: BusinessAddress;
  directors: DirectorDTO[];
  shareholders: ShareholderDTO[];
  pscs: PSCDetail[];
  officers: OfficerDTO[];
  entityId?: string;
}

export interface AustralianBusinessDetails {
  ABN?: string;
  ACN?: string;
  registeredName?: string;
  entityId?: string;
  asicCompanyType?: string;
  dateRegistered?: string;
}

export interface AustralianOfficeholder {
  name: string;
  dateOfBirth?: string;
  role?: string;
  entityId?: string;
  addresses?: Array<{
    streetName?: string;
    streetNumber?: string;
    suburb?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    longForm?: string;
  }>;
  percentOwned?: number;
}

export interface BlockingEntityReason {
  type: string;
  description: string;
}

export interface BlockingEntity {
  entityId: string;
  name: string;
  entityType: string;
  abn?: string;
  acn?: string;
  address?: string;
  percentageOwned: {
    beneficially?: number;
    nonBeneficially?: number;
    total: number;
  };
  reasons: BlockingEntityReason[];
  registrationDate?: string;
  status?: string;
  ubos?: AustralianOfficeholder[];
}

export interface TrustLinkedIndividual {
  entityId: string;
  entityType: 'INDIVIDUAL';
  name: {
    displayName?: string;
    givenName?: string;
    familyName?: string;
    middleName?: string;
    referenceIds?: string[];
  };
  dateOfBirth?: { normalized?: string; year?: string; month?: string; day?: string };
  addresses?: Array<{
    unstructuredLongForm?: string;
    streetName?: string;
    unitNumber?: string;
    buildingName?: string;
    neighborhood?: string;
    subdivision?: string;
    postalCode?: string;
    country?: string;
  }>;
}

export interface TrustLinkedOrganization {
  entityId: string;
  entityType: 'ORGANIZATION';
  details?: {
    name?: { value?: string };
    type?: { code?: string; description?: string };
    registrationDetails?: Array<{
      registrationNumber?: string;
      registrationNumberType?: string;
    }>;
  };
}

export interface TrustAnalysisResult {
  documentId: string;
  analysisId?: string;
  status: string;
  trustName?: string;
  trustType?: string;
  establishment?: {
    date?: string;
    country?: string;
    subdivision?: string;
  };
  execution?: {
    date?: string;
  };
  certification?: {
    date?: string;
  };
  linkedIndividuals: Record<string, TrustLinkedIndividual>;
  linkedOrganizations: Record<string, TrustLinkedOrganization>;
  settlors: Array<{ entityId: string; entityType: string }>;
  trustees: Array<{ entityId: string; entityType: string }>;
  appointors: Array<{ entityId: string; entityType: string }>;
  specifiedBeneficiaries: Array<{ entityId: string; entityType: string }>;
  generalBeneficiaries: Array<{ value: string }>;
  rawData?: unknown;
}

export interface OwnershipShareholder {
  entityId: string;
  name: string;
  entityType: 'INDIVIDUAL' | 'ORGANIZATION';
  percentOwned?: number;
  percentBeneficially?: number;
  percentNonBeneficially?: number;
  isBlocking?: boolean;
  roles?: string[];
  children?: OwnershipShareholder[];
  jointHolderGroup?: string;
}

export interface AustralianOwnershipResponse {
  businessDetails?: AustralianBusinessDetails;
  officeholders: AustralianOfficeholder[];
  ubos: AustralianOfficeholder[];
  shareholders?: OwnershipShareholder[];
  blockingEntities: BlockingEntity[];
  requestId?: string;
  entityId?: string;
  isAsync?: boolean;
}
