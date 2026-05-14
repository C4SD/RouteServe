/**
 * =====================================================
 * Operational Snapshot Panel
 * =====================================================
 * Displays current operational state before scheduling
 * begins — demand, fleet status, driver availability.
 * Read-only awareness; no auto-decisions.
 */

import * as React from 'react';
import { CheckCircle, AlertTriangle, Truck, Users, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export interface OperationalSnapshot {
  // Demand
  ready_requisitions: number;
  ready_facilities: number;

  // Fleet
  vehicles_available: number;
  vehicles_total: number;
  vehicles_maintenance: number;

  // Drivers
  drivers_active: number;
  drivers_total: number;
  drivers_overlap_warnings: number;
}

interface OperationalSnapshotPanelProps {
  snapshot: OperationalSnapshot;
  className?: string;
}

export function OperationalSnapshotPanel({
  snapshot,
  className,
}: OperationalSnapshotPanelProps) {
  const hasWarnings =
    snapshot.vehicles_maintenance > 0 || snapshot.drivers_overlap_warnings > 0;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              hasWarnings ? 'bg-amber-500' : 'bg-green-500'
            )}
          />
          Operational Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ready Demand */}
        <SnapshotSection
          icon={<Package className="h-3.5 w-3.5" />}
          label="Ready Demand"
          rows={[
            {
              ok: snapshot.ready_requisitions > 0,
              label: `${snapshot.ready_requisitions} requisition${snapshot.ready_requisitions !== 1 ? 's' : ''}`,
              sub: 'ready for dispatch',
            },
            {
              ok: snapshot.ready_facilities > 0,
              label: `${snapshot.ready_facilities} facilit${snapshot.ready_facilities !== 1 ? 'ies' : 'y'}`,
              sub: 'with pending orders',
            },
          ]}
        />

        <Separator />

        {/* Fleet Status */}
        <SnapshotSection
          icon={<Truck className="h-3.5 w-3.5" />}
          label="Fleet Status"
          rows={[
            {
              ok: snapshot.vehicles_available > 0,
              label: `${snapshot.vehicles_available} / ${snapshot.vehicles_total} vehicles`,
              sub: 'available',
            },
            ...(snapshot.vehicles_maintenance > 0
              ? [
                  {
                    ok: false,
                    label: `${snapshot.vehicles_maintenance} vehicle${snapshot.vehicles_maintenance !== 1 ? 's' : ''}`,
                    sub: 'in maintenance',
                    isWarning: true,
                  },
                ]
              : []),
          ]}
        />

        <Separator />

        {/* Driver Availability */}
        <SnapshotSection
          icon={<Users className="h-3.5 w-3.5" />}
          label="Driver Availability"
          rows={[
            {
              ok: snapshot.drivers_active > 0,
              label: `${snapshot.drivers_active} / ${snapshot.drivers_total} drivers`,
              sub: 'active',
            },
            ...(snapshot.drivers_overlap_warnings > 0
              ? [
                  {
                    ok: false,
                    label: `${snapshot.drivers_overlap_warnings} overlap`,
                    sub: 'schedule conflict',
                    isWarning: true,
                  },
                ]
              : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}

// =====================================================
// Sub-components
// =====================================================

interface SnapshotSectionProps {
  icon: React.ReactNode;
  label: string;
  rows: Array<{
    ok: boolean;
    label: string;
    sub: string;
    isWarning?: boolean;
  }>;
}

function SnapshotSection({ icon, label, rows }: SnapshotSectionProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            {row.isWarning ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : row.ok ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
            )}
            <span className={cn('font-medium', !row.ok && !row.isWarning && 'text-muted-foreground')}>
              {row.label}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{row.sub}</span>
        </div>
      ))}
    </div>
  );
}

export default OperationalSnapshotPanel;
