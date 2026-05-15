/**
 * =====================================================
 * Execution Intelligence Panel — Right Column (Step 5)
 * =====================================================
 * Displays the real-time execution projection computed
 * by the execution engine. Sits below Schedule Details.
 *
 * Shows: operational days, waves, runs, utilization,
 * vehicle reuse status, completion ETA, and warnings.
 * All values update dynamically as vehicles change.
 */

import * as React from 'react';
import {
  Calendar,
  Layers,
  Route,
  Truck,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ExecutionProjection, ExecutionEngineWarning } from '@/types/unified-workflow';

interface ExecutionIntelligencePanelProps {
  projection: ExecutionProjection | null;
  className?: string;
}

export function ExecutionIntelligencePanel({
  projection,
  className,
}: ExecutionIntelligencePanelProps) {
  if (!projection || projection.total_facilities === 0) return null;

  const hasProjection = projection.operational_days > 0;
  const completionLabel = projection.projected_completion
    ? new Date(`${projection.projected_completion}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div className={cn('space-y-3', className)}>
      {/* Execution Analysis card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Execution Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <AnalysisRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Operational Days"
            value={hasProjection ? String(projection.operational_days) : '—'}
          />
          <AnalysisRow
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Execution Waves"
            value={hasProjection ? String(projection.total_waves) : '—'}
          />
          <AnalysisRow
            icon={<Route className="h-3.5 w-3.5" />}
            label="Estimated Dispatch Runs"
            value={hasProjection ? String(projection.total_runs) : '—'}
          />

          <Separator />

          <AnalysisRow
            icon={<Truck className="h-3.5 w-3.5" />}
            label="Total Facilities"
            value={String(projection.total_facilities)}
          />
          <AnalysisRow
            icon={<Route className="h-3.5 w-3.5" />}
            label="Total Slots"
            value={String(projection.total_slots)}
          />

          {hasProjection && (
            <>
              {/* Vehicle utilization bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Vehicle Utilization (avg)
                  </span>
                  <span className="font-medium">{projection.vehicle_utilization_avg}%</span>
                </div>
                <Progress
                  value={projection.vehicle_utilization_avg}
                  className={cn(
                    'h-1.5',
                    projection.vehicle_utilization_avg > 90
                      ? '[&>div]:bg-red-500'
                      : projection.vehicle_utilization_avg > 70
                      ? '[&>div]:bg-green-500'
                      : '[&>div]:bg-amber-500',
                  )}
                />
              </div>

              <AnalysisRow
                icon={<RefreshCwIcon />}
                label="Vehicle Reuse"
                value={
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      projection.vehicle_reuse_enabled
                        ? 'border-green-400 text-green-700 bg-green-50'
                        : 'border-muted-foreground text-muted-foreground',
                    )}
                  >
                    {projection.vehicle_reuse_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                }
              />

              <AnalysisRow
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Projected Completion"
                value={
                  <span className="font-semibold text-primary">{completionLabel}</span>
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Feasibility & Alerts */}
      {projection.warnings.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Feasibility &amp; Alerts
              <Badge
                variant="secondary"
                className="ml-auto text-xs bg-amber-100 text-amber-800 border-amber-200"
              >
                {projection.warnings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {projection.warnings.map(w => (
                <li key={w.id} className="flex items-start gap-2 text-xs text-amber-900">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* All clear */}
      {hasProjection && projection.warnings.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Execution plan is feasible</span>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================

function AnalysisRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
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

function RefreshCwIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export default ExecutionIntelligencePanel;
