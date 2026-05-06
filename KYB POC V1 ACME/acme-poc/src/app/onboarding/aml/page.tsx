'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { AmlScreeningCard } from '@/components/aml/AmlScreeningCard';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import type { AmlScreeningResult, AmlClassification } from '@/types/aml';

export default function AmlPage() {
  const router = useRouter();
  const {
    australianOwnership,
    selectedBusiness,
    businessProfile,
    individuals,
    businessAmlResult,
    individualAmlResults,
    amlError,
    setBusinessAmlResult,
    addIndividualAmlResult,
    updateAmlMatchClassification,
    setAmlError,
  } = useOnboardingStore();

  const [isScreeningBusiness, setIsScreeningBusiness] = useState(false);
  const [screeningIndividualId, setScreeningIndividualId] = useState<string | null>(null);
  const [isScreeningAll, setIsScreeningAll] = useState(false);

  const businessEntityId = australianOwnership?.entityId;
  const businessName = businessProfile?.name ||
    australianOwnership?.businessDetails?.registeredName ||
    selectedBusiness?.name || 'Business';

  async function screenBusiness() {
    if (!businessEntityId) {
      setAmlError('No business entity ID available for AML screening.');
      return;
    }

    setIsScreeningBusiness(true);
    setAmlError(null);

    try {
      const res = await fetch('/api/aml/business/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: businessEntityId, entityName: businessName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAmlError(data.error || 'Business AML screening failed');
        return;
      }

      setBusinessAmlResult(data as AmlScreeningResult);
    } catch {
      setAmlError('Network error during business AML screening.');
    } finally {
      setIsScreeningBusiness(false);
    }
  }

  async function screenIndividual(individualId: string) {
    const individual = individuals.find((i) => i.id === individualId);
    if (!individual) return;

    setScreeningIndividualId(individualId);
    setAmlError(null);

    try {
      const res = await fetch('/api/aml/individual/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          individualId,
          kycEntityId: individual.kycEntityId,
          givenName: individual.givenName,
          middleName: individual.middleName,
          familyName: individual.familyName,
          dateOfBirth: individual.dateOfBirth,
          address: individual.address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAmlError(data.error || `AML screening failed for ${individual.givenName} ${individual.familyName}`);
        return;
      }

      addIndividualAmlResult(individualId, data as AmlScreeningResult);
    } catch {
      setAmlError(`Network error screening ${individual.givenName} ${individual.familyName}.`);
    } finally {
      setScreeningIndividualId(null);
    }
  }

  async function screenAllIndividuals() {
    setIsScreeningAll(true);
    const pending = individuals.filter((i) => !individualAmlResults.has(i.id));
    for (const ind of pending) {
      await screenIndividual(ind.id);
    }
    setIsScreeningAll(false);
  }

  async function classifyMatch(
    entityId: string,
    matchId: string,
    processResultId: string | undefined,
    classification: AmlClassification
  ) {
    setAmlError(null);
    try {
      const res = await fetch('/api/aml/classify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          processResultIds: processResultId ? [processResultId] : [matchId],
          classification,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAmlError(data.error || 'Classification failed');
        return;
      }

      updateAmlMatchClassification(entityId, matchId, classification);
    } catch {
      setAmlError('Network error during classification.');
    }
  }

  const pendingIndividualCount = individuals.filter((i) => !individualAmlResults.has(i.id)).length;
  const allScreened = businessAmlResult && individualAmlResults.size >= individuals.length;

  if (!businessEntityId && individuals.length === 0) {
    return (
      <div>
        <Alert variant="warning">No business or individuals to screen. Please go back and review.</Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding/review')}>
          Back to Review
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">AML Screening</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          Run sanctions, PEP, and adverse media checks on the business and associated individuals.
        </p>
      </div>

      {amlError && (
        <Alert variant="error" className="mb-4">{amlError}</Alert>
      )}

      {/* Business AML Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-wise-navy mb-3">Business AML</h2>
        <AmlScreeningCard
          entityName={businessName}
          entityType="business"
          result={businessAmlResult}
          isScreening={isScreeningBusiness}
          onScreen={screenBusiness}
        />
      </div>

      {/* Individual AML Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-wise-navy">
            Individual AML ({individuals.length})
          </h2>
          {pendingIndividualCount > 0 && (
            <Button
              size="sm"
              onClick={screenAllIndividuals}
              disabled={isScreeningAll || !!screeningIndividualId}
            >
              {isScreeningAll ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="sm" /> Screening all...
                </span>
              ) : (
                `Screen All (${pendingIndividualCount} remaining)`
              )}
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {individuals.map((ind) => {
            const result = individualAmlResults.get(ind.id) || null;
            const fullName = [ind.givenName, ind.middleName, ind.familyName].filter(Boolean).join(' ');
            return (
              <AmlScreeningCard
                key={ind.id}
                entityName={fullName}
                entityType="individual"
                result={result}
                isScreening={screeningIndividualId === ind.id || (isScreeningAll && !result)}
                onScreen={() => screenIndividual(ind.id)}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" onClick={() => router.push('/onboarding/review')}>
          &larr; Back to Review
        </Button>
        <Button
          size="lg"
          onClick={() => router.push('/onboarding/kyc')}
          disabled={!allScreened}
        >
          {allScreened ? 'Proceed to KYC Verification' : 'Complete all screenings to proceed'} &rarr;
        </Button>
      </div>
    </div>
  );
}
