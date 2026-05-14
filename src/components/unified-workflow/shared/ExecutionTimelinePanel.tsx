/**
 * =====================================================
 * Execution Timeline Panel
 * =====================================================
 * Lightweight tree-style timeline showing batch → run
 * hierarchy with departure/return ETAs and sequencing.
 * Read-only visualization, no planning controls.
 */

import * as React from 'react';
import { format, addMinutes, parseISO } from 'date-fns';
import { Truck, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface TimelineRun {
  run_index: number;
  vehicle_label: string;
  vehicle_id: string;
  /** ISO timestamp for planned departure */
  planned_departure?: string | null;
  /** duration in minutes */
  duration_min: number;
  /** number of stops this vehicle handles */
  stop_count: number;
  facilities: string[]; // facility names, ordered
}

export interface TimelineBatch {
  batch_name: string;
  planning_window_start: string | null;
  planning_window_end: string | null;
  runs: TimelineRun[];
}

interface ExecutionTimelinePanelProps {
  batch: TimelineBatch;
  className?: string;
}

function formatTime(isoOrHHMM: string): string {
  try {
    return format(parseISO(isoOrHHMM), 'h:mma').toLowerCase();
  } catch {
    return isoOrHHMM;
  }
}

function computeReturn(departure: string, durationMin: number): string {
  try {
    return format(addMinutes(parseISO(departure), durationMin), 'h:mma').toLowerCase();
  } catch {
    return '—';
  }
}

function formatDateLabel(iso: string): string {
  try {
    return format(new Date(iso), 'EEE d MMM');
  } catch {
    return iso;
  }
}

export function ExecutionTimelinePanel({ batch, className }: ExecutionTimelinePanelProps) {
  const windowLabel = React.useMemo(() => {
    if (!batch.planning_window_start) return null;
    if (!batch.planning_window_end || batch.planning_window_end === batch.planning_window_start) {
      return formatDateLabel(batch.planning_window_start);
    }
    return `${formatDateLabel(batch.planning_window_start)} → ${formatDateLabel(batch.planning_window_end)}`;
  }, [batch.planning_window_start, batch.planning_window_end]);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Execution Timeline
        </CardTitle>
        {windowLabel && (
          <p className="text-xs text-muted-foreground">{windowLabel}</p>
        )}
      </CardHeader>
      <CardContent>
        {/* Batch node */}
        <div className="relative">
          <div className="flex items-start gap-2">
            <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
            <div className="min-w-0 flex-1 pb-3">
              <p className="text-sm font-semibold leading-tight">{batch.batch_name}</p>
              {windowLabel && (
                <p className="text-xs text-muted-foreground">{windowLabel}</p>
              )}
            </div>
          </div>

          {/* Runs */}
          {batch.runs.length === 0 ? (
            <div className="ml-4 border-l pl-4 pb-2">
              <p className="text-xs text-muted-foreground italic">No runs configured</p>
            </div>
          ) : (
            <div className="ml-1 border-l-2 border-dashed border-muted-foreground/30 pl-4 space-y-3">
              {batch.runs.map((run) => {
                const departLabel = run.planned_departure
                  ? formatTime(run.planned_departure)
                  : '—';
                const returnLabel =
                  run.planned_departure
                    ? computeReturn(run.planned_departure, run.duration_min)
                    : '—';

                return (
                  <div key={run.run_index} className="relative">
                    <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-muted-foreground/40 border-2 border-background" />
                    <div className="bg-muted/40 rounded-md px-3 py-2 space-y-1.5">
                      {/* Run header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{run.vehicle_label}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Run {run.run_index}
                        </Badge>
                      </div>

                      {/* Departure / Return */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>
                          {departLabel !== '—' ? (
                            <>
                              <span className="text-foreground font-medium">{departLabel}</span>
                              {' → '}
                              <span className="text-foreground font-medium">{returnLabel}</span>
                            </>
                          ) : (
                            <span className="italic">Departure not set</span>
                          )}
                        </span>
                        <span className="ml-auto text-[10px]">
                          {Math.floor(run.duration_min / 60)}h {run.duration_min % 60}m
                        </span>
                      </div>

                      {/* Facilities */}
                      {run.facilities.length > 0 && (
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-1">
                          <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                          <span className="truncate">
                            {run.facilities.slice(0, 4).join(' → ')}
                            {run.facilities.length > 4 && ` +${run.facilities.length - 4} more`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ExecutionTimelinePanel;
