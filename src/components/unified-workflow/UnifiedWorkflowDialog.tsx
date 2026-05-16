/**
 * =====================================================
 * Unified Workflow Dialog
 * =====================================================
 * Main orchestrator for the 5-step unified workflow:
 * 1. Source → 2. Schedule → 3. Batch → 4. Route → 5. Review
 */

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Steps
import { StepScheduleMode } from './steps/StepScheduleMode';
import { Step1Source } from './steps/Step1Source';
import { Step2Schedule } from './steps/Step2Schedule';
import { Step3PackagingCompletion } from './steps/Step3PackagingCompletion';
import { Step3Batch } from './steps/Step3Batch';
import { Step4Route } from './steps/Step4Route';
import { Step5Review } from './steps/Step5Review';

// Copilot Steps
import { CopilotStep3Intent } from './copilot/CopilotStep3Intent';
import { CopilotStep4Candidates } from './copilot/CopilotStep4Candidates';
import { CopilotStep5Timeline } from './copilot/CopilotStep5Timeline';
import { CopilotStep6Approve } from './copilot/CopilotStep6Approve';

// Store
import {
  useUnifiedWorkflowStore,
  useCurrentStep,
  useCanProceed,
  useWorkflowLoading,
  useWorkflowActions,
} from '@/stores/unifiedWorkflowStore';

// Execution engine (for run-scoped route step)
import { projectExecution } from '@/lib/executionEngine';
import { DEFAULT_EXECUTION_CONFIG } from '@/types/unified-workflow';

// Hooks
import { useFacilities } from '@/hooks/useFacilities';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useVehicles } from '@/hooks/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { useCreatePreBatch, useConvertPreBatchToBatch } from '@/hooks/usePreBatch';
import { useReadyConsignments } from '@/hooks/useReadyConsignments';

import type { FacilityCandidate } from './schedule/SourceOfTruthColumn';

interface UnifiedWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startStep?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  preBatchId?: string;
}

const MANUAL_STEP_LABELS = [
  { num: 1, label: 'Mode' },
  { num: 2, label: 'Source' },
  { num: 3, label: 'Schedule' },
  { num: 4, label: 'Packaging' },
  { num: 5, label: 'Batch' },
  { num: 6, label: 'Route' },
  { num: 7, label: 'Review' },
];

const COPILOT_STEP_LABELS = [
  { num: 1, label: 'Mode' },
  { num: 2, label: 'Source' },
  { num: 3, label: 'Intent' },
  { num: 4, label: 'Packaging' },
  { num: 5, label: 'Demand' },
  { num: 6, label: 'Timeline' },
  { num: 7, label: 'Approve' },
];

export function UnifiedWorkflowDialog({
  open,
  onOpenChange,
  startStep = 1,
  preBatchId,
}: UnifiedWorkflowDialogProps) {
  // Store state - use specific selectors instead of subscribing to entire store
  const currentStep = useCurrentStep();
  const canProceed = useCanProceed();
  const isLoading = useWorkflowLoading();

  // Get specific state slices with shallow comparison
  const scheduleMode = useUnifiedWorkflowStore((state) => state.schedule_mode);
  const sourceMethod = useUnifiedWorkflowStore((state) => state.source_method);
  const sourceSubOption = useUnifiedWorkflowStore((state) => state.source_sub_option);
  const scheduleTitle = useUnifiedWorkflowStore((state) => state.schedule_title);
  const startLocationId = useUnifiedWorkflowStore((state) => state.start_location_id);
  const startLocationType = useUnifiedWorkflowStore((state) => state.start_location_type);
  const plannedDate = useUnifiedWorkflowStore((state) => state.planned_date);
  const planningWindowStart = useUnifiedWorkflowStore((state) => state.planning_window_start);
  const planningWindowEnd = useUnifiedWorkflowStore((state) => state.planning_window_end);
  const timeWindow = useUnifiedWorkflowStore((state) => state.time_window);
  const workingSet = useUnifiedWorkflowStore((state) => state.working_set);
  const aiOptions = useUnifiedWorkflowStore((state) => state.ai_optimization_options);
  const suggestedVehicleId = useUnifiedWorkflowStore((state) => state.suggested_vehicle_id);
  const scheduleNotes = useUnifiedWorkflowStore((state) => state.schedule_notes);
  const batchName = useUnifiedWorkflowStore((state) => state.batch_name);
  const priority = useUnifiedWorkflowStore((state) => state.priority);
  const vehicleId = useUnifiedWorkflowStore((state) => state.vehicle_id);
  const vehicleIds = useUnifiedWorkflowStore((state) => state.vehicle_ids);
  const driverId = useUnifiedWorkflowStore((state) => state.driver_id);
  const slotAssignments = useUnifiedWorkflowStore((state) => state.slot_assignments);
  const optimizedRoute = useUnifiedWorkflowStore((state) => state.optimized_route);
  const routeGeometry = useUnifiedWorkflowStore((state) => state.route_geometry);
  const totalDistanceKm = useUnifiedWorkflowStore((state) => state.total_distance_km);
  const estimatedDurationMin = useUnifiedWorkflowStore((state) => state.estimated_duration_min);
  const storePreBatchId = useUnifiedWorkflowStore((state) => state.pre_batch_id);
  const parsedFacilities = useUnifiedWorkflowStore((state) => state.parsed_facilities);
  const policyContext = useUnifiedWorkflowStore((state) => state.policy_context);
  const facilityPackaging = useUnifiedWorkflowStore((state) => state.facility_packaging);
  const routingFallbackUsed = useUnifiedWorkflowStore((state) => state.routing_fallback_used);
  const suggestedVehicleIds = useUnifiedWorkflowStore((state) => state.suggested_vehicle_ids);

  // Copilot state
  const planningIntent = useUnifiedWorkflowStore((state) => state.planning_intent);
  const planningCandidates = useUnifiedWorkflowStore((state) => state.planning_candidates);
  const copilotPlan = useUnifiedWorkflowStore((state) => state.copilot_plan);

  // Get actions separately (memoized with shallow)
  const actions = useWorkflowActions();

  // Data hooks
  const { data: facilitiesData } = useFacilities();
  const { data: warehousesData } = useWarehouses({ can_dispatch: true });
  const { data: vehiclesData } = useVehicles();
  const { data: driversData } = useDrivers();

  // Fetch ready consignments (facilities with requisitions ready for dispatch)
  const { data: facilityCandidates = [], isLoading: facilitiesLoading } = useReadyConsignments();

  // For manual mode: convert all facilities into FacilityCandidate format
  const allFacilityCandidates = React.useMemo(() => {
    if (!facilitiesData?.facilities) return [];
    return facilitiesData.facilities.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.warehouse_code,
      lga: f.lga,
      zone: f.service_zone,
      lat: f.lat,
      lng: f.lng,
      requisition_ids: [] as string[],
      slot_demand: 1,
    }));
  }, [facilitiesData]);

  // For upload mode, build candidates from the working set joined with facility coordinates
  const uploadCandidates = React.useMemo<FacilityCandidate[]>(() => {
    if (sourceMethod !== 'upload') return [];
    return workingSet.map((ws) => {
      const fac = allFacilityCandidates.find((f) => f.id === ws.facility_id);
      return {
        id: ws.facility_id,
        name: ws.facility_name,
        code: fac?.code,
        lga: fac?.lga,
        zone: fac?.zone,
        lat: fac?.lat,
        lng: fac?.lng,
        requisition_ids: ws.requisition_ids,
        slot_demand: ws.slot_demand,
        weight_kg: ws.weight_kg,
        volume_m3: ws.volume_m3,
      };
    });
  }, [sourceMethod, workingSet, allFacilityCandidates]);

  // Use all facilities for manual/service_policy, uploaded working set for upload, ready consignments otherwise
  const effectiveCandidates: FacilityCandidate[] =
    sourceMethod === 'manual' || sourceMethod === 'service_policy'
      ? allFacilityCandidates
      : sourceMethod === 'upload'
      ? uploadCandidates
      : facilityCandidates;
  const effectiveCandidatesLoading =
    sourceMethod === 'manual' || sourceMethod === 'service_policy' || sourceMethod === 'upload'
      ? !facilitiesData
      : facilitiesLoading;

  // For copilot flow: when source is manual/service_policy, Demand step should see only
  // the facilities the user explicitly added to the working set in the Intent step,
  // not all facilities. Upload and ready already produce the correct scoped list.
  const copilotFacilityCandidates = React.useMemo<FacilityCandidate[]>(() => {
    if (
      (sourceMethod === 'manual' || sourceMethod === 'service_policy') &&
      workingSet.length > 0
    ) {
      return workingSet.map((ws) => {
        const fac = allFacilityCandidates.find((f) => f.id === ws.facility_id);
        return {
          id: ws.facility_id,
          name: ws.facility_name,
          code: fac?.code,
          lga: fac?.lga,
          zone: fac?.zone,
          lat: fac?.lat,
          lng: fac?.lng,
          requisition_ids: ws.requisition_ids,
          slot_demand: ws.slot_demand,
          weight_kg: ws.weight_kg,
          volume_m3: ws.volume_m3,
        };
      });
    }
    return effectiveCandidates;
  }, [sourceMethod, workingSet, allFacilityCandidates, effectiveCandidates]);

  // Mutations
  const createPreBatch = useCreatePreBatch();
  const convertToBatch = useConvertPreBatchToBatch();

  // Transform warehouses
  const warehouses = React.useMemo(() => {
    if (!warehousesData?.warehouses) return [];
    return warehousesData.warehouses.map((w: any) => ({
      id: w.id,
      name: w.name,
      lat: w.lat,
      lng: w.lng,
    }));
  }, [warehousesData]);

  // Transform vehicles
  const vehicles = React.useMemo(() => {
    if (!vehiclesData) return [];
    return vehiclesData.map((v: any) => ({
      id: v.id,
      model: v.model,
      plateNumber: v.plateNumber || v.plate_number,
      capacity: v.capacity,
      maxWeight: v.maxWeight || v.max_weight,
      status: v.status,
      tiered_config: v.tiered_config,
    }));
  }, [vehiclesData]);

  // Transform drivers
  const drivers = React.useMemo(() => {
    if (!driversData) return [];
    return driversData.map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      status: d.status,
      licenseType: d.licenseType || d.license_type,
    }));
  }, [driversData]);

  // Operational snapshot for Step 2 awareness panel — source-aware
  const operationalSnapshot = React.useMemo(() => {
    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter((v) => v.status === 'available').length;
    const maintenanceVehicles = vehicles.filter((v) => v.status === 'maintenance').length;
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter((d) => d.status === 'available').length;

    let demandFacilities = 0;
    let demandRequisitions = 0;

    if (sourceMethod === 'upload') {
      // Use parsed/matched facilities from the uploaded file
      const validParsed = (parsedFacilities ?? []).filter((f) => f.is_valid && f.matched_facility_id);
      demandFacilities = workingSet.length > 0 ? workingSet.length : validParsed.length;
      demandRequisitions = demandFacilities;
    } else if (sourceMethod === 'manual' || sourceMethod === 'service_policy') {
      demandFacilities = workingSet.length;
      demandRequisitions = workingSet.length;
    } else {
      // ready — use actual ready consignments
      demandFacilities = facilityCandidates.length;
      demandRequisitions = facilityCandidates.reduce(
        (sum, c) => sum + ((c as any).requisition_ids?.length ?? 1),
        0
      );
    }

    return {
      ready_requisitions: demandRequisitions,
      ready_facilities: demandFacilities,
      vehicles_available: availableVehicles,
      vehicles_total: totalVehicles,
      vehicles_maintenance: maintenanceVehicles,
      drivers_active: activeDrivers,
      drivers_total: totalDrivers,
      drivers_overlap_warnings: 0,
      source_method: sourceMethod,
    };
  }, [vehicles, drivers, facilityCandidates, sourceMethod, parsedFacilities, workingSet]);

  // Calculate vehicle suggestions based on working set demand
  const vehicleSuggestions = React.useMemo(() => {
    if (workingSet.length === 0 || vehicles.length === 0) return [];

    const totalSlots = workingSet.reduce((sum, item) => sum + (item.slot_demand || 1), 0);

    const available = vehicles.filter(v => v.status === 'available' || v.status === 'active');
    if (available.length === 0) return [];

    return available
      .map(v => {
        const capacitySlots = v.capacity > 0 ? Math.floor(v.capacity) : 10;
        const utilization = Math.min(Math.round((totalSlots / capacitySlots) * 100), 100);
        const fitScore = Math.max(0, 100 - Math.abs(utilization - 80) * 2);

        return {
          vehicle_id: v.id,
          vehicle_model: v.model,
          vehicle_plate: v.plateNumber || '',
          total_slots: capacitySlots,
          available_slots: Math.max(0, capacitySlots - totalSlots),
          capacity_kg: v.maxWeight || 0,
          capacity_m3: 0,
          utilization_pct: utilization,
          fit_score: fitScore,
          reason: utilization <= 100
            ? `${utilization}% capacity utilization`
            : 'Over capacity',
        };
      })
      .filter(s => s.utilization_pct <= 100)
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 3);
  }, [vehicles, workingSet]);

  // Execution projection for run-scoped route step
  // Uses default config; Step3Batch manages its own local config for detailed simulation
  const executionProjection = React.useMemo(() => {
    if (workingSet.length === 0 || vehicleIds.length === 0) return null;
    const assignedVehicles = vehicles.filter(v => vehicleIds.includes(v.id));
    if (assignedVehicles.length === 0) return null;
    return projectExecution(
      workingSet,
      assignedVehicles.map(v => ({
        id: v.id,
        model: v.model,
        plateNumber: v.plateNumber,
        capacity: v.capacity,
        status: v.status,
      })),
      DEFAULT_EXECUTION_CONFIG,
      planningWindowStart ?? plannedDate,
    );
  }, [workingSet, vehicleIds, vehicles, planningWindowStart, plannedDate]);

  // Get selected vehicles for review (multi-vehicle support)
  const selectedVehicles = React.useMemo(
    () => {
      const ids = vehicleIds.length > 0 ? vehicleIds : (vehicleId ? [vehicleId] : []);
      return vehicles.filter(v => ids.includes(v.id));
    },
    [vehicles, vehicleIds, vehicleId]
  );
  const selectedVehicle = selectedVehicles[0] ?? null;
  const selectedDriver = React.useMemo(
    () => drivers.find((d) => d.id === driverId),
    [drivers, driverId]
  );
  const startLocationName = React.useMemo(
    () => warehouses.find((w) => w.id === startLocationId)?.name || null,
    [warehouses, startLocationId]
  );

  // Reset + initialize on open (only when dialog transitions from closed to open)
  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Always start fresh when the dialog opens
      actions.resetWorkflow();
      if (startStep > 1) {
        useUnifiedWorkflowStore.getState().goToStep(startStep);
      }
    }
    prevOpenRef.current = open;
  }, [open, startStep, actions]);

  // Handle close (memoized to prevent infinite loops)
  const handleClose = React.useCallback(() => {
    actions.resetWorkflow();
    onOpenChange(false);
  }, [actions, onOpenChange]);

  // Handle reset and close (memoized to prevent infinite loops)
  const handleReset = React.useCallback(() => {
    actions.resetWorkflow();
    onOpenChange(false);
  }, [actions, onOpenChange]);

  // Map service_policy → manual at the DB boundary (policy context lives in facility_order)
  const dbSourceMethod = React.useMemo(
    () => (sourceMethod === 'service_policy' ? 'manual' : sourceMethod),
    [sourceMethod]
  );

  // Handle save draft (Step 2) (memoized to prevent infinite loops)
  const handleSaveDraft = React.useCallback(async () => {
    try {
      const draft = await createPreBatch.mutateAsync({
        source_method: dbSourceMethod!,
        source_sub_option: sourceSubOption,
        schedule_title: scheduleTitle!,
        start_location_id: startLocationId!,
        start_location_type: startLocationType,
        planned_date: (planningWindowStart ?? plannedDate)!,
        planning_window_start: planningWindowStart ?? plannedDate ?? undefined,
        planning_window_end: planningWindowEnd ?? undefined,
        time_window: timeWindow,
        facility_order: workingSet.map((w) => w.facility_id),
        facility_requisition_map: workingSet.reduce(
          (acc, w) => ({ ...acc, [w.facility_id]: w.requisition_ids }),
          {}
        ),
        ai_optimization_options: sourceSubOption === 'ai_optimization' ? aiOptions : null,
        suggested_vehicle_id: suggestedVehicleId,
        suggested_vehicle_ids: suggestedVehicleIds,
        policy_context: policyContext,
        facility_packaging: facilityPackaging,
        notes: scheduleNotes,
      });
      actions.setLoading(false);
      // Store the pre_batch_id so a resumed session can skip re-creation
      useUnifiedWorkflowStore.setState({ pre_batch_id: draft.id });
      handleClose();
    } catch (error) {
      console.error('Failed to save draft:', error);
      // toast is already fired by the mutation's onError
    }
  }, [
    createPreBatch,
    dbSourceMethod,
    sourceSubOption,
    scheduleTitle,
    startLocationId,
    startLocationType,
    plannedDate,
    planningWindowStart,
    planningWindowEnd,
    timeWindow,
    workingSet,
    aiOptions,
    suggestedVehicleId,
    suggestedVehicleIds,
    policyContext,
    facilityPackaging,
    scheduleNotes,
    handleClose,
    actions,
  ]);

  // Handle final confirm (Step 6) (memoized to prevent infinite loops)
  const handleConfirm = React.useCallback(async () => {
    // Guard: vehicle is required (defensive against auto-commit edge cases)
    const committedVehicleIds = vehicleIds.length > 0 ? vehicleIds : (vehicleId ? [vehicleId] : []);
    const primaryVehicleId = committedVehicleIds[0] ?? null;

    if (!primaryVehicleId) {
      actions.setError('At least one vehicle must be selected before creating a batch.');
      return;
    }

    try {
      // Ensure a pre-batch exists (create one if the user skipped "Save Draft")
      let preBatchId = storePreBatchId;

      if (!preBatchId) {
        const newPreBatch = await createPreBatch.mutateAsync({
          source_method: dbSourceMethod!,
          source_sub_option: sourceSubOption,
          schedule_title: scheduleTitle!,
          start_location_id: startLocationId!,
          start_location_type: startLocationType,
          planned_date: (planningWindowStart ?? plannedDate)!,
          planning_window_start: planningWindowStart ?? plannedDate ?? undefined,
          planning_window_end: planningWindowEnd ?? undefined,
          time_window: timeWindow,
          facility_order: workingSet.map((w) => w.facility_id),
          facility_requisition_map: workingSet.reduce(
            (acc, w) => ({ ...acc, [w.facility_id]: w.requisition_ids }),
            {}
          ),
          ai_optimization_options: sourceSubOption === 'ai_optimization' ? aiOptions : null,
          suggested_vehicle_id: suggestedVehicleId,
          suggested_vehicle_ids: suggestedVehicleIds,
          policy_context: policyContext,
          facility_packaging: facilityPackaging,
          notes: scheduleNotes,
        });
        preBatchId = newPreBatch.id;
        useUnifiedWorkflowStore.setState({ pre_batch_id: preBatchId });
      }

      await convertToBatch.mutateAsync({
        preBatchId: preBatchId,
        batchName: batchName!,
        vehicleId: primaryVehicleId,
        vehicleIds: committedVehicleIds,
        driverId: driverId,
        priority: priority,
        slotAssignments: slotAssignments,
        facilityPackaging: facilityPackaging,
        optimizedRoute: optimizedRoute,
        totalDistanceKm: totalDistanceKm ?? undefined,
        estimatedDurationMin: estimatedDurationMin ?? undefined,
        routeFallbackUsed: routingFallbackUsed,
        planningWindowStart: planningWindowStart ?? plannedDate,
        planningWindowEnd: planningWindowEnd,
        notes: scheduleNotes,
      });

      actions.resetWorkflow();
      onOpenChange(false);
    } catch (error) {
      // Error toast is already fired by the mutation's onError handler.
      // Do NOT close the dialog — the user needs to see the error and retry.
      console.error('Failed to create batch:', error);
    }
  }, [
    convertToBatch,
    createPreBatch,
    storePreBatchId,
    dbSourceMethod,
    sourceSubOption,
    scheduleTitle,
    startLocationId,
    startLocationType,
    plannedDate,
    planningWindowStart,
    planningWindowEnd,
    timeWindow,
    workingSet,
    aiOptions,
    suggestedVehicleId,
    suggestedVehicleIds,
    policyContext,
    facilityPackaging,
    batchName,
    vehicleId,
    vehicleIds,
    driverId,
    priority,
    slotAssignments,
    optimizedRoute,
    totalDistanceKm,
    estimatedDurationMin,
    routingFallbackUsed,
    scheduleNotes,
    actions,
    onOpenChange,
  ]);

  // Handle next step — auto-commits suggested vehicles when leaving Schedule step (step 3 manual)
  const handleNextStep = React.useCallback(() => {
    if (currentStep === 3 && scheduleMode === 'manual' && vehicleIds.length === 0) {
      if (suggestedVehicleIds.length > 0) {
        actions.commitVehicles(suggestedVehicleIds);
      } else if (suggestedVehicleId) {
        actions.commitVehicle(suggestedVehicleId);
      }
    }

    // Copilot + ready source: auto-populate working set from ready consignments before Packaging step
    if (
      currentStep === 3 &&
      scheduleMode === 'copilot' &&
      sourceMethod === 'ready' &&
      workingSet.length === 0 &&
      facilityCandidates.length > 0
    ) {
      actions.setWorkingSet(
        facilityCandidates.map((fc, idx) => ({
          facility_id: fc.id,
          facility_name: fc.name,
          facility_code: fc.code,
          requisition_ids: fc.requisition_ids,
          slot_demand: fc.slot_demand,
          weight_kg: fc.weight_kg,
          volume_m3: fc.volume_m3,
          sequence: idx + 1,
        }))
      );
    }

    actions.nextStep();
  }, [currentStep, scheduleMode, sourceMethod, workingSet, facilityCandidates, suggestedVehicleIds, suggestedVehicleId, vehicleIds, actions]);

  // Handle route optimization (Step 4) (memoized to prevent infinite loops)
  const handleOptimizeRoute = React.useCallback(async () => {
    let startLocation: { id: string; name: string; lat: number; lng: number } | null = null;
    if (startLocationType === 'facility') {
      const fac = facilitiesData?.facilities?.find(f => f.id === startLocationId);
      if (fac?.lat && fac?.lng) startLocation = { id: fac.id, name: fac.name, lat: fac.lat, lng: fac.lng };
    } else {
      startLocation = warehouses.find(w => w.id === startLocationId) || null;
    }
    await actions.optimizeRoute(effectiveCandidates, startLocation);
  }, [actions, effectiveCandidates, warehouses, startLocationId, startLocationType, facilitiesData]);

  // Render step content (memoized to prevent infinite loops)
  const renderStepContent = React.useMemo(() => {
    switch (currentStep) {
      case 1:
        return (
          <StepScheduleMode
            scheduleMode={scheduleMode}
            onScheduleModeChange={actions.setScheduleMode}
          />
        );

      case 2:
        return (
          <Step1Source
            sourceMethod={sourceMethod}
            onSourceMethodChange={actions.setSourceMethod}
          />
        );

      case 3:
        if (scheduleMode === 'copilot') {
          return (
            <CopilotStep3Intent
              intent={planningIntent}
              onIntentChange={actions.setPlanningIntent}
              operationalSnapshot={operationalSnapshot}
              sourceMethod={sourceMethod}
              allFacilities={facilitiesData?.facilities?.map((f) => ({ id: f.id, name: f.name, lga: f.lga, lat: f.lat, lng: f.lng })) ?? []}
              parsedFacilities={parsedFacilities}
              onFileParsed={actions.setParsedFacilities}
              onUpdateParsedRow={actions.updateParsedFacility}
              onAddToWorkingSet={actions.addToWorkingSet}
              onRemoveFromWorkingSet={actions.removeFromWorkingSet}
              onReorderWorkingSet={actions.reorderWorkingSet}
              onClearWorkingSet={actions.clearWorkingSet}
              workingSet={workingSet}
              warehouses={warehouses}
              startLocationId={startLocationId}
              onStartLocationChange={actions.setStartLocation}
            />
          );
        }
        return (
          <Step2Schedule
            title={scheduleTitle}
            onTitleChange={actions.setScheduleTitle}
            startLocationId={startLocationId}
            startLocationType={startLocationType}
            onStartLocationChange={actions.setStartLocation}
            plannedDate={plannedDate}
            onPlannedDateChange={actions.setPlannedDate}
            planningWindowStart={planningWindowStart}
            planningWindowEnd={planningWindowEnd}
            onPlanningWindowChange={actions.setPlanningWindow}
            timeWindow={timeWindow}
            onTimeWindowChange={actions.setTimeWindow}
            sourceMethod={sourceMethod}
            warehouses={warehouses}
            facilities={facilitiesData?.facilities?.map((f) => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng })) ?? []}
            candidates={effectiveCandidates}
            candidatesLoading={effectiveCandidatesLoading}
            workingSet={workingSet}
            onAddToWorkingSet={actions.addToWorkingSet}
            onRemoveFromWorkingSet={actions.removeFromWorkingSet}
            onReorderWorkingSet={actions.reorderWorkingSet}
            onClearWorkingSet={actions.clearWorkingSet}
            onSetWorkingSet={actions.setWorkingSet}
            sourceSubOption={sourceSubOption}
            aiOptions={aiOptions}
            onAiOptionsChange={actions.setAiOptimizationOptions}
            suggestedVehicleId={suggestedVehicleId}
            onSuggestedVehicleChange={actions.setSuggestedVehicle}
            vehicleSuggestions={vehicleSuggestions}
            parsedFacilities={parsedFacilities}
            onFileParsed={actions.setParsedFacilities}
            onUpdateParsedRow={actions.updateParsedFacility}
            policyContext={policyContext}
            onPolicyContextChange={actions.setPolicyContext}
            operationalSnapshot={operationalSnapshot}
          />
        );

      case 4:
        if (scheduleMode === 'copilot') {
          return (
            <Step3PackagingCompletion
              workingSet={workingSet}
              facilityPackaging={facilityPackaging}
              onSetFacilityPackaging={actions.setFacilityPackaging}
            />
          );
        }
        return (
          <Step3PackagingCompletion
            workingSet={workingSet}
            facilityPackaging={facilityPackaging}
            onSetFacilityPackaging={actions.setFacilityPackaging}
          />
        );

      case 5:
        if (scheduleMode === 'copilot') {
          return (
            <CopilotStep4Candidates
              intent={planningIntent}
              candidates={planningCandidates}
              facilityCandidates={copilotFacilityCandidates}
              onCandidatesResolved={actions.setPlanningCandidates}
              onPlanGenerated={actions.setCopilotPlan}
              copilotPlan={copilotPlan}
              vehicles={vehicles}
              drivers={drivers}
              workingSet={workingSet}
              startLocation={warehouses.find((w) => w.id === startLocationId) ?? null}
              facilities={facilitiesData?.facilities?.map((f) => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng })) ?? []}
              aiOptions={aiOptions}
              onAiOptionsChange={actions.setAiOptimizationOptions}
              suggestedVehicleId={suggestedVehicleId}
              onSuggestedVehicleChange={actions.setSuggestedVehicle}
              vehicleSuggestions={vehicleSuggestions}
            />
          );
        }
        return (
          <Step3Batch
            batchName={batchName}
            onBatchNameChange={actions.setBatchName}
            priority={priority}
            onPriorityChange={actions.setPriority}
            scheduleTitle={scheduleTitle}
            startLocationName={startLocationName}
            plannedDate={plannedDate}
            planningWindowStart={planningWindowStart}
            planningWindowEnd={planningWindowEnd}
            timeWindow={timeWindow}
            facilities={workingSet}
            selectedVehicleIds={vehicleIds.length > 0 ? vehicleIds : (vehicleId ? [vehicleId] : [])}
            vehicles={vehicles}
            onVehicleChange={actions.commitVehicle}
            onVehiclesChange={actions.commitVehicles}
            selectedDriverId={driverId}
            drivers={drivers}
            onDriverChange={actions.assignDriver}
            slotAssignments={slotAssignments}
            onAssignSlot={actions.assignFacilityToSlot}
            onUnassignSlot={actions.unassignSlot}
            onAutoAssign={actions.autoAssignSlots}
            totalDistanceKm={totalDistanceKm}
            estimatedDurationMin={estimatedDurationMin}
          />
        );

      case 6: {
        if (scheduleMode === 'copilot') {
          return copilotPlan ? (
            <CopilotStep5Timeline
              plan={copilotPlan}
              vehicles={vehicles}
              drivers={drivers}
              onUpdateRun={actions.updateDispatchRunProposal}
            />
          ) : null;
        }
        const startLocation = warehouses.find(w => w.id === startLocationId) || null;
        return (
          <Step4Route
            facilities={workingSet}
            facilitiesWithCoords={effectiveCandidates}
            startLocation={startLocation}
            startLocationName={startLocationName}
            optimizedRoute={optimizedRoute}
            routeGeometry={routeGeometry}
            totalDistanceKm={totalDistanceKm}
            estimatedDurationMin={estimatedDurationMin}
            isOptimizing={isLoading}
            optimizationOptions={aiOptions}
            onOptimizationOptionsChange={actions.setAiOptimizationOptions}
            onOptimize={handleOptimizeRoute}
            executionWaves={executionProjection?.waves ?? []}
          />
        );
      }

      case 7:
        if (scheduleMode === 'copilot') {
          return copilotPlan && planningIntent ? (
            <CopilotStep6Approve plan={copilotPlan} intent={planningIntent} />
          ) : null;
        }
        return (
          <Step5Review
            sourceMethod={sourceMethod}
            sourceSubOption={sourceSubOption}
            scheduleTitle={scheduleTitle}
            startLocationName={startLocationName}
            plannedDate={plannedDate}
            planningWindowStart={planningWindowStart}
            planningWindowEnd={planningWindowEnd}
            timeWindow={timeWindow}
            batchName={batchName}
            priority={priority}
            vehicleName={selectedVehicle?.model || null}
            vehiclePlate={selectedVehicle?.plateNumber || null}
            vehicles={selectedVehicles.map((v) => ({
              id: v.id,
              name: v.model,
              plate: v.plateNumber,
            }))}
            driverName={selectedDriver?.name || null}
            totalDistanceKm={totalDistanceKm}
            estimatedDurationMin={estimatedDurationMin}
            facilities={workingSet}
            slotAssignments={slotAssignments}
            notes={scheduleNotes}
          />
        );

      default:
        return null;
    }
  }, [
    currentStep,
    scheduleMode,
    sourceMethod,
    sourceSubOption,
    scheduleTitle,
    startLocationId,
    startLocationType,
    plannedDate,
    planningWindowStart,
    planningWindowEnd,
    timeWindow,
    warehouses,
    effectiveCandidates,
    copilotFacilityCandidates,
    facilitiesLoading,
    workingSet,
    aiOptions,
    suggestedVehicleId,
    batchName,
    priority,
    startLocationName,
    vehicleId,
    vehicles,
    driverId,
    drivers,
    slotAssignments,
    totalDistanceKm,
    estimatedDurationMin,
    optimizedRoute,
    routeGeometry,
    isLoading,
    selectedVehicle,
    selectedVehicles,
    selectedDriver,
    scheduleNotes,
    parsedFacilities,
    policyContext,
    facilityPackaging,
    routingFallbackUsed,
    operationalSnapshot,
    vehicleIds,
    actions,
    handleOptimizeRoute,
    executionProjection,
    // copilot
    planningIntent,
    planningCandidates,
    copilotPlan,
  ]);

  // Dynamic step labels based on schedule mode
  const stepLabels = scheduleMode === 'copilot' ? COPILOT_STEP_LABELS : MANUAL_STEP_LABELS;
  const totalSteps = stepLabels.length;

  // Progress percentage
  const progressPct = (currentStep / totalSteps) * 100;

  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      if (!isOpen) actions.resetWorkflow();
      onOpenChange(isOpen);
    },
    [actions, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between pr-14">
            <DialogTitle>Create Dispatch Schedule</DialogTitle>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-4">
            {stepLabels.map((step, idx) => (
              <React.Fragment key={step.num}>
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    currentStep === step.num
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.num
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {currentStep > step.num ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span>{step.num}</span>
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {idx < stepLabels.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 rounded',
                      currentStep > step.num ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <Progress value={progressPct} className="h-1 mt-3" />
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">{renderStepContent}</div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0 bg-muted/30">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={actions.previousStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleReset}>
              Cancel
            </Button>

            {/* Step 3 (manual): Save Draft option */}
            {currentStep === 3 && scheduleMode === 'manual' && (
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={!canProceed || createPreBatch.isPending}
              >
                {createPreBatch.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Draft
              </Button>
            )}

            {/* Copilot final step (step 7) — Approve & Dispatch */}
            {scheduleMode === 'copilot' && currentStep === 7 ? (
              <Button onClick={handleConfirm} disabled={!canProceed || convertToBatch.isPending}>
                {convertToBatch.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Approve & Dispatch
              </Button>
            ) : scheduleMode === 'manual' && currentStep === 7 ? (
              <Button
                onClick={handleConfirm}
                disabled={!canProceed || convertToBatch.isPending}
              >
                {convertToBatch.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Create Batch
              </Button>
            ) : (
              <Button onClick={handleNextStep} disabled={!canProceed}>
                {scheduleMode === 'copilot' && currentStep === 4
                  ? 'Review Timeline'
                  : scheduleMode === 'manual' && currentStep === 4
                  ? 'Continue to Batch'
                  : 'Next'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UnifiedWorkflowDialog;
