'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { KycResult } from '@/types/kyc';
import type { Individual } from '@/types/individual';

interface KycResultCardProps {
  individual: Individual;
  result: KycResult;
}

const resultConfig = {
  PASS: { variant: 'success' as const, bg: 'bg-green-50' },
  FAIL: { variant: 'error' as const, bg: 'bg-red-50' },
  REFER: { variant: 'warning' as const, bg: 'bg-amber-50' },
  ERROR: { variant: 'error' as const, bg: 'bg-red-50' },
};

export function KycResultCard({ individual, result }: KycResultCardProps) {
  const fullName = [individual.givenName, individual.middleName, individual.familyName]
    .filter(Boolean)
    .join(' ');

  const config = resultConfig[result.overallResult];

  return (
    <Card className={config.bg}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-wise-navy text-sm">{fullName}</h4>
            <Badge variant={config.variant}>{result.overallResult}</Badge>
            {result.riskLevel && (
              <Badge variant={result.riskLevel === 'LOW' ? 'success' : result.riskLevel === 'HIGH' ? 'error' : 'warning'}>
                Risk: {result.riskLevel}
              </Badge>
            )}
          </div>

          {result.checks.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.checks.map((check, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      check.result === 'PASS'
                        ? 'bg-green-500'
                        : check.result === 'FAIL'
                        ? 'bg-red-500'
                        : check.result === 'REFER'
                        ? 'bg-amber-500'
                        : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-wise-gray-600 font-medium">{check.type}</span>
                  <span className="text-wise-gray-400">{check.result}</span>
                </div>
              ))}
            </div>
          )}

          {result.requestId && (
            <p className="mt-2 text-xs text-wise-gray-400">Request ID: {result.requestId}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
