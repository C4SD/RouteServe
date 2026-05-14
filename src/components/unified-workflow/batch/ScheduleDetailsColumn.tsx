/**
 * =====================================================
 * Schedule Details Column (Right Column - Step 3)
 * =====================================================
 * Displays schedule info, route details, return ETA,
 * driver assignment, and facility list summary.
 */

import * as React from 'react';
import { addMinutes, format, parseISO } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  Route,
  User,
  Building2,
  Package,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { WorkingSetItem } from '@/types/unified-workflow';
import type { TimeWindow, Priority } from '@/types/scheduler';

interface Driver {
  id: string;
  name: string;
  phone?: string;
  status: 'available' | 'busy' | 'offline';
  licenseType?: string;
}

interface ScheduleDetailsColumnProps {
  // Schedule Info
  scheduleTitle: string | null;
  startLocationName: string | null;
  /** @deprecated use planningWindowStart/End */
  plannedDate: string | null;
  planningWindowStart?: string | null;
  planningWindowEnd?: string | null;
  timeWindow: TimeWindow | null;
  priority: Priority;

  // Route Info
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;

  // Return ETA
  /** ISO timestamp for planned departure; if set, computed return is shown */
  plannedDeparture?: string | null;

  // Driver Assignment
  selectedDriverId: string | null;
  drivers: Driver[];
  onDriverChange: (driverId: string | null) => void;

  // Facilities
  facilities: WorkingSetItem[];

  className?: string;
}

function formatPlanningWindow(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return 'Not set';
  const s = new Date(start);
  if (!end || end === start) {
    return s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const e = new Date(end);
  const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
  const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
  if (sMonth === eMonth) {
    return `${format(s, 'MMM d')} – ${format(e, 'd')}`;
  }
  return `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`;
}

function computePlannedReturn(
  departure: string,
  durationMin: number,
  bufferMin = 15
): string {
  try {
    const ret = addMinutes(parseISO(departure), durationMin + bufferMin);
    return format(ret, 'h:mma').toLowerCase();
  } catch {
    return '—';
  }
}

export function ScheduleDetailsColumn({
  scheduleTitle,
  startLocationName,
  plannedDate,
  planningWindowStart,
  planningWindowEnd,
  timeWindow,
  priority,
  totalDistanceKm,
  estimatedDurationMin,
  plannedDeparture,
  selectedDriverId,
  drivers,
  onDriverChange,
  facilities,
  className,
}: ScheduleDetailsColumnProps) {
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  // Effective planning window (fall back to plannedDate)
  const effectiveStart = planningWindowStart ?? plannedDate;
  const effectiveEnd = planningWindowEnd ?? plannedDate;

  const timeWindowLabel = React.useMemo(() => {
    switch (timeWindow) {
      case 'morning':    return 'Morning (6am – 12pm)';
      case 'afternoon':  return 'Afternoon (12pm – 6pm)';
      case 'evening':    return 'Evening (6pm – 10pm)';
      case 'all_day':    return 'All Day';
      default:           return 'Not set';
    }
  }, [timeWindow]);

  const durationLabel = React.useMemo(() => {
    if (!estimatedDurationMin) return '-';
    const h = Math.floor(estimatedDurationMin / 60);
    const m = estimatedDurationMin % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }, [estimatedDurationMin]);

  const planningWindowLabel = formatPlanningWindow(effectiveStart, effectiveEnd);

  const returnETA = React.useMemo(() => {
    if (!plannedDeparture || !estimatedDurationMin) return null;
    return computePlannedReturn(plannedDeparture, estimatedDurationMin);
  }, [plannedDeparture, estimatedDurationMin]);

  const departureLabel = React.useMemo(() => {
    if (!plannedDeparture) return null;
    try {
      return format(parseISO(plannedDeparture), 'h:mma').toLowerCase();
    } catch {
      return null;
    }
  }, [plannedDeparture]);

  const availableDrivers   = drivers.filter((d) => d.status === 'available');
  const unavailableDrivers = drivers.filter((d) => d.status !== 'available');

  const totals = React.useMemo(() => ({
    facilities: facilities.length,
    slots:  facilities.reduce((s, f) => s + (f.slot_demand || 0), 0),
    weight: facilities.reduce((s, f) => s + (f.weight_kg || 0), 0),
  }), [facilities]);

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-4 p-4">
        {/* Schedule Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Title"          value={scheduleTitle || 'Untitled'} />
            <DetailRow
              label="Start Location"
              value={startLocationName || 'Not set'}
              icon={<Building2 className="h-3 w-3" />}
            />
            <DetailRow
              label="Planning Window"
              value={planningWindowLabel}
              icon={<Calendar className="h-3 w-3" />}
            />
            <DetailRow
              label="Time Window"
              value={timeWindowLabel}
              icon={<Clock className="h-3 w-3" />}
            />
            <DetailRow
              label="Priority"
              value={
                <Badge
                  variant={
                    priority === 'urgent' ? 'destructive'
                    : priority === 'high'  ? 'default'
                    : 'secondary'
                  }
                  className="text-xs"
                >
                  {priority}
                </Badge>
              }
            />
          </CardContent>
        </Card>

        {/* Route + Return ETA */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Route className="h-4 w-4" />
              Route Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="text-sm font-semibold">
                  {totalDistanceKm ? `${totalDistanceKm.toFixed(1)} km` : '—'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold">{durationLabel}</p>
              </div>
            </div>

            {/* Return ETA section */}
            {(departureLabel || returnETA) && (
              <div className="rounded-lg border border-dashed px-3 py-2 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Departure / Return ETA
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Departure</span>
                  <span className="font-medium">{departureLabel ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Est. Return</span>
                  <span className="font-medium text-green-700">{returnETA ?? '—'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Driver Assignment */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Driver Assignment
            </CardTitle>
            <CardDescription className="text-xs">
              Optional — can be assigned later
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedDriverId || 'none'}
              onValueChange={(value) => onDriverChange(value === 'none' ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select driver...">
                  {selectedDriver ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{selectedDriver.name}</span>
                    </div>
                  ) : (
                    'No driver assigned'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No driver</span>
                </SelectItem>
                {availableDrivers.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Available
                    </div>
                    {availableDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span>{driver.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                {unavailableDrivers.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground mt-2">
                      Unavailable
                    </div>
                    {unavailableDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id} disabled>
                        <div className="flex items-center gap-2 opacity-50">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                          <span>{driver.name}</span>
                          <Badge variant="outline" className="text-xs ml-2">
                            {driver.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Facility Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Facilities
            </CardTitle>
            <CardDescription className="text-xs">
              {totals.facilities} stops • {totals.slots} slots
            </CardDescription>
          </CardHeader>
          <CardContent>
            {facilities.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No facilities in schedule</p>
              </div>
            ) : (
              <div className="space-y-2">
                {facilities.slice(0, 5).map((facility, idx) => (
                  <div key={facility.facility_id} className="flex items-center gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="truncate flex-1">{facility.facility_name}</span>
                    <Badge variant="outline" className="text-xs px-1">
                      {facility.slot_demand}
                    </Badge>
                  </div>
                ))}
                {facilities.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{facilities.length - 5} more facilities
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

// =====================================================
// Sub-components
// =====================================================

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function DetailRow({ label, value, icon }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default ScheduleDetailsColumn;
