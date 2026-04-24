'use client';

import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { TrustAnalysisPanel } from '@/components/business/SupportingDocuments';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { IndividualRole } from '@/types/individual';

export default function TrustReviewPage() {
  const router = useRouter();
  const {
    trustAnalysisResults,
    australianOwnership,
    individuals,
    addManualUbo,
    setTrustAnalysisResult,
  } = useOnboardingStore();

  const entries = Object.entries(trustAnalysisResults);

  if (entries.length === 0) {
    return (
      <div>
        <Alert variant="warning">No trust analysis results found.</Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding/review')}>
          Back to Review
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/onboarding/review')}>
          &larr; Back to Review
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">Trust Analysis Review</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          Review and confirm the details extracted from your trust documents. You can add individuals
          from the trust to your verification list.
        </p>
      </div>

      {entries.map(([key, result]) => {
        const entityId = australianOwnership?.entityId || key;
        return (
          <TrustAnalysisPanel
            key={key}
            entityId={entityId}
            result={result}
            individuals={individuals}
            onAddToIndividuals={async (ind, roles) => {
              const orgEntityId = australianOwnership?.entityId;

              let frankieEntityId: string | undefined;
              if (orgEntityId) {
                try {
                  const res = await fetch('/api/entity/add-ubo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      organisationEntityId: orgEntityId,
                      givenName: ind.name.givenName || '',
                      familyName: ind.name.familyName || '',
                      middleName: ind.name.middleName,
                    }),
                  });
                  const data = await res.json();
                  frankieEntityId = data.entityId;
                } catch (err) {
                  console.error('[TrustReview] Failed to associate entity:', err);
                }
              }

              addManualUbo({
                id: frankieEntityId || ind.entityId || `trust-${Date.now()}`,
                givenName: ind.name.givenName || '',
                familyName: ind.name.familyName || '',
                middleName: ind.name.middleName,
                roles: roles as IndividualRole[],
                kycStatus: 'pending',
                kycEntityId: frankieEntityId,
                source: 'trust-analysis',
              });
            }}
            onAddToTrust={(entry) => {
              const storeKey = australianOwnership?.entityId || key;
              const currentResult = trustAnalysisResults[storeKey];
              if (!currentResult) return;

              const entryEntityId = entry.entityId || `manual-${Date.now()}`;
              const roleKey = entry.role === 'beneficiary' ? 'ubo' : entry.role;

              if (entry.entityType === 'INDIVIDUAL') {
                const updatedResult = {
                  ...currentResult,
                  linkedIndividuals: {
                    ...currentResult.linkedIndividuals,
                    [entryEntityId]: {
                      entityId: entryEntityId,
                      entityType: 'INDIVIDUAL' as const,
                      name: {
                        givenName: entry.name.split(' ')[0] || '',
                        familyName: entry.name.split(' ').slice(1).join(' ') || '',
                        displayName: entry.name,
                      },
                    },
                  },
                  specifiedBeneficiaries: [
                    ...currentResult.specifiedBeneficiaries,
                    ...(roleKey === 'ubo' ? [{ entityId: entryEntityId, entityType: 'INDIVIDUAL' }] : []),
                  ],
                  settlors: [
                    ...currentResult.settlors,
                    ...(roleKey === 'settlor' ? [{ entityId: entryEntityId, entityType: 'INDIVIDUAL' }] : []),
                  ],
                  trustees: [
                    ...currentResult.trustees,
                    ...(roleKey === 'trustee' ? [{ entityId: entryEntityId, entityType: 'INDIVIDUAL' }] : []),
                  ],
                  appointors: [
                    ...currentResult.appointors,
                    ...(roleKey === 'appointor' ? [{ entityId: entryEntityId, entityType: 'INDIVIDUAL' }] : []),
                  ],
                };
                setTrustAnalysisResult(storeKey, updatedResult);
              } else {
                const updatedResult = {
                  ...currentResult,
                  linkedOrganizations: {
                    ...currentResult.linkedOrganizations,
                    [entryEntityId]: {
                      entityId: entryEntityId,
                      entityType: 'ORGANIZATION' as const,
                      details: {
                        name: { value: entry.name },
                      },
                    },
                  },
                  settlors: [
                    ...currentResult.settlors,
                    ...(roleKey === 'settlor' ? [{ entityId: entryEntityId, entityType: 'ORGANIZATION' }] : []),
                  ],
                  trustees: [
                    ...currentResult.trustees,
                    ...(roleKey === 'trustee' ? [{ entityId: entryEntityId, entityType: 'ORGANIZATION' }] : []),
                  ],
                  appointors: [
                    ...currentResult.appointors,
                    ...(roleKey === 'appointor' ? [{ entityId: entryEntityId, entityType: 'ORGANIZATION' }] : []),
                  ],
                  specifiedBeneficiaries: [
                    ...currentResult.specifiedBeneficiaries,
                    ...(roleKey === 'ubo' ? [{ entityId: entryEntityId, entityType: 'ORGANIZATION' }] : []),
                  ],
                };
                setTrustAnalysisResult(storeKey, updatedResult);
              }
            }}
            onConfirmed={(updatedResult) => {
              setTrustAnalysisResult(australianOwnership?.entityId || key, updatedResult);
            }}
          />
        );
      })}

      <div className="mt-8">
        <Button variant="ghost" onClick={() => router.push('/onboarding/review')}>
          &larr; Back to Review
        </Button>
      </div>
    </div>
  );
}
