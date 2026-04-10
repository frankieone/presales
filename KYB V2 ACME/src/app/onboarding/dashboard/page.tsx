'use client';

import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';
import { KycDashboard } from '@/components/kyc/KycDashboard';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function DashboardPage() {
  const router = useRouter();
  const { selectedBusiness, businessProfile, australianOwnership, individuals, kycResults, reset } = useOnboardingStore();

  const businessName = businessProfile?.name || australianOwnership?.businessDetails?.registeredName || selectedBusiness?.name || 'Unknown Business';

  if (individuals.length === 0) {
    return (
      <div>
        <Alert variant="warning">No verification data available. Please complete the verification process first.</Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/onboarding')}>
          Start Over
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-wise-navy">Verification Dashboard</h1>
        <p className="text-sm text-wise-gray-500 mt-1">
          KYC/AML results for <span className="font-medium text-wise-navy">{businessName}</span>
        </p>
      </div>

      <KycDashboard />

      {kycResults.size < individuals.length && (
        <Alert variant="info" className="mt-6">
          {individuals.length - kycResults.size} individual(s) have not been verified yet.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => router.push('/onboarding/kyc')}>
            Go to Verification
          </Button>
        </Alert>
      )}

      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" onClick={() => router.push('/onboarding/kyc')}>
          &larr; Back to Verification
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            reset();
            router.push('/onboarding');
          }}
        >
          Start New Onboarding
        </Button>
      </div>
    </div>
  );
}
