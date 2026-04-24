'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { BusinessProfileSummary } from '@/components/business/BusinessProfileSummary';
import { OwnershipTree } from '@/components/business/OwnershipTree';
import { BlockingEntityCard } from '@/components/business/BlockingEntityCard';
import { IndividualsList } from '@/components/individuals/IndividualsList';
import { AddUboForm } from '@/components/individuals/AddUboForm';
import { SupportingDocuments } from '@/components/business/SupportingDocuments';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { IndividualRole } from '@/types/individual';

const ROLE_CODE_MAP: Record<string, IndividualRole> = {
  DR: 'director',
  SR: 'secretary',
  SH: 'shareholder',
  UBO: 'ubo',
  TR: 'ubo',
  BN: 'ubo',
  AR: 'director',
};

export default function ReviewPage() {
  const router = useRouter();
  const [showTrustWarning, setShowTrustWarning] = useState(false);
  const {
    businessProfile,
    australianOwnership,
    individuals,
    selectedBusiness,
    blockingEntities,
    blockingEntitiesAcknowledged,
    setBlockingEntitiesAcknowledged,
    setAustralianOwnership,
    addManualUbo,
    trustAnalysisResults,
    supportingDocuments,
    trustLinkedOrgId,
    setTrustLinkedOrgId,
    kycResults,
  } = useOnboardingStore();

  // When an entity is added via the tree, inject it into the ownership data
  const handleEntityAdded = useCallback((
    parentEntityId: string,
    newEntity: { entityId: string; entityType: 'INDIVIDUAL' | 'ORGANIZATION'; name: string; role: string }
  ) => {
    if (!australianOwnership?.shareholders) return;

    const newChild = {
      entityId: newEntity.entityId,
      name: newEntity.name,
      entityType: newEntity.entityType,
      roles: [newEntity.role],
    };

    // Deep clone shareholders so React detects the change
    const cloned = JSON.parse(JSON.stringify(australianOwnership.shareholders));

    // Find the parent and inject the child
    function inject(list: typeof cloned): boolean {
      for (const sh of list) {
        if (sh.entityId === parentEntityId) {
          sh.children = [...(sh.children || []), newChild];
          return true;
        }
        if (sh.children && inject(sh.children)) return true;
      }
      return false;
    }

    const rootId = australianOwnership.entityId || '';
    if (parentEntityId === rootId) {
      cloned.push(newChild);
    } else {
      inject(cloned);
    }

    setAustralianOwnership({ ...australianOwnership, shareholders: cloned });

    // Also add the individual to the individuals list so they appear in the portal
    if (newEntity.entityType === 'INDIVIDUAL') {
      const nameParts = newEntity.name.split(' ');
      const givenName = nameParts[0] || '';
      const familyName = nameParts.slice(1).join(' ') || '';
      const role = ROLE_CODE_MAP[newEntity.role] || 'ubo';
      addManualUbo({
        id: newEntity.entityId,
        givenName,
        familyName,
        roles: [role],
        kycStatus: 'pending',
        ownershipEntityId: newEntity.entityId,
        source: 'manual',
      });
    }
  }, [australianOwnership, setAustralianOwnership, addManualUbo]);

  const hasProfile = businessProfile || australianOwnership;
  const hasBlockingEntities = blockingEntities.length > 0;

  // Trust gating: check if any trust docs are pending upload or unconfirmed
  const hasTrustResults = Object.keys(trustAnalysisResults).length > 0;
  const allTrustsConfirmed = Object.values(trustAnalysisResults).every(r => r.status === 'CONFIRMED');
  const hasPendingTrustUploads = supportingDocuments.some(d => d.docType === 'TRUST_DEED');
  const trustBlocking = hasPendingTrustUploads || (hasTrustResults && !allTrustsConfirmed);

  // Check if any trust individuals have been added to the individuals list
  const hasTrustIndividualsInList = hasTrustResults && individuals.some(i => (i as any).source === 'trust-analysis');

  const canProceed =
    individuals.length > 0 &&
    (!hasBlockingEntities || blockingEntitiesAcknowledged) &&
    !trustBlocking;

  if (!hasProfile && !selectedBusiness) {
    return (
      <div>
        <Alert variant="warning">No business selected. Please start from the search step.</Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding')}>
          Back to Search
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">Review Business & Individuals</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          Review the business details and associated individuals. You can edit any individual&apos;s
          details before proceeding to KYC verification.
        </p>
      </div>

      {businessProfile && (
        <div className="mb-6">
          <BusinessProfileSummary profile={businessProfile} />
        </div>
      )}

      {australianOwnership?.businessDetails && (() => {
        const shareholders = australianOwnership.shareholders || [];
        const individualCount = shareholders.filter(s => s.entityType === 'INDIVIDUAL').length;
        const orgCount = shareholders.filter(s => s.entityType === 'ORGANIZATION').length;
        const jointCount = shareholders.filter(s => s.jointHolderGroup).length;
        const blockingCount = blockingEntities.length;

        return (
          <div className="mb-6 bg-white rounded-xl border border-wise-gray-200 shadow-sm p-5">
            <h3 className="font-bold text-wise-navy text-lg mb-3">
              {australianOwnership.businessDetails.registeredName || selectedBusiness?.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {australianOwnership.businessDetails.ACN && (
                <div>
                  <span className="text-wise-gray-500">ACN:</span>{' '}
                  <span className="font-medium">{australianOwnership.businessDetails.ACN}</span>
                </div>
              )}
              {australianOwnership.businessDetails.ABN && (
                <div>
                  <span className="text-wise-gray-500">ABN:</span>{' '}
                  <span className="font-medium">{australianOwnership.businessDetails.ABN}</span>
                </div>
              )}
              {australianOwnership.businessDetails.asicCompanyType && (
                <div>
                  <span className="text-wise-gray-500">Type:</span>{' '}
                  <span className="font-medium">{australianOwnership.businessDetails.asicCompanyType}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-wise-gray-100">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700">
                <span className="text-lg font-bold">{orgCount}</span>
                <span className="text-xs">Companies</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <span className="text-lg font-bold">{individualCount}</span>
                <span className="text-xs">Individuals</span>
              </div>
              {blockingCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700">
                  <span className="text-lg font-bold">{blockingCount}</span>
                  <span className="text-xs">Blocking</span>
                </div>
              )}
              {jointCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700">
                  <span className="text-lg font-bold">{jointCount}</span>
                  <span className="text-xs">Joint Holders</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {australianOwnership && (
        <div className="mb-6">
          <OwnershipTree
            ownership={australianOwnership}
            blockingEntities={blockingEntities}
            onEntityAdded={handleEntityAdded}
            trustAnalysisResults={Object.keys(trustAnalysisResults).length > 0 ? trustAnalysisResults : undefined}
            trustLinkedOrgId={trustLinkedOrgId}
            onTrustLinkOrg={setTrustLinkedOrgId}
            individuals={individuals}
            kycResults={kycResults}
          />
        </div>
      )}

      {hasBlockingEntities && (
        <div className="mb-6">
          <div className="space-y-3">
            {blockingEntities.map((entity) => (
              <BlockingEntityCard key={entity.entityId} entity={entity} />
            ))}
          </div>

          <label className="flex items-start gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={blockingEntitiesAcknowledged}
              onChange={(e) => setBlockingEntitiesAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-wise-gray-300 text-wise-green focus:ring-wise-green"
            />
            <span className="text-sm text-wise-gray-700">
              I've uploaded all documents for this organisation
            </span>
          </label>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-wise-navy">
          Individuals ({individuals.length})
        </h2>
        <p className="text-xs text-wise-gray-500 mt-0.5">
          Directors, shareholders, beneficial owners, and officers
        </p>
      </div>

      <IndividualsList />

      <div className="mt-4">
        <AddUboForm />
      </div>

      <div className="mt-6">
        <SupportingDocuments />
      </div>

      {/* Trust blocking warnings */}
      {trustBlocking && (
        <div className="mt-6">
          {hasPendingTrustUploads && (
            <Alert variant="warning">
              You have trust documents queued but not yet uploaded. Please upload or remove them before proceeding.
            </Alert>
          )}
          {hasTrustResults && !allTrustsConfirmed && !hasPendingTrustUploads && (
            <Alert variant="warning">
              Trust analysis results have not been confirmed. Please{' '}
              <button
                type="button"
                onClick={() => router.push('/onboarding/review/trust')}
                className="underline font-medium"
              >
                review and confirm
              </button>{' '}
              your trust details before proceeding.
            </Alert>
          )}
        </div>
      )}

      {/* "Are you sure?" dialog when no trust individuals added */}
      {showTrustWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-wise-navy mb-2">No Trust Individuals Added</h3>
            <p className="text-sm text-wise-gray-600 mb-4">
              You have a confirmed trust but haven&apos;t added any individuals from it to your
              verification list. Trust-related individuals may need KYC verification.
            </p>
            <p className="text-sm text-wise-gray-600 mb-6">
              Are you sure you want to proceed without adding anyone from the trust?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowTrustWarning(false)}>
                Go Back
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTrustWarning(false);
                  router.push('/onboarding/review/trust');
                }}
              >
                Review Trust
              </Button>
              <Button
                onClick={() => {
                  setShowTrustWarning(false);
                  router.push('/onboarding/kyc');
                }}
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" onClick={() => router.push('/onboarding/results')}>
          &larr; Back
        </Button>
        <Button
          size="lg"
          onClick={() => {
            if (hasTrustResults && allTrustsConfirmed && !hasTrustIndividualsInList) {
              setShowTrustWarning(true);
              return;
            }
            router.push('/onboarding/kyc');
          }}
          disabled={!canProceed}
        >
          Proceed to KYC Verification &rarr;
        </Button>
      </div>
    </div>
  );
}
