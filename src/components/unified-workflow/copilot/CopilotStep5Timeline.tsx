import * as React from 'react';
import {
  Truck,
  User,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Package,
  Edit3,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CopilotPlan, DispatchRunProposal, FeasibilityWarning, ResourceOccupancyEntry } from '@/types/scheduling-copilot';

interface CopilotStep5TimelineProps {
  plan: CopilotPlan;
  vehicles: Array<{ id: string; model: string; plateNumber?: string; status: string }>;
  drivers: Array<{ id: string; name: string; status: string }>;
  onUpdateRun: (runId: string, updates: Partial<DispatchRunProposal>) => void;
}

// Group runs by planned_date
function groupByDate(runs: DispatchRunProposal[]): Map<string, DispatchRunProposal[]> {
  const map = new Map<string, DispatchRunProposal[]>();
  for (const run of runs) {
    if (!map.has(run.planned_date)) map.set(run.planned_date, []);
    map.get(run.planned_date)!.push(run);
  }
  return map;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function WarningPill({ warning }: { warning: FeasibilityWarning }) {
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 rounded px-2 py-1.5 text-xs',
        warning.severity === 'error'
          ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
      )}
    >
      {warning.severity === 'error' ? (
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
      )}
      <span>{warning.message}</span>
    </div>
  );
}

interface RunCardProps {
  run: DispatchRunProposal;
  vehicles: Array<{ id: string; model: string; plateNumber?: string; status: string }>;
  drivers: Array<{ id: string; name: string; status: string }>;
  onUpdateRun: (runId: string, updates: Partial<DispatchRunProposal>) => void;
}

function RunCard({ run, vehicles, drivers, onUpdateRun }: RunCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editVehicle, setEditVehicle] = React.useState(run.vehicle_id ?? '');
  const [editDriver, setEditDriver] = React.useState(run.driver_id ?? '');
  const [editDeparture, setEditDeparture] = React.useState(run.planned_departure);
  const [editReturn, setEditReturn] = React.useState(run.planned_return);

  const hasWarnings = run.feasibility_warnings.length > 0;
  const hasErrors = run.feasibility_warnings.some((w) => w.severity === 'error');

  const handleSaveOverride = () => {
    const vehicle = vehicles.find((v) => v.id === editVehicle);
    const driver = drivers.find((d) => d.id === editDriver);
    onUpdateRun(run.id, {
      vehicle_id: editVehicle || null,
      vehicle_model: vehicle?.model,
      vehicle_plate: vehicle?.plateNumber,
      driver_id: editDriver || null,
      driver_name: driver?.name,
      planned_departure: editDeparture,
      planned_return: editReturn,
      user_overridden: true,
    });
    setEditing(false);
  };

  const availableVehicles = vehicles.filter(
    (v) => v.status === 'available' || v.status === 'active'
  );
  const availableDrivers = drivers.filter((d) => d.status === 'available');

  return (
    <div
      className={cn(
        'rounded-lg border bg-card',
        hasErrors
          ? 'border-red-200 dark:border-red-900'
          : hasWarnings
          ? 'border-amber-200 dark:border-amber-900'
          : 'border-border',
        run.user_overridden && 'ring-1 ring-primary/30'
      )}
    >
      {/* Run header */}
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold',
              hasErrors
                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                : hasWarnings
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                : 'bg-primary/10 text-primary'
            )}
          >
            {run.run_number}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Run {run.run_number}</span>
              {run.has_cold_chain && (
                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 py-0">
                  Cold-chain
                </Badge>
              )}
              {run.user_overridden && (
                <Badge variant="outline" className="text-xs text-primary py-0">
                  Overridden
                </Badge>
              )}
            </div>

            {/* Time + vehicle + driver summary */}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {run.planned_departure} → {run.planned_return}
              </span>
              {run.vehicle_model ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {run.vehicle_model} {run.vehicle_plate && `(${run.vehicle_plate})`}
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

            {/* Capacity */}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">
                {run.candidates.length} stop{run.candidates.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {run.total_slot_demand} slot{run.total_slot_demand !== 1 ? 's' : ''}
              </span>
              {run.vehicle_capacity_slots && (
                <span
                  className={cn(
                    'text-xs',
                    run.utilization_pct > 90
                      ? 'text-amber-600'
                      : run.utilization_pct > 100
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                  )}
                >
                  {run.utilization_pct}% util.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {hasWarnings && (
            <div className="flex items-center gap-1">
              {hasErrors ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-xs text-muted-foreground">{run.feasibility_warnings.length}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setEditing(false);
              setExpanded((s) => !s);
            }}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-3 space-y-3">
          {/* Warnings */}
          {run.feasibility_warnings.length > 0 && (
            <div className="space-y-1.5">
              {run.feasibility_warnings.map((w, i) => (
                <WarningPill key={i} warning={w} />
              ))}
            </div>
          )}

          {/* Stops */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Stops
            </p>
            {run.candidates.map((c, i) => (
              <div key={c.facility_id} className="flex items-center gap-2 text-xs py-1">
                <span className="shrink-0 text-muted-foreground w-4">{i + 1}.</span>
                <span className="flex-1 min-w-0 font-medium break-words leading-snug">{c.facility_name}</span>
                {c.lga && <span className="shrink-0 text-muted-foreground">{c.lga}</span>}
                <span className="shrink-0 text-muted-foreground ml-auto">
                  {c.slot_demand} slot{c.slot_demand !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Override editor */}
          {editing ? (
            <div className="space-y-3 rounded-lg bg-muted/30 p-3">
              <p className="text-xs font-medium">Override Run Details</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Departure</label>
                  <input
                    type="time"
                    value={editDeparture}
                    onChange={(e) => setEditDeparture(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Return</label>
                  <input
                    type="time"
                    value={editReturn}
                    onChange={(e) => setEditReturn(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vehicle</label>
                  <select
                    value={editVehicle}
                    onChange={(e) => setEditVehicle(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— None —</option>
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.model} {v.plateNumber ? `(${v.plateNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Driver</label>
                  <select
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— None —</option>
                    {availableDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveOverride} className="flex-1">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Save Override
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="w-full"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1.5" />
              Override this run
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ResourceOccupancyPanel({ entries }: { entries: ResourceOccupancyEntry[] }) {
  const vehicles = entries.filter((e) => e.resource_type === 'vehicle');
  const drivers = entries.filter((e) => e.resource_type === 'driver');

  const statusIcon = (status: ResourceOccupancyEntry['status']) => {
    if (status === 'available') return <span className="text-green-500">●</span>;
    if (status === 'occupied') return <span className="text-red-500">●</span>;
    return <span className="text-amber-500">●</span>;
  };

  const statusLabel = (e: ResourceOccupancyEntry) => {
    if (e.status === 'available') return 'Available';
    if (e.status === 'maintenance') return e.note ?? 'Maintenance';
    if (e.occupied_until) {
      const dt = new Date(e.occupied_until);
      return `Occupied until ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Occupied';
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Resource Occupancy
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium flex items-center gap-1">
            <Truck className="h-3 w-3" /> Vehicles
          </p>
          {vehicles.length === 0 && (
            <p className="text-xs text-muted-foreground">No vehicles</p>
          )}
          {vehicles.map((e) => (
            <div key={e.resource_id} className="flex items-center gap-1.5 text-xs">
              {statusIcon(e.status)}
              <span className="truncate flex-1">{e.resource_name}</span>
              <span className="text-muted-foreground text-xs shrink-0">{statusLabel(e)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium flex items-center gap-1">
            <User className="h-3 w-3" /> Drivers
          </p>
          {drivers.length === 0 && (
            <p className="text-xs text-muted-foreground">No drivers</p>
          )}
          {drivers.map((e) => (
            <div key={e.resource_id} className="flex items-center gap-1.5 text-xs">
              {statusIcon(e.status)}
              <span className="truncate flex-1">{e.resource_name}</span>
              <span className="text-muted-foreground text-xs shrink-0">{statusLabel(e)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CopilotStep5Timeline({
  plan,
  vehicles,
  drivers,
  onUpdateRun,
}: CopilotStep5TimelineProps) {
  const grouped = React.useMemo(() => groupByDate(plan.dispatch_runs), [plan.dispatch_runs]);
  const totalWarnings = plan.dispatch_runs.reduce(
    (s, r) => s + r.feasibility_warnings.length,
    0
  );
  const totalErrors = plan.dispatch_runs.reduce(
    (s, r) => s + r.feasibility_warnings.filter((w) => w.severity === 'error').length,
    0
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Execution Timeline</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review dispatch runs, override assignments, and resolve warnings before approving.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {totalErrors > 0 && (
            <Badge variant="destructive" className="text-xs">
              {totalErrors} error{totalErrors !== 1 ? 's' : ''}
            </Badge>
          )}
          {totalWarnings > totalErrors && (
            <Badge
              variant="outline"
              className="text-xs text-amber-600 border-amber-400"
            >
              {totalWarnings - totalErrors} warning{totalWarnings - totalErrors !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Plan summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xl font-bold">{plan.summary.total_runs}</p>
          <p className="text-xs text-muted-foreground">Dispatch runs</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xl font-bold">{plan.summary.estimated_execution_days}</p>
          <p className="text-xs text-muted-foreground">Operational days</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xl font-bold">{plan.summary.total_vehicles_used}</p>
          <p className="text-xs text-muted-foreground">Vehicles</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xl font-bold">{plan.summary.total_assigned}</p>
          <p className="text-xs text-muted-foreground">Facilities scheduled</p>
        </div>
      </div>

      {/* Unassigned warning */}
      {plan.unassigned_candidates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {plan.unassigned_candidates.length} facilit
                {plan.unassigned_candidates.length !== 1 ? 'ies' : 'y'} could not be scheduled
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Demand exceeds available resources in the planning window, or facilities are not
                dispatch-ready.
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {plan.unassigned_candidates.slice(0, 6).map((c) => (
                  <Badge
                    key={c.facility_id}
                    variant="outline"
                    className="text-xs text-amber-700 border-amber-400 py-0"
                  >
                    {c.facility_name}
                  </Badge>
                ))}
                {plan.unassigned_candidates.length > 6 && (
                  <Badge variant="outline" className="text-xs text-amber-700 border-amber-400 py-0">
                    +{plan.unassigned_candidates.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([date, runs]) => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">{formatDate(date)}</p>
              <span className="text-xs text-muted-foreground">
                {runs.length} run{runs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2 pl-6 border-l-2 border-muted ml-2">
              {runs.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  vehicles={vehicles}
                  drivers={drivers}
                  onUpdateRun={onUpdateRun}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Resource occupancy */}
      {plan.resource_occupancy.length > 0 && (
        <ResourceOccupancyPanel entries={plan.resource_occupancy} />
      )}
    </div>
  );
}
