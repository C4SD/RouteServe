import * as React from 'react';
import {
  Package,
  Truck,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PlanningCandidate, PlanningIntent, CopilotPlan } from '@/types/scheduling-copilot';
import { DEFAULT_PLANNING_INTENT } from '@/types/scheduling-copilot';
import { generateCopilotPlan, convertToPlanningCandidates } from '@/lib/scheduling-copilot-engine';
import type { FacilityCandidate } from '@/components/unified-workflow/schedule/SourceOfTruthColumn';
import { DecisionSupportColumn } from '@/components/unified-workflow/schedule/DecisionSupportColumn';
import type { WorkingSetItem, AiOptimizationOptions, VehicleSuggestion } from '@/types/unified-workflow';

interface CopilotStep4CandidatesProps {
  intent: PlanningIntent | null;
  candidates: PlanningCandidate[] | null;
  facilityCandidates: FacilityCandidate[];
  onCandidatesResolved: (candidates: PlanningCandidate[]) => void;
  onPlanGenerated: (plan: CopilotPlan) => void;
  copilotPlan: CopilotPlan | null;
  vehicles: Array<{
    id: string;
    model: string;
    plateNumber?: string;
    capacity: number;
    maxWeight?: number;
    status: string;
    cold_chain_capable?: boolean;
  }>;
  drivers: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  // Decision support
  workingSet: WorkingSetItem[];
  startLocation?: { id: string; name: string; lat?: number; lng?: number } | null;
  facilities?: Array<{ id: string; name: string; lat?: number; lng?: number }>;
  aiOptions: AiOptimizationOptions;
  onAiOptionsChange: (options: Partial<AiOptimizationOptions>) => void;
  suggestedVehicleId: string | null;
  onSuggestedVehicleChange: (id: string | null) => void;
  vehicleSuggestions: VehicleSuggestion[];
}

type GenerationPhase =
  | 'idle'
  | 'resolving'
  | 'grouping'
  | 'feasibility'
  | 'allocating'
  | 'done';

const PHASES: { phase: GenerationPhase; label: string }[] = [
  { phase: 'resolving', label: 'Resolving planning candidates…' },
  { phase: 'grouping', label: 'Route-aware grouping…' },
  { phase: 'feasibility', label: 'Temporal feasibility check…' },
  { phase: 'allocating', label: 'Resource allocation…' },
  { phase: 'done', label: 'Execution plan ready' },
];

function CandidateCard({ candidate }: { candidate: PlanningCandidate }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{candidate.facility_name}</p>
          {candidate.cold_chain && (
            <Badge variant="outline" className="text-xs shrink-0 text-blue-600 border-blue-300">
              Cold
            </Badge>
          )}
          {candidate.priority !== 'routine' && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs shrink-0',
                candidate.priority === 'critical'
                  ? 'text-red-600 border-red-300'
                  : 'text-amber-600 border-amber-300'
              )}
            >
              {candidate.priority}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground">
            {candidate.slot_demand} slot{candidate.slot_demand !== 1 ? 's' : ''}
          </span>
          {candidate.total_weight > 0 && (
            <span className="text-xs text-muted-foreground">
              {candidate.total_weight.toFixed(1)} kg
            </span>
          )}
          {candidate.lga && (
            <span className="text-xs text-muted-foreground">{candidate.lga}</span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        {candidate.dispatch_ready ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-amber-500" />
        )}
      </div>
    </div>
  );
}

export function CopilotStep4Candidates({
  intent,
  candidates,
  facilityCandidates,
  onCandidatesResolved,
  onPlanGenerated,
  copilotPlan,
  vehicles,
  drivers,
  workingSet,
  startLocation,
  facilities = [],
  aiOptions,
  onAiOptionsChange,
  suggestedVehicleId,
  onSuggestedVehicleChange,
  vehicleSuggestions,
}: CopilotStep4CandidatesProps) {
  const [phase, setPhase] = React.useState<GenerationPhase>('idle');
  const [currentPhaseIdx, setCurrentPhaseIdx] = React.useState(-1);

  const resolved = candidates ?? [];
  const readyCount = resolved.filter((c) => c.dispatch_ready).length;
  const notReadyCount = resolved.length - readyCount;

  const availableVehicles = vehicles.filter(
    (v) => v.status === 'available' || v.status === 'active'
  );
  const activeDrivers = drivers.filter((d) => d.status === 'available');

  const handleGenerate = React.useCallback(async () => {
    setPhase('resolving');
    setCurrentPhaseIdx(0);

    // Phase 1: resolve candidates from facilityCandidates if not yet done
    await new Promise((r) => setTimeout(r, 300));
    let planningCandidates = candidates;
    if (!planningCandidates) {
      planningCandidates = convertToPlanningCandidates(
        facilityCandidates.map((fc) => ({
          id: fc.id,
          name: fc.name,
          code: fc.code,
          lga: fc.lga,
          zone: fc.zone,
          lat: fc.lat,
          lng: fc.lng,
          requisition_ids: fc.requisition_ids,
          slot_demand: fc.slot_demand,
          weight_kg: fc.weight_kg,
          volume_m3: fc.volume_m3,
        }))
      );
      onCandidatesResolved(planningCandidates);
    }

    setPhase('grouping');
    setCurrentPhaseIdx(1);
    await new Promise((r) => setTimeout(r, 500));

    setPhase('feasibility');
    setCurrentPhaseIdx(2);
    await new Promise((r) => setTimeout(r, 500));

    setPhase('allocating');
    setCurrentPhaseIdx(3);
    await new Promise((r) => setTimeout(r, 400));

    // Run the engine
    const vehicleResources = availableVehicles.map((v) => ({
      id: v.id,
      model: v.model,
      plate: v.plateNumber ?? '',
      capacity_slots: v.capacity > 0 ? Math.floor(v.capacity) : 10,
      max_weight_kg: v.maxWeight ?? 1000,
      status: (v.status === 'available' || v.status === 'active' ? 'available' : 'maintenance') as
        | 'available'
        | 'maintenance'
        | 'occupied',
      cold_chain_capable: v.cold_chain_capable ?? false,
    }));

    const driverResources = activeDrivers.map((d) => ({
      id: d.id,
      name: d.name,
      status: (d.status === 'available' ? 'available' : 'on_route') as
        | 'available'
        | 'on_route'
        | 'off_duty',
    }));

    const plan = generateCopilotPlan(planningCandidates, intent ?? DEFAULT_PLANNING_INTENT, {
      vehicles: vehicleResources,
      drivers: driverResources,
      depot: startLocation?.lat != null && startLocation?.lng != null
        ? { lat: startLocation.lat, lng: startLocation.lng }
        : undefined,
    });

    onPlanGenerated(plan);
    setPhase('done');
    setCurrentPhaseIdx(4);
  }, [
    candidates,
    facilityCandidates,
    intent,
    availableVehicles,
    activeDrivers,
    startLocation,
    onCandidatesResolved,
    onPlanGenerated,
  ]);

  const isGenerating = phase !== 'idle' && phase !== 'done';
  const hasPlan = copilotPlan !== null;

  const displayCandidates = resolved.length > 0
    ? resolved
    : convertToPlanningCandidates(
        facilityCandidates.map((fc) => ({
          id: fc.id,
          name: fc.name,
          code: fc.code,
          lga: fc.lga,
          zone: fc.zone,
          lat: fc.lat,
          lng: fc.lng,
          requisition_ids: fc.requisition_ids,
          slot_demand: fc.slot_demand,
          weight_kg: fc.weight_kg,
          volume_m3: fc.volume_m3,
        }))
      );

  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-[65vh]">
      {/* Left column — Source Facilities */}
      <div className="lg:w-[55%] border-r flex flex-col overflow-y-auto">
        <div className="p-6 space-y-5 flex-1">
          <div>
            <h2 className="text-lg font-semibold">Resolve Planning Candidates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Review the operational demand sourced for this plan, then generate the execution plan.
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <p className="text-xs font-medium uppercase tracking-wide">Ready Demand</p>
              </div>
              <p className="text-xl font-bold">{readyCount}</p>
              <p className="text-xs text-muted-foreground">{facilityCandidates.length} total facilities</p>
              {notReadyCount > 0 && (
                <p className="text-xs text-amber-600">{notReadyCount} not dispatch-ready</p>
              )}
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                <p className="text-xs font-medium uppercase tracking-wide">Fleet</p>
              </div>
              <p className="text-xl font-bold">{availableVehicles.length}</p>
              <p className="text-xs text-muted-foreground">available of {vehicles.length}</p>
              {vehicles.filter((v) => v.status === 'maintenance').length > 0 && (
                <p className="text-xs text-amber-600">
                  {vehicles.filter((v) => v.status === 'maintenance').length} maintenance
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <p className="text-xs font-medium uppercase tracking-wide">Drivers</p>
              </div>
              <p className="text-xl font-bold">{activeDrivers.length}</p>
              <p className="text-xs text-muted-foreground">active of {drivers.length}</p>
            </div>
          </div>

          {/* Source Facilities list */}
          {facilityCandidates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Source Facilities
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({facilityCandidates.length})
                </span>
              </p>
              <div className="overflow-y-auto space-y-1.5 pr-1 max-h-[340px]">
                {displayCandidates.map((c) => (
                  <CandidateCard key={c.facility_id} candidate={c} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No facilities from selected source</p>
              <p className="text-xs text-muted-foreground mt-1">
                Go back to Source to select a source with available demand.
              </p>
            </div>
          )}

          {/* Generation progress */}
          {isGenerating && (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Generating execution plan…
              </p>
              <div className="space-y-2">
                {PHASES.map((p, idx) => (
                  <div key={p.phase} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full flex-shrink-0',
                        idx < currentPhaseIdx
                          ? 'bg-primary'
                          : idx === currentPhaseIdx
                          ? 'bg-primary animate-pulse'
                          : 'bg-muted'
                      )}
                    />
                    <p
                      className={cn(
                        'text-xs',
                        idx <= currentPhaseIdx ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {p.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan summary (when done) */}
          {hasPlan && phase === 'done' && (
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  Execution plan generated
                </p>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold">{copilotPlan!.summary.total_runs}</p>
                  <p className="text-xs text-muted-foreground">runs</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{copilotPlan!.summary.estimated_execution_days}</p>
                  <p className="text-xs text-muted-foreground">days</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{copilotPlan!.summary.total_vehicles_used}</p>
                  <p className="text-xs text-muted-foreground">vehicles</p>
                </div>
                <div>
                  <p
                    className={cn(
                      'text-lg font-bold',
                      copilotPlan!.summary.total_warnings > 0 ? 'text-amber-600' : 'text-green-600'
                    )}
                  >
                    {copilotPlan!.summary.total_warnings}
                  </p>
                  <p className="text-xs text-muted-foreground">warnings</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {copilotPlan!.summary.total_assigned} of {copilotPlan!.summary.total_candidates} facilities scheduled.
                {copilotPlan!.summary.total_unassigned > 0 &&
                  ` ${copilotPlan!.summary.total_unassigned} unassigned.`}
              </p>
            </div>
          )}

          {/* Generate button */}
          {!hasPlan && !isGenerating && (
            <div className="pt-2">
              <Button
                onClick={handleGenerate}
                disabled={facilityCandidates.length === 0}
                className="w-full"
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate Execution Plan
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                The copilot will group, split, and schedule all demand within your planning window.
              </p>
            </div>
          )}

          {hasPlan && phase === 'done' && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPhase('idle');
                  setCurrentPhaseIdx(-1);
                  handleGenerate();
                }}
                className="w-full"
              >
                Regenerate Plan
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right column — Decision Support */}
      <div className="flex-1 overflow-hidden">
        <DecisionSupportColumn
          workingSet={workingSet}
          startLocation={startLocation}
          facilities={facilities}
          aiOptions={aiOptions}
          onAiOptionsChange={onAiOptionsChange}
          suggestedVehicleId={suggestedVehicleId}
          onSuggestedVehicleChange={onSuggestedVehicleChange}
          vehicleSuggestions={vehicleSuggestions}
          sourceSubOption={null}
          className="h-full"
        />
      </div>
    </div>
  );
}
