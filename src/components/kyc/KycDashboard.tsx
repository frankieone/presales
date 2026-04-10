'use client';

import { useOnboardingStore } from '@/store/onboarding-store';
import { KycResultCard } from './KycResultCard';

export function KycDashboard() {
  const { individuals, kycResults } = useOnboardingStore();

  const completedIndividuals = individuals.filter((ind) => kycResults.has(ind.id));
  const pendingIndividuals = individuals.filter((ind) => !kycResults.has(ind.id));

  const passCount = Array.from(kycResults.values()).filter((r) => r.overallResult === 'PASS').length;
  const failCount = Array.from(kycResults.values()).filter((r) => r.overallResult === 'FAIL').length;
  const referCount = Array.from(kycResults.values()).filter((r) => r.overallResult === 'REFER').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-wise-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-wise-navy">{individuals.length}</p>
          <p className="text-xs text-wise-gray-500">Total</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{passCount}</p>
          <p className="text-xs text-green-600">Passed</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{failCount}</p>
          <p className="text-xs text-red-600">Failed</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{referCount}</p>
          <p className="text-xs text-amber-600">Referred</p>
        </div>
      </div>

      {completedIndividuals.length > 0 && (
        <div>
          <h3 className="font-semibold text-wise-navy text-sm mb-3">Completed Checks</h3>
          <div className="space-y-3">
            {completedIndividuals.map((ind) => {
              const result = kycResults.get(ind.id);
              if (!result) return null;
              return <KycResultCard key={ind.id} individual={ind} result={result} />;
            })}
          </div>
        </div>
      )}

      {pendingIndividuals.length > 0 && (
        <div>
          <h3 className="font-semibold text-wise-gray-500 text-sm mb-3">Not Yet Verified</h3>
          <div className="space-y-2">
            {pendingIndividuals.map((ind) => (
              <div
                key={ind.id}
                className="bg-white rounded-lg border border-wise-gray-200 p-3 text-sm text-wise-gray-500"
              >
                {[ind.givenName, ind.middleName, ind.familyName].filter(Boolean).join(' ')} &mdash; Not submitted
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
