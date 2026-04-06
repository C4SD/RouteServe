/**
 * VLMS Vehicle Onboarding - Main Wizard Component
 * Multi-step wizard for onboarding new vehicles
 */

import React, { useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { VehicleCategoryStep } from './VehicleCategoryStep';
import { VehicleTypeConfigStep } from './VehicleTypeConfigStep';
import { VehicleOnboardSummary } from './VehicleOnboardSummary';
import { useVehicleOnboardState } from '@/hooks/useVehicleOnboardState';
import { ONBOARDING_STEPS } from '@/types/vlms-onboarding';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface VehicleOnboardWizardProps {
  onClose?: () => void;
}

export function VehicleOnboardWizard({ onClose }: VehicleOnboardWizardProps = {}) {
  const currentStep = useVehicleOnboardState((state) => state.currentStep);
  const reset = useVehicleOnboardState((state) => state.reset);

  // Reset wizard on mount
  useEffect(() => {
    reset();
  }, [reset]);

  const currentStepIndex = ONBOARDING_STEPS.findIndex((step) => step.id === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 'category':
        return <VehicleCategoryStep />;
      case 'type':
      case 'capacity':
      case 'registration':
        return <VehicleTypeConfigStep />;
      case 'review':
        return <VehicleOnboardSummary />;
      default:
        return <VehicleCategoryStep />;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Step progress strip */}
      <div className="space-y-2">
        <Progress value={progressPercentage} className="h-1.5" />

        <div className="flex items-center gap-1.5">
          {ONBOARDING_STEPS.map((step, index) => {
            const Icon = LucideIcons[step.icon as keyof typeof LucideIcons] as React.ElementType;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all flex-1 text-xs',
                  isActive && 'bg-foreground text-background font-medium',
                  isCompleted && 'bg-muted text-muted-foreground',
                  !isActive && !isCompleted && 'bg-muted/50 text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {renderStepContent()}
    </div>
  );
}
