export type AmlClassification =
  | 'FALSE_POSITIVE'
  | 'TRUE_POSITIVE'
  | 'TRUE_POSITIVE_ACCEPT'
  | 'TRUE_POSITIVE_REJECT'
  | 'UNKNOWN'
  | 'UNKNOWN_ACCEPT'
  | 'UNKNOWN_REJECT';

export interface AmlMatch {
  matchId: string;
  processResultId?: string;
  matchedName: string;
  searchName?: string;
  matchScore: number;
  matchType: 'PEP' | 'SANCTIONS' | 'MEDIA' | 'UNKNOWN';
  source?: string;
  listName?: string;
  details?: string;
  positions?: string[];
  countries?: string[];
  searchCountries?: string[];
  aliases?: string[];
  addresses?: string[];
  classification?: AmlClassification;
  currentState?: string;
  confidenceLevel?: number;
  pepDetails?: {
    sourceName?: string;
    amlTypes?: string;
    listingStarted?: string;
    countryCodes?: string;
  }[];
  reportUrl?: string;
  imageUrl?: string;
}

export interface AmlScreeningResult {
  entityId: string;
  entityName: string;
  entityType: 'business' | 'individual';
  overallResult: 'CLEAR' | 'HIT' | 'ERROR';
  matches: AmlMatch[];
  screenedAt: string;
  checkId?: string;
}
