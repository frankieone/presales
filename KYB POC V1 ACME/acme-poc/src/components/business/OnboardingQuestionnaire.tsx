'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboarding-store';

const QUESTIONS = [
  {
    key: 'employeeCount' as const,
    label: 'How many employees does this business have?',
    options: ['1-10', '11-50', '51-200', '200+'],
  },
  {
    key: 'referralSource' as const,
    label: 'How did you hear about us?',
    options: ['Google', 'Referral', 'Social media', 'Other'],
  },
  {
    key: 'businessPurpose' as const,
    label: 'Primary purpose of opening an account?',
    options: ['Pay suppliers', 'Receive payments', 'FX conversion', 'Other'],
  },
  {
    key: 'expectedVolume' as const,
    label: 'Expected monthly transaction volume?',
    options: ['Under $10k', '$10k-$50k', '$50k-$250k', '$250k+'],
  },
];

export function OnboardingQuestionnaire() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const setBusinessQuestionnaire = useOnboardingStore((s) => s.setBusinessQuestionnaire);
  const questionnaire = useOnboardingStore((s) => s.businessQuestionnaire);
  const selectedBusiness = useOnboardingStore((s) => s.selectedBusiness);
  const setIsSearching = useOnboardingStore((s) => s.setIsSearching);

  const resultsReady = selectedBusiness !== null;
  const isComplete = currentStep >= QUESTIONS.length;

  const handleContinue = useCallback(() => {
    setIsSearching(false);
    router.push('/onboarding/review');
  }, [setIsSearching, router]);

  // When results arrive after user finished all questions, just show the button — no auto-navigate

  function handleSelect(key: (typeof QUESTIONS)[number]['key'], value: string) {
    setBusinessQuestionnaire({ [key]: value });
    setCurrentStep((prev) => prev + 1);
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div
        className={`flex items-center gap-3 rounded-lg px-4 py-3 border transition-colors ${
          resultsReady
            ? 'bg-green-50 border-green-200'
            : 'bg-blue-50 border-blue-200'
        }`}
      >
        {resultsReady ? (
          <>
            <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-700">Business found!</span>
          </>
        ) : (
          <>
            <Spinner size="sm" />
            <span className="text-sm font-medium text-blue-700">
              Looking up business ownership...
            </span>
          </>
        )}
      </div>

      {/* Question steps */}
      {!isComplete ? (
        <div className="space-y-4">
          {/* Step dots */}
          <div className="flex items-center gap-1.5 justify-center">
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i < currentStep
                    ? 'w-6 bg-wise-green'
                    : i === currentStep
                      ? 'w-6 bg-wise-navy'
                      : 'w-1.5 bg-wise-gray-200'
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-wise-gray-500 text-center">
            Question {currentStep + 1} of {QUESTIONS.length} — while we look up the business
          </p>

          <div>
            <h3 className="text-sm font-semibold text-wise-navy mb-3">
              {QUESTIONS[currentStep].label}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {QUESTIONS[currentStep].options.map((option) => {
                const isSelected = questionnaire[QUESTIONS[currentStep].key] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(QUESTIONS[currentStep].key, option)}
                    className={`px-4 py-2.5 text-sm rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'bg-wise-green/20 border-wise-green text-wise-navy font-medium'
                        : 'bg-white border-wise-gray-200 text-wise-gray-600 hover:border-wise-green hover:bg-wise-green/5'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skip to results when ready */}
          {resultsReady && (
            <button
              type="button"
              onClick={handleContinue}
              className="w-full text-center text-xs text-wise-green font-medium hover:underline pt-1"
            >
              Skip to results &rarr;
            </button>
          )}
        </div>
      ) : resultsReady ? (
        /* All done AND results ready */
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-wise-navy">All done!</p>
          <Button size="lg" className="w-full" onClick={handleContinue}>
            View Results
          </Button>
        </div>
      ) : (
        /* All done, waiting for API */
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-wise-navy">All done!</p>
          <div className="flex items-center gap-2 text-wise-gray-500">
            <Spinner size="sm" />
            <span className="text-xs">Waiting for results...</span>
          </div>
        </div>
      )}
    </div>
  );
}
