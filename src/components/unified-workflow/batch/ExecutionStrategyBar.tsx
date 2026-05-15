/**
 * =====================================================
 * Execution Strategy Bar — Step 5 Batch
 * =====================================================
 * Lightweight top-level orchestration bar above the
 * 3-column layout. Lets users configure how facilities
 * cluster and how execution is phased.
 *
 * IMPORTANT: This is advisory config, NOT auto-dispatch.
 * Users still manually assign vehicles and approve plans.
 */

import * as React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Truck,
  Clock,
  Timer,
  CornerDownLeft,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type {
  ExecutionEngineConfig,
  ClusteringStrategy,
  ExecutionStrategy,
  ReturnToBaseBuffer,
} from '@/types/unified-workflow';

interface ExecutionStrategyBarProps {
  config: ExecutionEngineConfig;
  onConfigChange: (updates: Partial<ExecutionEngineConfig>) => void;
  vehiclesAvailable: number;
  vehiclesTotal: number;
  className?: string;
}

const CLUSTERING_OPTIONS: { value: ClusteringStrategy; label: string }[] = [
  { value: 'geographic_proximity', label: 'Geographic Proximity' },
  { value: 'balanced_workload',    label: 'Balanced Workload' },
  { value: 'sla_priority',         label: 'SLA Priority' },
];

const EXECUTION_OPTIONS: { value: ExecutionStrategy; label: string }[] = [
  { value: 'maximize_vehicle_reuse',     label: 'Maximize Vehicle Reuse' },
  { value: 'fastest_completion',         label: 'Fastest Completion' },
  { value: 'minimize_operational_days',  label: 'Minimize Operational Days' },
  { value: 'balance_fleet_utilization',  label: 'Balance Fleet Utilization' },
];

const RETURN_BUFFER_OPTIONS: { value: ReturnToBaseBuffer; label: string }[] = [
  { value: 'immediate', label: 'Immediate Return' },
  { value: 'half_day',  label: 'Half Day' },
  { value: 'next_day',  label: 'Next Day' },
];

export function ExecutionStrategyBar({
  config,
  onConfigChange,
  vehiclesAvailable,
  vehiclesTotal,
  className,
}: ExecutionStrategyBarProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className={cn('border-b bg-muted/20', className)}>
      {/* Main bar */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Section label */}
          <div className="flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Execution Strategy
            </p>
            <p className="text-[10px] text-muted-foreground">
              Configure how facilities should be clustered and executed.
            </p>
          </div>

          <Separator orientation="vertical" className="h-8 hidden md:block" />

          {/* Clustering Strategy */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <Label className="text-[10px] text-muted-foreground font-medium">
              Clustering Strategy
            </Label>
            <Select
              value={config.clustering_strategy}
              onValueChange={v => onConfigChange({ clustering_strategy: v as ClusteringStrategy })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLUSTERING_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Execution Strategy */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <Label className="text-[10px] text-muted-foreground font-medium">
              Execution Strategy
            </Label>
            <Select
              value={config.execution_strategy}
              onValueChange={v => onConfigChange({ execution_strategy: v as ExecutionStrategy })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXECUTION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicles Available */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground font-medium">
              Vehicles Available
            </Label>
            <div className="h-8 flex items-center gap-2 px-2 rounded-md border bg-background text-xs">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{vehiclesAvailable}</span>
              <span className="text-muted-foreground">of {vehiclesTotal}</span>
            </div>
          </div>

          {/* Working Hours */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground font-medium">
              Working Hours
            </Label>
            <div className="h-8 flex items-center gap-1.5 px-2 rounded-md border bg-background text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{formatTime(config.working_hours_start)}</span>
              <span className="text-muted-foreground">→</span>
              <span>{formatTime(config.working_hours_end)}</span>
            </div>
          </div>

          {/* Service Buffer */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground font-medium">
              Service Buffer
            </Label>
            <div className="h-8 flex items-center gap-1.5 px-2 rounded-md border bg-background text-xs">
              <Timer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{config.service_buffer_min} mins</span>
            </div>
          </div>

          {/* More Options toggle */}
          <div className="ml-auto flex flex-col gap-1">
            <Label className="text-[10px] text-transparent">-</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-primary"
              onClick={() => setExpanded(v => !v)}
            >
              More Options
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-3 border-t pt-3 bg-muted/10">
          <div className="flex flex-wrap gap-6">
            {/* Return-to-Base Buffer */}
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <CornerDownLeft className="h-3.5 w-3.5" />
                Return-to-Base Buffer
              </Label>
              <Select
                value={config.return_buffer}
                onValueChange={v => onConfigChange({ return_buffer: v as ReturnToBaseBuffer })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_BUFFER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="h-16 hidden md:block self-center" />

            {/* Operational Constraints */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium">Operational Constraints</Label>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <ConstraintCheckbox
                  id="allow_multi_day"
                  label="Allow Multi-Day Execution"
                  checked={config.allow_multi_day}
                  onChange={v => onConfigChange({ allow_multi_day: v })}
                />
                <ConstraintCheckbox
                  id="allow_same_day_reuse"
                  label="Allow Same-Day Vehicle Reuse"
                  checked={config.allow_same_day_reuse}
                  onChange={v => onConfigChange({ allow_same_day_reuse: v })}
                />
                <ConstraintCheckbox
                  id="respect_facility_hours"
                  label="Respect Facility Working Hours"
                  checked={config.respect_facility_hours}
                  onChange={v => onConfigChange({ respect_facility_hours: v })}
                />
                <ConstraintCheckbox
                  id="respect_driver_shift"
                  label="Respect Driver Shift Duration"
                  checked={config.respect_driver_shift}
                  onChange={v => onConfigChange({ respect_driver_shift: v })}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================

function ConstraintCheckbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={v => onChange(!!v)}
        className="h-3.5 w-3.5"
      />
      <Label htmlFor={id} className="text-xs cursor-pointer font-normal">
        {label}
      </Label>
    </div>
  );
}

function formatTime(timeStr: string): string {
  const [h = 0, m = 0] = timeStr.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default ExecutionStrategyBar;
