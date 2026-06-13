import * as React from 'react';
import { format } from 'date-fns';
import { type DateRange } from 'react-day-picker';
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  CalendarDays,
  Sparkles,
  X,
  CheckCircle2,
  ListChecks,
  Network,
  PlusCircle,
  Search,
  Plus,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUploadColumn } from '../schedule/FileUploadColumn';
import { WorkingSetColumn } from '../schedule/WorkingSetColumn';
import type { PlanningIntent, CopilotPriority } from '@/types/scheduling-copilot';
import { DEFAULT_PLANNING_INTENT } from '@/types/scheduling-copilot';
import type { SourceMethod, ParsedFacility, WorkingSetItem } from '@/types/unified-workflow';

interface Facility {
  id: string;
  name: string;
  lga?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface CopilotStep3IntentProps {
  intent: PlanningIntent | null;
  onIntentChange: (intent: PlanningIntent) => void;
  operationalSnapshot: {
    ready_requisitions: number;
    ready_facilities: number;
    vehicles_available: number;
    vehicles_total: number;
    vehicles_maintenance: number;
    drivers_active: number;
    drivers_total: number;
    source_method?: SourceMethod | null;
  };
  // Source workflow props
  sourceMethod: SourceMethod | null;
  allFacilities: Facility[];
  parsedFacilities: ParsedFacility[] | null;
  onFileParsed: (facilities: ParsedFacility[]) => void;
  onUpdateParsedRow: (rowIndex: number, updates: Partial<ParsedFacility>) => void;
  onAddToWorkingSet: (entry: WorkingSetItem) => void;
  onRemoveFromWorkingSet: (facilityId: string) => void;
  onReorderWorkingSet: (fromIndex: number, toIndex: number) => void;
  onClearWorkingSet: () => void;
  workingSet: WorkingSetItem[];
  // Start location
  warehouses: Array<{ id: string; name: string }>;
  startLocationId: string | null;
  onStartLocationChange: (id: string, type: 'warehouse') => void;
}

const PRIORITY_OPTIONS: { value: CopilotPriority; label: string; description: string }[] = [
  { value: 'routine', label: 'Routine', description: 'Standard delivery schedule' },
  { value: 'urgent', label: 'Urgent', description: 'Expedited where possible' },
  { value: 'critical', label: 'Critical', description: 'Immediate dispatch required' },
];

interface PreferenceToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

function PreferenceToggle({ checked, onChange, label, description }: PreferenceToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-left transition-all w-full',
        checked
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/30'
      )}
    >
      <div
        className={cn(
          'mt-0.5 h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors',
          checked ? 'border-primary bg-primary' : 'border-muted-foreground'
        )}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-medium leading-none">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
    </button>
  );
}

interface AIOptimizationResult {
  preferences: {
    minimize_vehicles: boolean;
    respect_facility_hours: boolean;
    prioritize_cold_chain: boolean;
    balance_fleet_utilization: boolean;
    max_run_duration_hours: number;
    shift_start_hour: number;
    shift_end_hour: number;
  };
  rationale: string[];
}

function computeAIOptimalIntent(snapshot: CopilotStep3IntentProps['operationalSnapshot']): AIOptimizationResult {
  const { ready_requisitions, ready_facilities, vehicles_available, vehicles_total, drivers_active, drivers_total } = snapshot;

  const fleetUtilization = vehicles_total > 0 ? vehicles_available / vehicles_total : 1;
  const driverUtilization = drivers_total > 0 ? drivers_active / drivers_total : 1;
  const avgReqsPerFacility = ready_facilities > 0 ? ready_requisitions / ready_facilities : 1;

  const minimize_vehicles = fleetUtilization < 0.7 || avgReqsPerFacility > 3;
  const balance_fleet_utilization = fleetUtilization > 0.5 && vehicles_available > 2;
  const respect_facility_hours = driverUtilization < 0.9;
  const prioritize_cold_chain = drivers_active >= 2;
  const shift_start_hour = 7;
  const shift_end_hour = fleetUtilization < 0.5 ? 20 : 18;
  const max_run_duration_hours = fleetUtilization < 0.5 ? 10 : 8;

  const rationale: string[] = [];
  if (minimize_vehicles) rationale.push(`Consolidating runs — ${vehicles_available}/${vehicles_total} vehicles available, high demand density.`);
  else rationale.push(`Fleet is well-resourced — distributing load across available vehicles.`);
  if (balance_fleet_utilization) rationale.push(`Balancing fleet utilization across ${vehicles_available} active vehicles.`);
  if (prioritize_cold_chain) rationale.push(`Cold-chain prioritized — ${drivers_active} drivers can support dedicated cold runs.`);
  else rationale.push(`Cold-chain separation skipped — limited driver availability (${drivers_active} active).`);
  if (shift_end_hour === 20) rationale.push(`Extended shift window (07:00–20:00) to compensate for constrained fleet.`);
  else rationale.push(`Standard shift window (07:00–18:00) — fleet availability is sufficient.`);

  return {
    preferences: {
      minimize_vehicles,
      respect_facility_hours,
      prioritize_cold_chain,
      balance_fleet_utilization,
      max_run_duration_hours,
      shift_start_hour,
      shift_end_hour,
    },
    rationale,
  };
}

// ─── Facility Browser Panel (manual / service_policy sources) ─────────────────

function FacilityBrowserPanel({
  sourceMethod,
  allFacilities,
  workingSet,
  onAddToWorkingSet,
  onRemoveFromWorkingSet,
  onReorderWorkingSet,
  onClearWorkingSet,
  selectedFacilitiesSection,
}: {
  sourceMethod: SourceMethod | null;
  allFacilities: Facility[];
  workingSet: WorkingSetItem[];
  onAddToWorkingSet: (entry: WorkingSetItem) => void;
  onRemoveFromWorkingSet: (facilityId: string) => void;
  onReorderWorkingSet: (fromIndex: number, toIndex: number) => void;
  onClearWorkingSet: () => void;
  selectedFacilitiesSection: React.ReactNode;
}) {
  const [query, setQuery] = React.useState('');
  const selectedIds = React.useMemo(
    () => new Set(workingSet.map((w) => w.facility_id)),
    [workingSet]
  );

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allFacilities;
    return allFacilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.lga && f.lga.toLowerCase().includes(q))
    );
  }, [allFacilities, query]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h3 className="text-sm font-semibold">Facility Source</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {sourceMethod === 'service_policy'
            ? 'Select facilities from your service policy cluster.'
            : 'Search and select facilities to include in this copilot run.'}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          id="zone-search"
          name="zone-search"
          type="text"
          placeholder="Search by name or LGA…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Facility list */}
      <div className="flex-1 max-h-56 overflow-y-auto rounded-lg border divide-y">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No facilities match your search.</p>
        ) : (
          filtered.map((f) => {
            const isSelected = selectedIds.has(f.id);
            return (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  {f.lga && (
                    <p className="text-xs text-muted-foreground">{f.lga}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isSelected) {
                      onAddToWorkingSet({
                        facility_id: f.id,
                        facility_name: f.name,
                        requisition_ids: [],
                        slot_demand: 1,
                      });
                    } else {
                      onRemoveFromWorkingSet(f.id);
                    }
                  }}
                  className={cn(
                    'flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary hover:bg-red-50 hover:text-red-500'
                      : 'bg-muted hover:bg-primary/10 hover:text-primary'
                  )}
                  title={isSelected ? 'Remove' : 'Add'}
                >
                  {isSelected ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {workingSet.length === 0 && (
        <p className="text-xs text-amber-600">
          Select at least one facility to continue.
        </p>
      )}

      {selectedFacilitiesSection}
    </div>
  );
}

// ─── Source Column ────────────────────────────────────────────────────────────

function SourceColumn({
  sourceMethod,
  allFacilities,
  parsedFacilities,
  onFileParsed,
  onUpdateParsedRow,
  onAddToWorkingSet,
  onRemoveFromWorkingSet,
  onReorderWorkingSet,
  onClearWorkingSet,
  workingSet,
}: {
  sourceMethod: SourceMethod | null;
  allFacilities: Facility[];
  parsedFacilities: ParsedFacility[] | null;
  onFileParsed: (facilities: ParsedFacility[]) => void;
  onUpdateParsedRow: (rowIndex: number, updates: Partial<ParsedFacility>) => void;
  onAddToWorkingSet: (entry: WorkingSetItem) => void;
  onRemoveFromWorkingSet: (facilityId: string) => void;
  onReorderWorkingSet: (fromIndex: number, toIndex: number) => void;
  onClearWorkingSet: () => void;
  workingSet: WorkingSetItem[];
}) {
  const handleAddValidToWorkingSet = React.useCallback(() => {
    if (!parsedFacilities) return;
    parsedFacilities
      .filter((f) => f.is_valid && f.matched_facility_id)
      .forEach((f) => {
        onAddToWorkingSet({
          facility_id: f.matched_facility_id!,
          facility_name: f.matched_facility_name!,
          requisition_ids: [],
          slot_demand: 1,
        });
      });
  }, [parsedFacilities, onAddToWorkingSet]);

  const selectedFacilitiesSection = workingSet.length > 0 ? (
    <div className="mt-5 flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold">Selected Facilities</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {workingSet.length} {workingSet.length === 1 ? 'facility' : 'facilities'} queued for copilot
        </p>
      </div>
      <WorkingSetColumn
        items={workingSet}
        onReorder={onReorderWorkingSet}
        onRemove={onRemoveFromWorkingSet}
        onClear={onClearWorkingSet}
      />
    </div>
  ) : null;

  if (sourceMethod === 'upload') {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Facility Source</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload a file to extract and match facilities for this copilot run.
          </p>
        </div>
        <FileUploadColumn
          allFacilities={allFacilities}
          parsedFacilities={parsedFacilities}
          onFileParsed={onFileParsed}
          onUpdateRow={onUpdateParsedRow}
          onAddValidToWorkingSet={handleAddValidToWorkingSet}
          className="flex-1"
        />
        {selectedFacilitiesSection}
      </div>
    );
  }

  if (sourceMethod === 'ready') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">Facility Source</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            The copilot will draw demand from ready consignments.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
          <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ListChecks className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Ready Consignments</p>
            <p className="text-xs text-muted-foreground mt-1">
              All confirmed facility orders ready for dispatch will be automatically
              included as demand input. The copilot will group and prioritise them
              based on your intent settings.
            </p>
          </div>
        </div>
        {selectedFacilitiesSection}
      </div>
    );
  }

  if (sourceMethod === 'service_policy' || sourceMethod === 'manual') {
    return (
      <FacilityBrowserPanel
        sourceMethod={sourceMethod}
        allFacilities={allFacilities}
        workingSet={workingSet}
        onAddToWorkingSet={onAddToWorkingSet}
        onRemoveFromWorkingSet={onRemoveFromWorkingSet}
        onReorderWorkingSet={onReorderWorkingSet}
        onClearWorkingSet={onClearWorkingSet}
        selectedFacilitiesSection={selectedFacilitiesSection}
      />
    );
  }

  // fallback (should not reach)
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Facility Source</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Facilities will be resolved in the next step.
        </p>
      </div>
      {selectedFacilitiesSection}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CopilotStep3Intent({
  intent,
  onIntentChange,
  operationalSnapshot,
  sourceMethod,
  allFacilities,
  parsedFacilities,
  onFileParsed,
  onUpdateParsedRow,
  onAddToWorkingSet,
  onRemoveFromWorkingSet,
  onReorderWorkingSet,
  onClearWorkingSet,
  workingSet,
  warehouses,
  startLocationId,
  onStartLocationChange,
}: CopilotStep3IntentProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [aiPanel, setAiPanel] = React.useState<AIOptimizationResult | null>(null);
  const [aiApplied, setAiApplied] = React.useState(false);

  const current: PlanningIntent = intent ?? { ...DEFAULT_PLANNING_INTENT };

  const update = (patch: Partial<PlanningIntent>) => {
    onIntentChange({ ...current, ...patch });
  };

  const dateRange: DateRange | undefined =
    current.planning_window_start
      ? {
          from: new Date(current.planning_window_start + 'T00:00:00'),
          to: current.planning_window_end ? new Date(current.planning_window_end + 'T00:00:00') : undefined,
        }
      : undefined;

  function handleRangeSelect(range: DateRange | undefined) {
    update({
      planning_window_start: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      planning_window_end: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    });
    if (range?.from && range?.to) {
      setCalendarOpen(false);
    }
  }

  const rangeLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`
      : `${format(dateRange.from, 'dd/MM/yyyy')} – pick end date`
    : 'Select date range';

  function handleAIOptimize() {
    const result = computeAIOptimalIntent(operationalSnapshot);
    setAiPanel(result);
    setAiApplied(false);
  }

  function applyAISettings() {
    if (aiPanel) {
      update(aiPanel.preferences);
      setAiApplied(true);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-[65vh]">
      {/* Left column — source workflow */}
      <div className="lg:w-[42%] border-r p-6 flex flex-col overflow-y-auto">
        <SourceColumn
          sourceMethod={sourceMethod}
          allFacilities={allFacilities}
          parsedFacilities={parsedFacilities}
          onFileParsed={onFileParsed}
          onUpdateParsedRow={onUpdateParsedRow}
          onAddToWorkingSet={onAddToWorkingSet}
          onRemoveFromWorkingSet={onRemoveFromWorkingSet}
          onReorderWorkingSet={onReorderWorkingSet}
          onClearWorkingSet={onClearWorkingSet}
          workingSet={workingSet}
        />
      </div>

      {/* Right column — intent config */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Define Planning Intent</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tell the copilot what you need. It will determine how to feasibly execute it.
          </p>
        </div>

        {/* Operational Snapshot */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Operational Snapshot
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {operationalSnapshot.source_method === 'upload'
                  ? 'Uploaded Facilities'
                  : operationalSnapshot.source_method === 'manual' || operationalSnapshot.source_method === 'service_policy'
                  ? 'Selected Facilities'
                  : 'Ready Demand'}
              </p>
              <p className="text-sm font-semibold mt-0.5">
                {operationalSnapshot.source_method === 'upload' || operationalSnapshot.source_method === 'manual' || operationalSnapshot.source_method === 'service_policy'
                  ? `${operationalSnapshot.ready_facilities} facilities`
                  : `${operationalSnapshot.ready_requisitions} invoices`}
              </p>
              {(operationalSnapshot.source_method === 'ready' || !operationalSnapshot.source_method) && (
                <p className="text-xs text-muted-foreground">
                  {operationalSnapshot.ready_facilities} facilities
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fleet Status</p>
              <p className="text-sm font-semibold mt-0.5">
                {operationalSnapshot.vehicles_available} available
              </p>
              {operationalSnapshot.vehicles_maintenance > 0 && (
                <p className="text-xs text-amber-600">
                  {operationalSnapshot.vehicles_maintenance} maintenance
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Drivers</p>
              <p className="text-sm font-semibold mt-0.5">
                {operationalSnapshot.drivers_active} active
              </p>
              <p className="text-xs text-muted-foreground">
                of {operationalSnapshot.drivers_total} total
              </p>
            </div>
          </div>
        </div>

        {/* Planning Window */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Planning Window</p>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateRange?.from && 'text-muted-foreground'
                )}
              >
                <CalendarDays className="h-4 w-4 shrink-0 mr-2" />
                <span>{rangeLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[10000]" align="start">
              <CalendarPicker
                mode="range"
                defaultMonth={dateRange?.from ?? today}
                selected={dateRange}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                disabled={(date) => date < today}
                initialFocus
              />
              <div className="border-t px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Select start then end date</span>
                {dateRange?.from && !dateRange?.to && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setCalendarOpen(false)}
                  >
                    Single day
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          {dateRange?.from && !dateRange?.to && (
            <p className="text-xs text-muted-foreground">Click an end date to complete the range.</p>
          )}
        </div>

        {/* Start Location */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Start Location</p>
          </div>
          <Select
            value={startLocationId ?? ''}
            onValueChange={(id) => onStartLocationChange(id, 'warehouse')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select warehouse / depot…" />
            </SelectTrigger>
            <SelectContent className="z-[10000]">
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!startLocationId && (
            <p className="text-xs text-amber-600">
              Select a start location to enable route optimization.
            </p>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Priority</p>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update({ priority: opt.value })}
                className={cn(
                  'flex-1 rounded-lg border-2 py-2 px-3 text-sm font-medium transition-all',
                  current.priority === opt.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Operational Preferences */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Operational Preferences</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-violet-300 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950"
              onClick={handleAIOptimize}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              AI Optimization
            </Button>
          </div>

          {aiPanel && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  <span className="text-sm font-medium text-violet-800 dark:text-violet-300">
                    AI-Recommended Configuration
                  </span>
                </div>
                <button onClick={() => setAiPanel(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="space-y-1">
                {aiPanel.rationale.map((r, i) => (
                  <li key={i} className="text-xs text-violet-700 dark:text-violet-300 flex gap-1.5">
                    <span className="text-violet-400 shrink-0">·</span>
                    {r}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                {aiApplied ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Settings applied — preferences updated below
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={applyAISettings}
                  >
                    Apply These Settings
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <PreferenceToggle
              checked={current.minimize_vehicles}
              onChange={(v) => update({ minimize_vehicles: v })}
              label="Minimize vehicles"
              description="Consolidate runs to use fewer vehicles"
            />
            <PreferenceToggle
              checked={current.respect_facility_hours}
              onChange={(v) => update({ respect_facility_hours: v })}
              label="Respect facility hours"
              description="Only schedule within operating hours"
            />
            <PreferenceToggle
              checked={current.prioritize_cold_chain}
              onChange={(v) => update({ prioritize_cold_chain: v })}
              label="Prioritize cold-chain"
              description="Separate and schedule cold-chain first"
            />
            <PreferenceToggle
              checked={current.balance_fleet_utilization}
              onChange={(v) => update({ balance_fleet_utilization: v })}
              label="Balance fleet utilization"
              description="Distribute load across available vehicles"
            />
          </div>
        </div>

        {/* Advanced */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground px-0"
            onClick={() => setShowAdvanced((s) => !s)}
          >
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4 mr-1" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-1" />
            )}
            Advanced constraints
          </Button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-3 gap-4 rounded-lg border p-4 bg-muted/20">
              <div>
                <label htmlFor="max-run-duration" className="text-xs text-muted-foreground mb-1.5 block">
                  Max run duration (hours)
                </label>
                <input
                  id="max-run-duration"
                  name="max-run-duration"
                  type="number"
                  min={1}
                  max={16}
                  value={current.max_run_duration_hours}
                  onChange={(e) =>
                    update({ max_run_duration_hours: parseInt(e.target.value) || 8 })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="shift-start" className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Shift start
                </label>
                <input
                  id="shift-start"
                  name="shift-start"
                  type="number"
                  min={0}
                  max={12}
                  value={current.shift_start_hour}
                  onChange={(e) => update({ shift_start_hour: parseInt(e.target.value) || 8 })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="shift-end" className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Shift end
                </label>
                <input
                  id="shift-end"
                  name="shift-end"
                  type="number"
                  min={12}
                  max={24}
                  value={current.shift_end_hour}
                  onChange={(e) => update({ shift_end_hour: parseInt(e.target.value) || 18 })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </div>

        {/* Validation hint */}
        {(!current.planning_window_start || !current.planning_window_end) && (
          <p className="text-xs text-amber-600">
            Planning window start and end dates are required to continue.
          </p>
        )}
      </div>
    </div>
  );
}
