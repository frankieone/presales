'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { StepIndicator } from '@/components/ui/StepIndicator';

const STEPS = [
  { label: 'Search', href: '/onboarding' },
  { label: 'Select', href: '/onboarding/results' },
  { label: 'Review', href: '/onboarding/review' },
  { label: 'Verify', href: '/onboarding/kyc' },
  { label: 'Results', href: '/onboarding/dashboard' },
];

function getStepIndex(pathname: string): number {
  if (pathname === '/onboarding') return 0;
  if (pathname === '/onboarding/results') return 1;
  if (pathname === '/onboarding/review') return 2;
  if (pathname === '/onboarding/kyc') return 3;
  if (pathname === '/onboarding/dashboard') return 4;
  return 0;
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentStep = getStepIndex(pathname);

  return (
    <>
      <Header />
      <div className="bg-white border-b border-wise-gray-200 py-4">
        <div className="max-w-5xl mx-auto px-4">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>
      </div>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {children}
      </main>
      <Footer />
    </>
  );
}
