/**
 * =====================================================
 * Scheduler Status Board Component
 * =====================================================
 * Grouped schedule board using accordions to organize schedules by lifecycle state
 */

import { useMemo } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Clock,
  GaugeCircle,
  MapPin,
  Package,
  Truck,
  User,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { SchedulerBatch, SchedulerBatchStatus } from '@/types/scheduler';
import type { Facility, Warehouse, Driver, Vehicle } from '@/types';
import {
  groupBatchesByStatus,
  formatDuration,
} from '@/lib/schedulerUtils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SchedulerListViewProps {
  batches: SchedulerBatch[];
  warehouses: Warehouse[];
  drivers: Driver[];
  vehicles: Vehicle[];
  facilities: Facility[];
  isLoading?: boolean;
  selectedBatchId: string | null;
  onBatchSelect: (batchId: string) => void;
  programsMap?: Record<string, string[]>;
}

const STATUS_ORDER: SchedulerBatchStatus[] = [
  'draft',
  'ready',
  'scheduled',
  'published',
  'cancelled',
];

const STATUS_PRESENTATION: Record<
  SchedulerBatchStatus,
  {
    label: string;
    dot: string;
    empty: string;
  }
> = {
  draft: {
    label: 'Draft',
    dot: 'bg-amber-500',
    empty: 'Draft schedules will appear here when teams begin planning routes.',
  },
  ready: {
    label: 'Ready',
    dot: 'bg-blue-500',
    empty: 'No ready schedules. Finalise drafts to move them into this lane.',
  },
  scheduled: {
    label: 'Scheduled',
    dot: 'bg-indigo-500',
    empty: 'Batches move here once drivers and vehicles are assigned.',
  },
  published: {
    label: 'Published',
    dot: 'bg-emerald-500',
    empty: 'Published schedules (synced with FleetOps) will appear in this lane.',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-gray-500',
    empty: 'No cancelled schedules. Withdrawn plans will live here for reference.',
  },
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return dateTimeFormatter.format(date);
}

function formatWeightKg(value?: number | null) {
  if (value == null) return '--';
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)} kg`;
}

function formatTags(tags?: string[] | null) {
  if (!tags || tags.length === 0) {
    return { display: [], remainder: 0 };
  }

  const display = tags.slice(0, 2);
  const remainder = tags.length - display.length;
  return { display, remainder };
}

export function SchedulerListView({
  batches,
  warehouses,
  drivers,
  vehicles,
  facilities,
  isLoading,
  selectedBatchId,
  onBatchSelect,
  programsMap = {},
}: SchedulerListViewProps) {
  const facilityMap = useMemo(() => {
    if (!Array.isArray(facilities)) return {};
    const entries = facilities.map((facility) => [facility.id, facility] as const);
    return Object.fromEntries(entries);
  }, [facilities]);

  const warehouseMap = useMemo(() => {
    if (!Array.isArray(warehouses)) return {};
    const entries = warehouses.map((warehouse) => [warehouse.id, warehouse] as const);
    return Object.fromEntries(entries);
  }, [warehouses]);

  const driverMap = useMemo(() => {
    if (!Array.isArray(drivers)) return {};
    const entries = drivers.map((driver) => [driver.id, driver] as const);
    return Object.fromEntries(entries);
  }, [drivers]);

  const vehicleMap = useMemo(() => {
    if (!Array.isArray(vehicles)) return {};
    const entries = vehicles.map((vehicle) => [vehicle.id, vehicle] as const);
    return Object.fromEntries(entries);
  }, [vehicles]);

  const grouped = useMemo(() => groupBatchesByStatus(batches), [batches]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="space-y-3 border-b p-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-4 gap-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-6">
      <Accordion type="multiple" defaultValue={['draft', 'ready']} className="space-y-2">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_PRESENTATION[status];
          const batchesForStatus = grouped[status] ?? [];

          return (
            <AccordionItem
              key={status}
              value={status}
              className="border rounded-md bg-white"
            >
              <AccordionTrigger
                className="px-4 py-3 hover:no-underline hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                  <span className="text-sm font-semibold text-foreground">
                    {meta.label}
                  </span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {batchesForStatus.length}
                  </Badge>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-0 pt-0 pb-0">
                {batchesForStatus.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground border-t">
                    {meta.empty}
                  </div>
                ) : (
                  <div className="divide-y">
                    {batchesForStatus.map((batch) => {
                      const isSelected = selectedBatchId === batch.id;
                      const facilityIds = batch.facility_ids || [];
                      const facilityCount = facilityIds.length;

                      const startFacility = facilityCount > 0 ? facilityMap[facilityIds[0]] : undefined;
                      const endFacility = facilityCount > 0 ? facilityMap[facilityIds[facilityCount - 1]] : undefined;
                      const extraStops = facilityCount > 2 ? facilityCount - 2 : 0;

                      const plannedDeparture = batch.planned_date ? new Date(batch.planned_date) : null;
                      const estimatedReturn =
                        plannedDeparture && batch.estimated_duration_min
                          ? new Date(
                              plannedDeparture.getTime() + batch.estimated_duration_min * 60 * 1000
                            )
                          : null;

                      const warehouse = batch.warehouse_id ? warehouseMap[batch.warehouse_id] : undefined;
                      const driver = batch.driver_id ? driverMap[batch.driver_id] : undefined;
                      const vehicle = batch.vehicle_id ? vehicleMap[batch.vehicle_id] : undefined;

                      const mergedPrograms = Array.from(
                        new Set([...(programsMap[batch.id] ?? []), ...(batch.tags ?? [])])
                      );
                      const { display: programTags, remainder: remainingPrograms } = formatTags(mergedPrograms);

                      return (
                        <div
                          key={batch.id}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/30 border-t first:border-t-0",
                            isSelected && 'bg-blue-50/50'
                          )}
                          onClick={() => onBatchSelect(batch.id)}
                        >
                          {/* Compact table-like row with 5 columns */}
                          <div className="grid grid-cols-[2fr_2fr_2fr_3fr_1.5fr] gap-0">
                            {/* Column 1: START */}
                            <div className="p-3 border-r">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {startFacility?.name || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {startFacility?.lga || '—'}
                                </p>
                                <p className="text-xs text-foreground font-medium">
                                  {plannedDeparture ? formatDateTime(plannedDeparture.toISOString()) : '—'}
                                </p>
                              </div>
                            </div>

                            {/* Column 2: END */}
                            <div className="p-3 border-r">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {endFacility?.name || 'Unknown'}
                                  {extraStops > 0 && (
                                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                      +{extraStops}
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {endFacility?.lga || '—'}
                                </p>
                                <p className="text-xs text-foreground font-medium">
                                  {estimatedReturn ? formatDateTime(estimatedReturn.toISOString()) : '—'}
                                </p>
                              </div>
                            </div>

                            {/* Column 3: CONTEXT */}
                            <div className="p-3 border-r">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {warehouse?.name || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {batch.zone || '—'}
                                </p>
                                <p className="text-xs text-foreground">
                                  {vehicle?.model || vehicle?.plateNumber || 'Vehicle TBD'} · {formatDuration(batch.estimated_duration_min)}
                                </p>
                              </div>
                            </div>

                            {/* Column 4: METRICS */}
                            <div className="p-3 border-r">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-foreground font-medium">
                                    {facilityCount || 0} facilities
                                  </span>
                                  <span className="text-foreground font-medium">
                                    {formatWeightKg(batch.total_weight_kg)}
                                  </span>
                                  <span className="text-foreground font-medium">
                                    {batch.total_consignments || 0} line items
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {facilityCount || 0} stops
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {programTags.length > 0 ? (
                                    <>
                                      {programTags.map((tag) => (
                                        <span key={tag} className="text-[10px] text-foreground">
                                          {tag}
                                        </span>
                                      ))}
                                      {remainingPrograms > 0 && (
                                        <span className="text-[10px] text-muted-foreground">
                                          +{remainingPrograms}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">No programs</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Column 5: ASSIGNEE */}
                            <div className="p-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {driver?.name || '—'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {batch.driver_id ? 'Assigned' : 'Driver'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}