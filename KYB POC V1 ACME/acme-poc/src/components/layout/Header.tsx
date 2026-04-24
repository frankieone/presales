'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding-store';

export function Header() {
  const router = useRouter();
  const { individuals, australianOwnership, reset } = useOnboardingStore();
  const [isResetting, setIsResetting] = useState(false);

  const hasState = individuals.length > 0 || !!australianOwnership;

  async function handleStartOver() {
    setIsResetting(true);

    // Collect all entity IDs to delete from FrankieOne
    const entityIds: string[] = [];
    for (const ind of individuals) {
      if (ind.ownershipEntityId) entityIds.push(ind.ownershipEntityId);
      if (ind.kycEntityId && ind.kycEntityId !== ind.ownershipEntityId) entityIds.push(ind.kycEntityId);
    }
    if (australianOwnership?.entityId) {
      entityIds.push(australianOwnership.entityId);
    }

    if (entityIds.length > 0) {
      await fetch('/api/entities/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityIds }),
      }).catch(() => {});
    }

    reset();
    setIsResetting(false);
    router.push('/onboarding');
  }

  return (
    <header className="bg-wise-navy text-white">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold">
            <span className="text-white">KYB Portal</span>
          </div>
          <div className="h-6 w-px bg-white/30" />
          <span className="text-xs text-white/70 font-medium tracking-wide uppercase">
            Business Onboarding
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasState && (
            <button
              onClick={handleStartOver}
              disabled={isResetting}
              className="text-xs text-wise-gray-300 hover:text-white border border-wise-gray-500 hover:border-wise-gray-300 rounded px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {isResetting ? 'Cleaning up...' : 'Start Over'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
