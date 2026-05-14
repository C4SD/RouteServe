import * as React from 'react';
import { Bot, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ScheduleMode } from '@/types/unified-workflow';

interface StepScheduleModeProps {
  scheduleMode: ScheduleMode | null;
  onScheduleModeChange: (mode: ScheduleMode) => void;
}

interface ModeOption {
  id: ScheduleMode;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
}

const modeOptions: ModeOption[] = [
  {
    id: 'manual',
    title: 'Manual Scheduling',
    description:
      'Build your dispatch schedule step by step — choose your source, select facilities, configure batches, and optimise routes.',
    icon: SlidersHorizontal,
    badge: 'Standard',
    badgeVariant: 'secondary',
  },
  {
    id: 'copilot',
    title: 'Scheduling Copilot',
    description:
      'Define what needs to happen — the copilot analyses demand, constraints, and resource availability to generate a feasible execution plan for your review.',
    icon: Bot,
    badge: 'Beta',
    badgeVariant: 'default',
  },
];

export function StepScheduleMode({
  scheduleMode,
  onScheduleModeChange,
}: StepScheduleModeProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">How would you like to schedule?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose whether to configure the dispatch schedule manually or use the AI copilot.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = scheduleMode === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onScheduleModeChange(option.id)}
              className={cn(
                'relative flex flex-col gap-3 rounded-lg border-2 p-5 text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {option.badge && (
                  <Badge variant={option.badgeVariant ?? 'secondary'} className="text-xs">
                    {option.badge}
                  </Badge>
                )}
              </div>

              <div>
                <p className="font-medium text-sm">{option.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {option.description}
                </p>
              </div>

              {isSelected && (
                <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
