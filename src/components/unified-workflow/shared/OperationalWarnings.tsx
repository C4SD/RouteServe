/**
 * =====================================================
 * Operational Warnings Panel
 * =====================================================
 * Shows advisory-only warnings about operational
 * infeasibilities. Manual override always allowed —
 * these are informational, not blockers.
 */

import * as React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type OperationalWarningSeverity = 'warning' | 'info';

export interface OperationalWarning {
  id: string;
  severity: OperationalWarningSeverity;
  message: string;
  detail?: string;
}

interface OperationalWarningsPanelProps {
  warnings: OperationalWarning[];
  onDismiss?: (id: string) => void;
  className?: string;
}

export function OperationalWarningsPanel({
  warnings,
  onDismiss,
  className,
}: OperationalWarningsPanelProps) {
  if (warnings.length === 0) return null;

  return (
    <div className={cn('space-y-1.5', className)}>
      {warnings.map((w) => (
        <WarningItem key={w.id} warning={w} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function WarningItem({
  warning,
  onDismiss,
}: {
  warning: OperationalWarning;
  onDismiss?: (id: string) => void;
}) {
  const isWarning = warning.severity === 'warning';

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
        isWarning
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-blue-200 bg-blue-50 text-blue-900'
      )}
    >
      {isWarning ? (
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
      ) : (
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-snug">{warning.message}</p>
        {warning.detail && (
          <p className="mt-0.5 text-xs opacity-80 leading-snug">{warning.detail}</p>
        )}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 opacity-60 hover:opacity-100 shrink-0"
          onClick={() => onDismiss(warning.id)}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}
    </div>
  );
}

// =====================================================
// Warning builder helpers
// =====================================================

export function buildOperationalWarnings({
  estimatedDurationMin,
  shiftLimitMin = 480,
  vehicleIds,
  vehicleStatuses = {},
  planningWindowStart,
  planningWindowEnd,
}: {
  estimatedDurationMin: number | null;
  shiftLimitMin?: number;
  vehicleIds: string[];
  vehicleStatuses?: Record<string, 'available' | 'occupied' | 'maintenance' | 'offline'>;
  planningWindowStart?: string | null;
  planningWindowEnd?: string | null;
}): OperationalWarning[] {
  const warnings: OperationalWarning[] = [];

  // Driver shift warning
  if (estimatedDurationMin && estimatedDurationMin > shiftLimitMin) {
    const overBy = Math.round(estimatedDurationMin - shiftLimitMin);
    warnings.push({
      id: 'shift-exceeded',
      severity: 'warning',
      message: 'Route exceeds standard driver shift',
      detail: `Estimated duration is ${overBy} min over the ${Math.round(shiftLimitMin / 60)}h shift limit. Consider splitting into multiple runs.`,
    });
  }

  // Maintenance conflict
  const maintenanceVehicles = vehicleIds.filter(
    (id) => vehicleStatuses[id] === 'maintenance'
  );
  if (maintenanceVehicles.length > 0) {
    warnings.push({
      id: 'vehicle-maintenance',
      severity: 'warning',
      message: `${maintenanceVehicles.length} committed vehicle${maintenanceVehicles.length > 1 ? 's' : ''} flagged for maintenance`,
      detail: 'Verify maintenance schedule before dispatching.',
    });
  }

  // Occupied vehicle
  const occupiedVehicles = vehicleIds.filter(
    (id) => vehicleStatuses[id] === 'occupied'
  );
  if (occupiedVehicles.length > 0) {
    warnings.push({
      id: 'vehicle-occupied',
      severity: 'warning',
      message: `${occupiedVehicles.length} committed vehicle${occupiedVehicles.length > 1 ? 's are' : ' is'} currently occupied`,
      detail: 'Check return ETA before scheduling departure.',
    });
  }

  // Single-day window info
  if (
    planningWindowStart &&
    (!planningWindowEnd || planningWindowEnd === planningWindowStart)
  ) {
    warnings.push({
      id: 'single-day-window',
      severity: 'info',
      message: 'Planning window is a single day',
      detail: 'Consider setting an end date to allow flexible execution if conditions change.',
    });
  }

  return warnings;
}

export default OperationalWarningsPanel;
