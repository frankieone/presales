export type IndividualRole = 'director' | 'shareholder' | 'ubo' | 'psc' | 'officer' | 'secretary';

export type KycStatus = 'pending' | 'submitted' | 'pass' | 'fail' | 'refer' | 'error';

export interface IndividualAddress {
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Individual {
  id: string;
  givenName: string;
  middleName?: string;
  familyName: string;
  dateOfBirth?: string;
  yearOfBirth?: string;
  nationality?: string;
  address?: IndividualAddress;
  roles: IndividualRole[];
  shareholdingPercentage?: string;
  kycStatus: KycStatus;
  kycEntityId?: string;
  isEditing?: boolean;
  source?: 'registry' | 'manual';
}
