export interface KycCheckResult {
  type: string;
  result: 'PASS' | 'FAIL' | 'REFER' | 'UNCHECKED';
  details?: string;
}

export interface KycResult {
  individualId: string;
  entityId?: string;
  checkId?: string;
  overallResult: 'PASS' | 'FAIL' | 'REFER' | 'ERROR';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNACCEPTABLE';
  checks: KycCheckResult[];
  alertCount?: number;
  matchCount?: number;
  requestId?: string;
  rawResponse?: Record<string, unknown>;
}
