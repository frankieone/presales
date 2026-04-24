'use client';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Individual } from '@/types/individual';

interface KycSubmitButtonProps {
  individual: Individual;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function KycSubmitButton({ individual, isSubmitting, onSubmit }: KycSubmitButtonProps) {
  const isMissingRequired = !individual.givenName || !individual.familyName || !individual.dateOfBirth;

  const isDisabled =
    isSubmitting ||
    isMissingRequired ||
    individual.kycStatus === 'submitted' ||
    individual.kycStatus === 'pass' ||
    individual.kycStatus === 'fail' ||
    individual.kycStatus === 'refer';

  const fullName = [individual.givenName, individual.middleName, individual.familyName]
    .filter(Boolean)
    .join(' ');

  return (
    <Button
      size="sm"
      variant={individual.kycStatus === 'pending' ? 'primary' : 'outline'}
      disabled={isDisabled}
      onClick={onSubmit}
    >
      {isSubmitting ? (
        <span className="flex items-center gap-2">
          <Spinner size="sm" /> Verifying...
        </span>
      ) : individual.kycStatus === 'pending' ? (
        `Verify ${fullName}`
      ) : (
        individual.kycStatus.toUpperCase()
      )}
    </Button>
  );
}
