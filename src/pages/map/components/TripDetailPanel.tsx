/**
 * TripDetailPanel - Horizontal pop-out panel showing trip details for a vehicle/driver.
 * Slots between the LiveFilterPanel and the map, matching the fleet-management reference design.
 */

import { useMemo } from 'react';
import {
  X, Truck, User, Package, CalendarDays, Clock, MapPin,
  CheckCircle2, AlertTriangle, Navigation, Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TripDetailPanelProps {
  batchId: string | null;
  vehicleLabel?: string;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(raw: string | null | undefined) {
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(raw: string | null | undefined) {
  if (!raw) return null;
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(raw));
}

const STOP_TYPE_LABEL: Record<number, string> = {};
function stopTypeLabel(idx: number, total: number) {
  if (idx === 0) return 'DEPARTURE';
  if (idx === total - 1) return 'DESTINATION';
  return `LOCATION ${idx}`;
}

const STATUS_CFG: Record<string, { label: string; className: string }> = {
  'in-progress': { label: 'Driving',   className: 'bg-emerald-500 text-white' },
  assigned:      { label: 'Assigned',  className: 'bg-blue-500 text-white' },
  completed:     { label: 'Completed', className: 'bg-gray-400 text-white' },
  pending:       { label: 'Pending',   className: 'bg-amber-500 text-white' },
};

// ── Empty / no-batch state ────────────────────────────────────────────────────

function NoBatch({ vehicleLabel, onClose }: { vehicleLabel?: string; onClose: () => void }) {
  return (
    <div className="w-72 border-l bg-card flex flex-col h-full shadow-lg">
      <PanelHeader title="Trip Details" vehicleLabel={vehicleLabel} status={null} onClose={onClose} />
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No active trip</p>
        <p className="text-xs text-muted-foreground">This vehicle has no assigned batch right now.</p>
      </div>
    </div>
  );
}

// ── Panel header shared ───────────────────────────────────────────────────────

function PanelHeader({
  title, vehicleLabel, status, onClose,
}: { title: string; vehicleLabel?: string; status: string | null; onClose: () => void }) {
  const sc = status ? (STATUS_CFG[status] ?? STATUS_CFG['pending']) : null;
  return (
    <div className="px-4 py-3 border-b bg-muted/20 shrink-0">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {vehicleLabel && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-base leading-tight">{vehicleLabel}</span>
          {sc && (
            <Badge className={cn('text-[10px] h-4 px-1.5', sc.className)}>
              {sc.label}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TripDetailPanel({ batchId, vehicleLabel, onClose }: TripDetailPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['trip-detail-panel', batchId],
    queryFn: async () => {
      const { data: batch } = await supabase
        .from('delivery_batches')
        .select(`
          id, name, status, facility_ids, optimized_route, current_stop_index,
          created_at, scheduled_date, started_at,
          driver:drivers!delivery_batches_driver_id_fkey(id, name, phone),
          warehouse:warehouses(id, name, address)
        `)
        .eq('id', batchId!)
        .single();
      if (!batch) return null;

      const facilityIds: string[] = (batch as any).facility_ids || [];
      let facilities: { id: string; name: string; address: string | null }[] = [];
      if (facilityIds.length > 0) {
        const { data: facs } = await supabase
          .from('facilities')
          .select('id, name, address')
          .in('id', facilityIds);
        facilities = facs || [];
      }
      return { ...(batch as any), facilities };
    },
    enabled: !!batchId,
    staleTime: 30000,
  });

  if (!batchId) return <NoBatch vehicleLabel={vehicleLabel} onClose={onClose} />;

  if (isLoading) {
    return (
      <div className="w-72 border-l bg-card flex flex-col h-full shadow-lg">
        <PanelHeader title="Trip Details" vehicleLabel={vehicleLabel} status={null} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading trip...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-72 border-l bg-card flex flex-col h-full shadow-lg">
        <PanelHeader title="Trip Details" vehicleLabel={vehicleLabel} status={null} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
          Could not load trip data.
        </div>
      </div>
    );
  }

  const { facility_ids, optimized_route, facilities, current_stop_index, status } = data;
  const facilityMap = new Map((facilities as any[]).map((f: any) => [f.id, f]));
  const routeStopMap: Record<string, any> = {};
  if ((optimized_route as any)?.stops) {
    for (const s of (optimized_route as any).stops) routeStopMap[s.id] = s;
  }
  const currentIdx: number = current_stop_index ?? 0;

  const stops = ((facility_ids as string[]) || []).map((id, idx) => {
    const fac = facilityMap.get(id) as any;
    const rs = routeStopMap[id];
    const stopStatus =
      idx < currentIdx ? 'completed' :
      idx === currentIdx && status === 'in-progress' ? 'current' :
      'pending';
    return {
      id,
      name: rs?.name || fac?.name || `Stop ${idx + 1}`,
      address: rs?.address || fac?.address || null,
      idx,
      stopStatus,
    };
  });

  const completedCount = stops.filter((s) => s.stopStatus === 'completed').length;
  const progressPct = stops.length > 0 ? Math.round((completedCount / stops.length) * 100) : 0;
  const warehouse = (data.warehouse as any);
  const driver = (data.driver as any);
  const startRaw = data.started_at || data.scheduled_date || data.created_at;

  // Prepend warehouse as "Departure" stop if available
  const allStops: { id: string; name: string; address: string | null; idx: number; stopStatus: string; typeLabel: string }[] = [];
  if (warehouse?.name) {
    allStops.push({ id: 'warehouse', name: warehouse.name, address: warehouse.address || null, idx: -1, stopStatus: 'completed', typeLabel: 'DEPARTURE' });
  }
  stops.forEach((s, i) => {
    const isLast = !warehouse ? i === stops.length - 1 : i === stops.length - 1;
    allStops.push({ ...s, typeLabel: isLast ? 'DESTINATION' : i === 0 && !warehouse ? 'DEPARTURE' : `STOP ${i + 1}` });
  });

  return (
    <div className="w-72 border-l bg-card flex flex-col h-full shadow-lg shrink-0">
      <PanelHeader title="Trip Details" vehicleLabel={vehicleLabel} status={status} onClose={onClose} />

      <ScrollArea className="flex-1">
        <div className="divide-y">

          {/* Stats grid */}
          <div className="px-4 py-4 grid grid-cols-2 gap-3">
            <StatItem icon={CalendarDays} label="Start Date" value={
              startRaw
                ? `${fmtDate(startRaw)}${fmtTime(startRaw) ? ` / ${fmtTime(startRaw)}` : ''}`
                : '—'
            } />
            <StatItem icon={Clock} label="Progress" value={`${progressPct}%`} />
            <StatItem icon={MapPin} label="Stops" value={`${completedCount} / ${stops.length}`} />
            <StatItem icon={User} label="Driver" value={driver?.name || '—'} />
          </div>

          {/* Overall progress bar */}
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completedCount} done</span>
              <span>{stops.length - completedCount} remaining</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Completed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block animate-pulse" /> In progress</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30 inline-block" /> Pending</span>
            </div>
          </div>

          {/* Timeline */}
          {allStops.length > 0 && (
            <div className="px-4 py-4">
              <div>
                {allStops.map((stop, i) => {
                  const isLast = i === allStops.length - 1;
                  const isCompleted = stop.stopStatus === 'completed';
                  const isCurrent = stop.stopStatus === 'current';
                  const isPending = stop.stopStatus === 'pending';
                  const showVan = isCurrent && !isLast;
                  const lineColor = isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-blue-300' : 'bg-muted-foreground/20';
                  const dotColor = isCompleted ? 'bg-emerald-500 border-emerald-500' :
                                   isCurrent   ? 'bg-blue-500 border-blue-400' :
                                                 'bg-background border-muted-foreground/30';

                  return (
                    <div key={stop.id}>
                      {/* Stop row */}
                      <div className="flex items-start gap-3">
                        {/* Stem */}
                        <div className="flex flex-col items-center shrink-0 w-4">
                          <div className={cn(
                            'relative h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                            dotColor,
                          )}>
                            {isCurrent && <span className="absolute inset-0 rounded-full bg-blue-400/40 animate-ping" />}
                            {isCompleted && <CheckCircle2 className="h-2.5 w-2.5 text-white relative" />}
                            {isCurrent && <span className="relative h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          {!isLast && !showVan && (
                            <div className={cn('w-0.5 flex-1 min-h-[24px]', lineColor)} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-4">
                          <p className={cn(
                            'text-[10px] font-bold uppercase tracking-wider mb-0.5',
                            isCompleted ? 'text-emerald-600' :
                            isCurrent   ? 'text-blue-600' :
                                          'text-muted-foreground',
                          )}>
                            {stop.typeLabel}
                          </p>
                          <p className="font-semibold text-sm leading-snug truncate">{stop.name}</p>
                          {stop.address && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{stop.address}</p>
                          )}
                          {isCompleted && (
                            <Badge className="mt-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] h-4 px-1.5">
                              Completed
                            </Badge>
                          )}
                          {isCurrent && (
                            <Badge className="mt-1 bg-blue-100 text-blue-700 border-blue-200 text-[9px] h-4 px-1.5 animate-pulse">
                              In progress
                            </Badge>
                          )}
                          {isPending && i !== allStops.length - 1 && (
                            <Badge className="mt-1 bg-muted text-muted-foreground text-[9px] h-4 px-1.5">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Van en-route indicator */}
                      {showVan && (
                        <div className="flex items-start gap-3 mb-1">
                          <div className="flex flex-col items-center w-4 shrink-0">
                            <div className="w-0.5 h-3 bg-blue-300" />
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-600 font-medium border border-blue-200 dark:border-blue-800 mb-2">
                            <Truck className="h-3.5 w-3.5 shrink-0" />
                            Vehicle en route
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {allStops.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No facility stops found for this batch.
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}

// ── Stat item ─────────────────────────────────────────────────────────────────

function StatItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-semibold leading-snug truncate" title={value}>{value}</p>
    </div>
  );
}
