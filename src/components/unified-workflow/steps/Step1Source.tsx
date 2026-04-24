/**
 * =====================================================
 * Step 1: Source Selection
 * =====================================================
 * User selects the source method for the schedule:
 * - Ready Consignments (with sub-options: Manual/AI)
 * - Upload File
 * - Manual Entry
 */

import * as React from 'react';
import {
  ListChecks,
  FileUp,
  PlusCircle,
  Hand,
  Brain,
  ChevronRight,
  Check,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { SourceMethod, SourceSubOption } from '@/types/unified-workflow';

interface Step1SourceProps {
  sourceMethod: SourceMethod | null;
  sourceSubOption: SourceSubOption | null;
  onSourceMethodChange: (method: SourceMethod) => void;
  onSourceSubOptionChange: (option: SourceSubOption) => void;
}

interface SourceOption {
  id: SourceMethod;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  hasSubOptions?: boolean;
}

const sourceOptions: SourceOption[] = [
  {
    id: 'service_policy',
    title: 'Service Policy',
    description: 'Schedule from a policy cluster — pre-defined facility groups for a service area',
    icon: Network,
    badge: 'Primary',
  },
  {
    id: 'ready',
    title: 'Ready Consignments',
    description: 'Select from confirmed facility orders ready for dispatch',
    icon: ListChecks,
    hasSubOptions: true,
  },
  {
    id: 'upload',
    title: 'Upload File',
    description: 'Import facilities from PDF, CSV, XLSX, or DOCX file',
    icon: FileUp,
  },
  {
    id: 'manual',
    title: 'Manual Entry',
    description: 'Select facilities manually from the database',
    icon: PlusCircle,
  },
];

interface SubOption {
  id: SourceSubOption;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
}

const subOptions: SubOption[] = [
  {
    id: 'manual_scheduling',
    title: 'Manual Scheduling',
    description: 'Manually select and order facilities',
    icon: Hand,
    features: [
      'Full control over facility selection',
      'Drag-and-drop reordering',
      'Vehicle suggestion (optional)',
    ],
  },
  {
    id: 'ai_optimization',
    title: 'AI Optimization',
    description: 'Let AI optimize your route and schedule',
    icon: Brain,
    features: [
      'Automatic route optimization',
      'Smart facility grouping',
      'Constraint-based planning',
    ],
  },
];

export function Step1Source({
  sourceMethod,
  sourceSubOption,
  onSourceMethodChange,
  onSourceSubOptionChange,
}: Step1SourceProps) {
  const selectedSource = sourceOptions.find((opt) => opt.id === sourceMethod);
  const showSubOptions = sourceMethod === 'ready';
  const showPolicyNote = sourceMethod === 'service_policy';

  return (
    <div className="flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Select Source</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose how you want to create your schedule
        </p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        {/* Source Method Cards */}
        <div className="flex-1 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Data Source
          </h3>
          {sourceOptions.map((option) => (
            <SourceCard
              key={option.id}
              option={option}
              isSelected={sourceMethod === option.id}
              onClick={() => onSourceMethodChange(option.id)}
            />
          ))}
        </div>

        {/* Sub-options (only for Ready Consignments) */}
        {showSubOptions && (
          <div className="flex-1 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Scheduling Method
            </h3>
            {subOptions.map((option) => (
              <SubOptionCard
                key={option.id}
                option={option}
                isSelected={sourceSubOption === option.id}
                onClick={() => onSourceSubOptionChange(option.id)}
              />
            ))}
          </div>
        )}

        {/* Policy note panel */}
        {showPolicyNote && (
          <div className="flex-1 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              How it works
            </h3>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm text-muted-foreground">
              {[
                'Select a Service Area and its active Policy',
                'Pick a Cluster (Z1, Z2…) to auto-load its facilities',
                'Attach demand: ready consignments or manual override',
                'Assign a route and schedule the delivery date',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {sourceMethod && (
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-primary" />
            <span className="font-medium">Selected:</span>
            <span>{selectedSource?.title}</span>
            {sourceSubOption && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span>
                  {subOptions.find((o) => o.id === sourceSubOption)?.title}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Source Card Sub-component
// =====================================================

interface SourceCardProps {
  option: SourceOption;
  isSelected: boolean;
  onClick: () => void;
}

function SourceCard({ option, isSelected, onClick }: SourceCardProps) {
  const Icon = option.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-primary/50 hover:bg-accent/50'
      )}
    >
      {/* Selection Indicator */}
      <div
        className={cn(
          'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center',
          isSelected
            ? 'border-primary bg-primary'
            : 'border-muted-foreground/30'
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          isSelected ? 'bg-primary/10' : 'bg-muted'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            isSelected ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{option.title}</p>
          {option.badge && (
            <Badge variant="secondary" className="text-xs">
              {option.badge}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {option.description}
        </p>
      </div>

      {/* Arrow for sub-options */}
      {option.hasSubOptions && isSelected && (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

// =====================================================
// Sub-option Card Sub-component
// =====================================================

interface SubOptionCardProps {
  option: SubOption;
  isSelected: boolean;
  onClick: () => void;
}

function SubOptionCard({ option, isSelected, onClick }: SubOptionCardProps) {
  const Icon = option.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-3 p-4 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-primary/50 hover:bg-accent/50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Selection Indicator */}
        <div
          className={cn(
            'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center',
            isSelected
              ? 'border-primary bg-primary'
              : 'border-muted-foreground/30'
          )}
        >
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>

        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            isSelected ? 'bg-primary/10' : 'bg-muted'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5',
              isSelected ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium">{option.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {option.description}
          </p>
        </div>
      </div>

      {/* Features List */}
      {isSelected && (
        <div className="ml-9 pl-4 border-l-2 border-primary/30 space-y-1">
          {option.features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <Check className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">{feature}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Step1Source;
