/**
 * =====================================================
 * Unified Workflow Dialog
 * =====================================================
 * Main orchestrator for the 5-step unified workflow:
 * 1. Source → 2. Schedule → 3. Batch → 4. Route → 5. Review
 */

import * as React from 'react';
import {
  X,
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
import { Step1Source } from './steps/Step1Source';
import { Step2Schedule } from './steps/Step2Schedule';
import { Step3Batch } from './steps/Step3Batch';
import { Step4Route } from './steps/Step4Route';
import { Step5Review } from './steps/Step5Review';

// Store
import {
  useUnifiedWorkflowStore,
  useCurrentStep,
  useCanProceed,
  useWorkflowLoading,
  useWorkflowActions,
} from '@/stores/unifiedWorkflowStore';

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
  startStep?: 1 | 2 | 3;
  preBatchId?: string;
}

const STEP_LABELS = [
  { num: 1, label: 'Source' },
  { num: 2, label: 'Schedule' },
  { num: 3, label: 'Batch' },
  { num: 4, label: 'Route' },
  { num: 5, label: 'Review' },
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
  const sourceMethod = useUnifiedWorkflowStore((state) => state.source_method);
  const sourceSubOption = useUnifiedWorkflowStore((state) => state.source_sub_option);
  const scheduleTitle = useUnifiedWorkflowStore((state) => state.schedule_title);
  const startLocationId = useUnifiedWorkflowStore((state) => state.start_location_id);
  const startLocationType = useUnifiedWorkflowStore((state) => state.start_location_type);
  const plannedDate = useUnifiedWorkflowStore((state) => state.planned_date);
  const timeWindow = useUnifiedWorkflowStore((state) => state.time_window);
  const workingSet = useUnifiedWorkflowStore((state) => state.working_set);
  const aiOptions = useUnifiedWorkflowStore((state) => state.ai_optimization_options);
  const suggestedVehicleId = useUnifiedWorkflowStore((state) => state.suggested_vehicle_id);
  const scheduleNotes = useUnifiedWorkflowStore((state) => state.schedule_notes);
  const batchName = useUnifiedWorkflowStore((state) => state.batch_name);
  const priority = useUnifiedWorkflowStore((state) => state.priority);
  const vehicleId = useUnifiedWorkflowStore((state) => state.vehicle_id);
  const driverId = useUnifiedWorkflowStore((state) => state.driver_id);
  const slotAssignments = useUnifiedWorkflowStore((state) => state.slot_assignments);
  const optimizedRoute = useUnifiedWorkflowStore((state) => state.optimized_route);
  const totalDistanceKm = useUnifiedWorkflowStore((state) => state.total_distance_km);
  const estimatedDurationMin = useUnifiedWorkflowStore((state) => state.estimated_duration_min);
  const storePreBatchId = useUnifiedWorkflowStore((state) => state.pre_batch_id);
  const parsedFacilities = useUnifiedWorkflowStore((state) => state.parsed_facilities);

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

  // Use all facilities for manual mode, ready consignments for ready mode
  const effectiveCandidates = sourceMethod === 'manual' ? allFacilityCandidates : facilityCandidates;
  const effectiveCandidatesLoading = sourceMethod === 'manual' ? !facilitiesData : facilitiesLoading;

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

  // Get selected vehicle/driver names for review (memoized to prevent infinite loops)
  const selectedVehicle = React.useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId]
  );
  const selectedDriver = React.useMemo(
    () => drivers.find((d) => d.id === driverId),
    [drivers, driverId]
  );
  const startLocationName = React.useMemo(
    () => warehouses.find((w) => w.id === startLocationId)?.name || null,
    [warehouses, startLocationId]
  );

  // Initialize on open (only when dialog transitions from closed to open)
  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    // Only run when dialog opens (transitions from false to true)
    if (open && !prevOpenRef.current && startStep > 1) {
      useUnifiedWorkflowStore.getState().goToStep(startStep);
    }
    prevOpenRef.current = open;
  }, [open, startStep]);

  // Handle close (memoized to prevent infinite loops)
  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Handle reset and close (memoized to prevent infinite loops)
  const handleReset = React.useCallback(() => {
    actions.resetWorkflow();
    onOpenChange(false);
  }, [actions, onOpenChange]);

  // Handle save draft (Step 2) (memoized to prevent infinite loops)
  const handleSaveDraft = React.useCallback(async () => {
    try {
      await createPreBatch.mutateAsync({
        source_method: sourceMethod!,
        source_sub_option: sourceSubOption,
        schedule_title: scheduleTitle!,
        start_location_id: startLocationId!,
        start_location_type: startLocationType,
        planned_date: plannedDate!,
        time_window: timeWindow,
        facility_order: workingSet.map((w) => w.facility_id),
        facility_requisition_map: workingSet.reduce(
          (acc, w) => ({ ...acc, [w.facility_id]: w.requisition_ids }),
          {}
        ),
        ai_optimization_options: sourceSubOption === 'ai_optimization' ? aiOptions : null,
        suggested_vehicle_id: suggestedVehicleId,
        notes: scheduleNotes,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [
    createPreBatch,
    sourceMethod,
    sourceSubOption,
    scheduleTitle,
    startLocationId,
    startLocationType,
    plannedDate,
    timeWindow,
    workingSet,
    aiOptions,
    suggestedVehicleId,
    scheduleNotes,
    handleClose,
  ]);

  // Handle final confirm (Step 5) (memoized to prevent infinite loops)
  const handleConfirm = React.useCallback(async () => {
    try {
      // Ensure a pre-batch exists (create one if the user skipped "Save Draft")
      let preBatchId = storePreBatchId;

      if (!preBatchId) {
        const newPreBatch = await createPreBatch.mutateAsync({
          source_method: sourceMethod!,
          source_sub_option: sourceSubOption,
          schedule_title: scheduleTitle!,
          start_location_id: startLocationId!,
          start_location_type: startLocationType,
          planned_date: plannedDate!,
          time_window: timeWindow,
          facility_order: workingSet.map((w) => w.facility_id),
          facility_requisition_map: workingSet.reduce(
            (acc, w) => ({ ...acc, [w.facility_id]: w.requisition_ids }),
            {}
          ),
          ai_optimization_options: sourceSubOption === 'ai_optimization' ? aiOptions : null,
          suggested_vehicle_id: suggestedVehicleId,
          notes: scheduleNotes,
        });
        preBatchId = newPreBatch.id;
      }

      await convertToBatch.mutateAsync({
        preBatchId: preBatchId,
        batchName: batchName!,
        vehicleId: vehicleId!,
        driverId: driverId,
        priority: priority,
        slotAssignments: slotAssignments,
        optimizedRoute: optimizedRoute,
        totalDistanceKm: totalDistanceKm || undefined,
        estimatedDurationMin: estimatedDurationMin || undefined,
        notes: scheduleNotes,
      });
      actions.resetWorkflow();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create batch:', error);
    }
  }, [
    convertToBatch,
    createPreBatch,
    storePreBatchId,
    sourceMethod,
    sourceSubOption,
    scheduleTitle,
    startLocationId,
    startLocationType,
    plannedDate,
    timeWindow,
    workingSet,
    aiOptions,
    suggestedVehicleId,
    batchName,
    vehicleId,
    driverId,
    priority,
    slotAssignments,
    optimizedRoute,
    totalDistanceKm,
    estimatedDurationMin,
    scheduleNotes,
    actions,
    onOpenChange,
  ]);

  // Handle route optimization (Step 4) (memoized to prevent infinite loops)
  const handleOptimizeRoute = React.useCallback(async () => {
    const startLocation = warehouses.find(w => w.id === startLocationId) || null;
    await actions.optimizeRoute(facilityCandidates, startLocation);
  }, [actions, facilityCandidates, warehouses, startLocationId]);

  // Render step content (memoized to prevent infinite loops)
  const renderStepContent = React.useMemo(() => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Source
            sourceMethod={sourceMethod}
            sourceSubOption={sourceSubOption}
            onSourceMethodChange={actions.setSourceMethod}
            onSourceSubOptionChange={actions.setSourceSubOption}
          />
        );

      case 2:
        return (
          <Step2Schedule
            title={scheduleTitle}
            onTitleChange={actions.setScheduleTitle}
            startLocationId={startLocationId}
            startLocationType={startLocationType}
            onStartLocationChange={actions.setStartLocation}
            plannedDate={plannedDate}
            onPlannedDateChange={actions.setPlannedDate}
            timeWindow={timeWindow}
            onTimeWindowChange={actions.setTimeWindow}
            sourceMethod={sourceMethod}
            warehouses={warehouses}
            facilities={facilitiesData?.facilities?.map((f) => ({ id: f.id, name: f.name })) ?? []}
            candidates={effectiveCandidates}
            candidatesLoading={effectiveCandidatesLoading}
            workingSet={workingSet}
            onAddToWorkingSet={actions.addToWorkingSet}
            onRemoveFromWorkingSet={actions.removeFromWorkingSet}
            onReorderWorkingSet={actions.reorderWorkingSet}
            onClearWorkingSet={actions.clearWorkingSet}
            sourceSubOption={sourceSubOption}
            aiOptions={aiOptions}
            onAiOptionsChange={actions.setAiOptimizationOptions}
            suggestedVehicleId={suggestedVehicleId}
            onSuggestedVehicleChange={actions.setSuggestedVehicle}
            vehicleSuggestions={vehicleSuggestions}
            parsedFacilities={parsedFacilities}
            onFileParsed={actions.setParsedFacilities}
            onUpdateParsedRow={actions.updateParsedFacility}
          />
        );

      case 3:
        return (
          <Step3Batch
            batchName={batchName}
            onBatchNameChange={actions.setBatchName}
            priority={priority}
            onPriorityChange={actions.setPriority}
            scheduleTitle={scheduleTitle}
            startLocationName={startLocationName}
            plannedDate={plannedDate}
            timeWindow={timeWindow}
            facilities={workingSet}
            selectedVehicleId={vehicleId}
            vehicles={vehicles}
            onVehicleChange={actions.commitVehicle}
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

      case 4:
        const startLocation = warehouses.find(w => w.id === startLocationId) || null;
        return (
          <Step4Route
            facilities={workingSet}
            facilitiesWithCoords={facilityCandidates}
            startLocation={startLocation}
            startLocationName={startLocationName}
            optimizedRoute={optimizedRoute}
            totalDistanceKm={totalDistanceKm}
            estimatedDurationMin={estimatedDurationMin}
            isOptimizing={isLoading}
            optimizationOptions={aiOptions}
            onOptimizationOptionsChange={actions.setAiOptimizationOptions}
            onOptimize={handleOptimizeRoute}
          />
        );

      case 5:
        return (
          <Step5Review
            sourceMethod={sourceMethod}
            sourceSubOption={sourceSubOption}
            scheduleTitle={scheduleTitle}
            startLocationName={startLocationName}
            plannedDate={plannedDate}
            timeWindow={timeWindow}
            batchName={batchName}
            priority={priority}
            vehicleName={selectedVehicle?.model || null}
            vehiclePlate={selectedVehicle?.plateNumber || null}
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
    sourceMethod,
    sourceSubOption,
    scheduleTitle,
    startLocationId,
    startLocationType,
    plannedDate,
    timeWindow,
    warehouses,
    facilityCandidates,
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
    isLoading,
    selectedVehicle,
    selectedDriver,
    scheduleNotes,
    parsedFacilities,
    actions,
    handleOptimizeRoute,
  ]);

  // Progress percentage
  const progressPct = (currentStep / 5) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Create Dispatch Schedule</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-4">
            {STEP_LABELS.map((step, idx) => (
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
                {idx < STEP_LABELS.length - 1 && (
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

            {/* Step 2: Save Draft option */}
            {currentStep === 2 && (
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

            {/* Final step: Confirm */}
            {currentStep === 5 ? (
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
              <Button onClick={actions.nextStep} disabled={!canProceed}>
                {currentStep === 2 ? 'Proceed to Batch' : 'Next'}
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
