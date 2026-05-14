/**
 * =====================================================
 * Vehicle Availability Panel
 * =====================================================
 * Shows real-time operational status of fleet vehicles
 * during manual scheduling — occupancy, return ETA,
 * maintenance windows. Advisory only; no auto-decisions.
 */

import * as React from 'react';
import { Truck, AlertTriangle, WrenchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export type VehicleOperationalStatus = 'available' | 'occupied' | 'maintenance' | 'offline';

export interface VehicleAvailabilityEntry {
  vehicle_id: string;
  vehicle_label: string; // "Van 1", "Truck 2" etc.
  plate_number?: string;
  operational_status: VehicleOperationalStatus;
  /** ISO timestamp of when vehicle becomes available */
  available_after?: string | null;
  /** Human-readable note e.g. "Maintenance tomorrow" */
  status_note?: string | null;
  /** Whether this vehicle is committed to the current batch */
  is_committed?: boolean;
}

interface VehicleAvailabilityPanelProps {
  entries: VehicleAvailabilityEntry[];
  committedVehicleIds?: string[];
  className?: string;
}

const STATUS_CONFIG: Record<
  VehicleOperationalStatus,
  { dot: string; badge: string; label: string; icon: React.ReactNode }
> = {
  available: {
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-800 border-green-200',
    label: 'Available',
    icon: null,
  },
  occupied: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-800 border-red-200',
    label: 'Occupied',
    icon: null,
  },
  maintenance: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    label: 'Maintenance',
    icon: <WrenchIcon className="h-3 w-3" />,
  },
  offline: {
    dot: 'bg-muted-foreground/40',
    badge: 'bg-muted text-muted-foreground border-border',
    label: 'Offline',
    icon: null,
  },
};

function formatAvailableAfter(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffH = Math.round(diffMs / 3_600_000);

  if (diffH < 1) return 'soon';
  if (diffH < 24) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function VehicleAvailabilityPanel({
  entries,
  committedVehicleIds = [],
  className,
}: VehicleAvailabilityPanelProps) {
  if (entries.length === 0) return null;

  const available = entries.filter((e) => e.operational_status === 'available').length;
  const occupied = entries.filter((e) => e.operational_status === 'occupied').length;
  const maintenance = entries.filter((e) => e.operational_status === 'maintenance').length;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Vehicle Availability
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            {available} available
          </span>
          {occupied > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              {occupied} occupied
            </span>
          )}
          {maintenance > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              {maintenance} maintenance
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-52">
          <div className="divide-y">
            {entries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.operational_status];
              const isCommitted = committedVehicleIds.includes(entry.vehicle_id);

              return (
                <div
                  key={entry.vehicle_id}
                  className={cn(
                    'flex items-center justify-between px-4 py-2.5 text-sm',
                    isCommitted && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('shrink-0 w-2.5 h-2.5 rounded-full', cfg.dot)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{entry.vehicle_label}</span>
                        {entry.plate_number && (
                          <span className="text-xs text-muted-foreground">
                            {entry.plate_number}
                          </span>
                        )}
                        {isCommitted && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary text-primary">
                            committed
                          </Badge>
                        )}
                      </div>
                      {entry.status_note && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          {entry.operational_status === 'maintenance' && (
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                          )}
                          {entry.status_note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ml-2 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium',
                        cfg.badge
                      )}
                    >
                      {cfg.icon}
                      {entry.operational_status === 'occupied' && entry.available_after
                        ? `Free ${formatAvailableAfter(entry.available_after)}`
                        : cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default VehicleAvailabilityPanel;
