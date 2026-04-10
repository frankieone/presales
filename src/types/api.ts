export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface BusinessSearchRequest {
  country: string;
  organisationName?: string;
  organisationNumber?: string;
}

export interface BusinessProfileRequest {
  country: string;
  companyCode: string;
  registrationAuthorityCode?: string;
}

export interface AustralianOwnershipRequest {
  acn?: string;
  abn?: string;
  companyName?: string;
}

export interface KycVerifyRequest {
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
}
