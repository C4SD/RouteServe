import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { ONBOARDING_STEPS } from '@/types/onboarding';
import type { OnboardingWizardStep } from '@/types/onboarding';

interface OnboardingStepperSidebarProps {
  currentStep: OnboardingWizardStep;
  completedSteps: OnboardingWizardStep[];
  onStepClick?: (step: OnboardingWizardStep) => void;
}

export default function OnboardingStepperSidebar({
  currentStep,
  completedSteps,
  onStepClick,
}: OnboardingStepperSidebarProps) {
  const currentIndex = ONBOARDING_STEPS.findIndex(s => s.key === currentStep);
  const totalSteps = ONBOARDING_STEPS.length;
  const completedCount = completedSteps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="w-72 min-h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-white">
          RouteServe<span className="text-emerald-400">.</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Workspace Setup</p>
      </div>

      {/* Progress */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <nav className="flex-1 px-6 py-4">
        <ul className="space-y-1">
          {ONBOARDING_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.key);
            const isCurrent = step.key === currentStep;
            const isPast = index < currentIndex;
            const canClick = isCompleted || isPast;

            return (
              <li key={step.key}>
                <button
                  onClick={() => canClick && onStepClick?.(step.key)}
                  disabled={!canClick}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors',
                    isCurrent && 'bg-zinc-900',
                    canClick && !isCurrent && 'hover:bg-zinc-900/50 cursor-pointer',
                    !canClick && !isCurrent && 'cursor-default'
                  )}
                >
                  {/* Step circle */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white">{index + 1}</span>
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full border-2 border-zinc-700 flex items-center justify-center">
                        <span className="text-xs font-semibold text-zinc-600">{index + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isCurrent ? 'text-white' : isCompleted ? 'text-zinc-300' : 'text-zinc-500'
                        )}
                      >
                        {step.label}
                      </span>
                      {step.optional && (
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        isCurrent ? 'text-zinc-400' : 'text-zinc-600'
                      )}
                    >
                      {step.description}
                    </p>
                  </div>
                </button>

                {/* Connector line */}
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div className="ml-[22px] h-4 w-px bg-zinc-800" />
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          You can complete optional steps later from Settings.
        </p>
      </div>
    </div>
  );
}
