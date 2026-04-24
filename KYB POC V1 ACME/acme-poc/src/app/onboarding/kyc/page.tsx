'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { IndividualCard } from '@/components/individuals/IndividualCard';
import { KycSubmitButton } from '@/components/kyc/KycSubmitButton';
import { SendOnboardingModal } from '@/components/kyc/SendOnboardingModal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import type { KycResult } from '@/types/kyc';
import type { Individual } from '@/types/individual';

export default function KycPage() {
  const router = useRouter();
  const {
    individuals,
    kycResults,
    updateIndividual,
    addKycResult,
    kycError,
    setKycError,
  } = useOnboardingStore();

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [onboardingModalIndividual, setOnboardingModalIndividual] = useState<Individual | null>(null);

  async function submitKyc(individualId: string) {
    const individual = individuals.find((i) => i.id === individualId);
    if (!individual) return;

    setSubmittingId(individualId);
    updateIndividual(individualId, { kycStatus: 'submitted' });
    setKycError(null);

    try {
      const res = await fetch('/api/kyc/verify', {
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
        updateIndividual(individualId, { kycStatus: 'error' });
        setKycError(data.error || 'Verification failed');
        return;
      }

      const result: KycResult = data;
      addKycResult(individualId, result);

      const status = result.overallResult === 'PASS' ? 'pass' :
        result.overallResult === 'FAIL' ? 'fail' :
        result.overallResult === 'REFER' ? 'refer' : 'error';

      updateIndividual(individualId, { kycStatus: status, kycEntityId: result.entityId });
    } catch {
      updateIndividual(individualId, { kycStatus: 'error' });
      setKycError('Network error. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  }

  function hasRequiredData(ind: Individual): boolean {
    return !!(ind.givenName && ind.familyName && ind.dateOfBirth);
  }

  async function submitAll() {
    setIsSubmittingAll(true);
    const pending = individuals.filter((i) => i.kycStatus === 'pending' && hasRequiredData(i));
    for (const ind of pending) {
      await submitKyc(ind.id);
    }
    setIsSubmittingAll(false);
  }

  const pendingCount = individuals.filter((i) => i.kycStatus === 'pending' && hasRequiredData(i)).length;
  const completedCount = individuals.filter((i) => ['pass', 'fail', 'refer'].includes(i.kycStatus)).length;

  if (individuals.length === 0) {
    return (
      <div>
        <Alert variant="warning">No individuals to verify. Please go back and review.</Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding/review')}>
          Back to Review
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">KYC Verification</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          Reviewing your details to complete the verification process.
          {completedCount > 0 && ` ${completedCount} of ${individuals.length} completed.`}
        </p>
      </div>

      {kycError && (
        <Alert variant="error" className="mb-4">{kycError}</Alert>
      )}

      {pendingCount > 0 && (
        <div className="mb-6">
          <Button
            size="lg"
            className="w-full"
            onClick={submitAll}
            disabled={isSubmittingAll}
          >
            {isSubmittingAll ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Verifying all individuals...
              </span>
            ) : (
              `Verify All (${pendingCount} remaining)`
            )}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {individuals.map((ind) => (
          <IndividualCard
            key={ind.id}
            individual={ind}
            actionSlot={
              ind.kycStatus === 'pending' ? (
                <div className="flex items-center gap-2">
                  <KycSubmitButton
                    individual={ind}
                    isSubmitting={submittingId === ind.id}
                    onSubmit={() => submitKyc(ind.id)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOnboardingModalIndividual(ind)}
                  >
                    Send Onboarding Link
                  </Button>
                </div>
              ) : undefined
            }
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" onClick={() => router.push('/onboarding/review')}>
          &larr; Back to Review
        </Button>
        <Button
          size="lg"
          variant="secondary"
          disabled={completedCount < individuals.length}
        >
          View Account &rarr;
        </Button>
      </div>

      {onboardingModalIndividual && (
        <SendOnboardingModal
          individual={onboardingModalIndividual}
          onClose={() => setOnboardingModalIndividual(null)}
        />
      )}
    </div>
  );
}
