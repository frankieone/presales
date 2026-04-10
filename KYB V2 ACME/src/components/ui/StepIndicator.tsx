'use client';

interface Step {
  label: string;
  href: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;

        return (
          <div key={step.label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                  isCompleted
                    ? 'bg-wise-green text-wise-navy'
                    : isCurrent
                    ? 'bg-wise-navy text-white'
                    : 'bg-wise-gray-200 text-wise-gray-500'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`hidden sm:inline text-xs font-medium ${
                  isCurrent ? 'text-wise-navy' : 'text-wise-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 ${
                  isCompleted ? 'bg-wise-green' : 'bg-wise-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
