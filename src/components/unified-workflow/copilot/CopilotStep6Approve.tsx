import * as React from 'react';
import {
  CheckCircle2,
  Truck,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  AlertCircle,
  Package,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { CopilotPlan, DispatchRunProposal, PlanningIntent } from '@/types/scheduling-copilot';

interface CopilotStep6ApproveProps {
  plan: CopilotPlan;
  intent: PlanningIntent;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function RunSummaryRow({ run }: { run: DispatchRunProposal }) {
  const hasWarnings = run.feasibility_warnings.length > 0;
  const hasErrors = run.feasibility_warnings.some((w) => w.severity === 'error');

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2 px-3 rounded-lg text-sm border',
        hasErrors
          ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900'
          : hasWarnings
          ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-900'
          : 'border-border bg-card'
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold',
          hasErrors
            ? 'bg-red-100 dark:bg-red-950 text-red-700'
            : hasWarnings
            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700'
            : 'bg-primary/10 text-primary'
        )}
      >
        {run.run_number}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(run.planned_date)}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {run.planned_departure}–{run.planned_return}
          </span>
          {run.vehicle_model ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {run.vehicle_model}
            </span>
          ) : (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <Truck className="h-3 w-3" />
              No vehicle
            </span>
          )}
          {run.driver_name ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {run.driver_name}
            </span>
          ) : (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <User className="h-3 w-3" />
              No driver
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {run.candidates.length} stop{run.candidates.length !== 1 ? 's' : ''}
        </span>
        {hasErrors && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
        {!hasErrors && hasWarnings && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
        {run.user_overridden && (
          <Badge variant="outline" className="text-xs py-0 text-primary">
            Overridden
          </Badge>
        )}
      </div>
    </div>
  );
}

export function CopilotStep6Approve({ plan, intent }: CopilotStep6ApproveProps) {
  const totalErrors = plan.dispatch_runs.reduce(
    (s, r) => s + r.feasibility_warnings.filter((w) => w.severity === 'error').length,
    0
  );
  const totalWarnings = plan.dispatch_runs.reduce(
    (s, r) => s + r.feasibility_warnings.filter((w) => w.severity === 'warning').length,
    0
  );
  const overriddenCount = plan.dispatch_runs.filter((r) => r.user_overridden).length;

  // Group runs by date for display
  const byDate = React.useMemo(() => {
    const map = new Map<string, DispatchRunProposal[]>();
    for (const run of plan.dispatch_runs) {
      if (!map.has(run.planned_date)) map.set(run.planned_date, []);
      map.get(run.planned_date)!.push(run);
    }
    return map;
  }, [plan.dispatch_runs]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Approve Execution Plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review the final plan. Approving will queue all dispatch runs for execution.
        </p>
      </div>

      {/* Status banner */}
      {totalErrors > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                {totalErrors} unresolved error{totalErrors !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                Review and override affected runs in the Timeline step before approving.
              </p>
            </div>
          </div>
        </div>
      ) : totalWarnings > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {totalWarnings} warning{totalWarnings !== 1 ? 's' : ''} — plan can still be approved
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                You may approve now or return to Timeline to resolve warnings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Plan is feasible — no errors
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Execution Summary
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Planning window</span>
              <span className="font-medium">
                {formatDate(plan.planning_window_start)} → {formatDate(plan.planning_window_end)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Operational days</span>
              <span className="font-medium">{plan.summary.estimated_execution_days}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dispatch runs</span>
              <span className="font-medium">{plan.summary.total_runs}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vehicles used</span>
              <span className="font-medium">{plan.summary.total_vehicles_used}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Package className="h-3.5 w-3.5" /> Demand Coverage
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total facilities</span>
              <span className="font-medium">{plan.summary.total_candidates}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Scheduled</span>
              <span className="font-medium text-green-600">{plan.summary.total_assigned}</span>
            </div>
            {plan.summary.total_unassigned > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unscheduled</span>
                <span className="font-medium text-amber-600">{plan.summary.total_unassigned}</span>
              </div>
            )}
            {overriddenCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overridden runs</span>
                <span className="font-medium text-primary">{overriddenCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operational preferences applied */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Planning Constraints Applied
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            {intent.priority.charAt(0).toUpperCase() + intent.priority.slice(1)} priority
          </Badge>
          {intent.minimize_vehicles && (
            <Badge variant="secondary" className="text-xs">Minimize vehicles</Badge>
          )}
          {intent.prioritize_cold_chain && (
            <Badge variant="secondary" className="text-xs">Cold-chain priority</Badge>
          )}
          {intent.respect_facility_hours && (
            <Badge variant="secondary" className="text-xs">Facility hours respected</Badge>
          )}
          {intent.balance_fleet_utilization && (
            <Badge variant="secondary" className="text-xs">Fleet balance</Badge>
          )}
          <Badge variant="outline" className="text-xs">
            Shift {intent.shift_start_hour}:00 – {intent.shift_end_hour}:00
          </Badge>
          <Badge variant="outline" className="text-xs">
            Max {intent.max_run_duration_hours}h/run
          </Badge>
        </div>
      </div>

      {/* Run list by day */}
      <div className="space-y-4">
        <p className="text-sm font-medium">All Dispatch Runs</p>
        {Array.from(byDate.entries()).map(([date, runs]) => (
          <div key={date} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">{formatDate(date)}</p>
            {runs.map((run) => (
              <RunSummaryRow key={run.id} run={run} />
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t pt-4">
        Clicking <strong>Approve & Dispatch</strong> will save this execution plan. Dispatch
        coordinators can then activate each run individually from the dispatcher view.
      </p>
    </div>
  );
}
