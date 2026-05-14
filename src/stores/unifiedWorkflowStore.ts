/**
 * =====================================================
 * Unified Scheduler-Batch Workflow Store (Zustand)
 * =====================================================
 * Manages the 5-step unified workflow state:
 * 1. Source → 2. Schedule → 3. Batch → 4. Route → 5. Review
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  UnifiedWorkflowStep,
  UnifiedWorkflowState,
  UnifiedWorkflowActions,
  UnifiedWorkflowStore,
  ScheduleMode,
  SourceMethod,
  SourceSubOption,
  StartLocationType,
  WorkingSetItem,
  AiOptimizationOptions,
  SlotAssignment,
  SlotAssignmentMap,
  ParsedFacility,
  PolicyContext,
  FacilityPackagingData,
} from '@/types/unified-workflow';
import type { TimeWindow, Priority, RoutePoint } from '@/types/scheduler';
import { calculateDistance, calculateRouteDistance } from '@/lib/routeOptimization';
import { getRoadRoute } from '@/lib/geoapify';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Nearest neighbor algorithm for route optimization
 * Greedily selects the closest unvisited facility at each step
 */
function optimizeNearestNeighbor(
  facilities: Array<{ id: string; name: string; lat: number; lng: number; sequence: number }>,
  startLocation?: { lat?: number; lng?: number } | null
): Array<{ id: string; name: string; lat: number; lng: number; sequence: number }> {
  if (facilities.length === 0) return [];
  if (facilities.length === 1) return facilities;

  const unvisited = [...facilities];
  const optimized: typeof facilities = [];

  // Starting point
  let current: { lat: number; lng: number } = startLocation?.lat && startLocation?.lng
    ? { lat: startLocation.lat, lng: startLocation.lng }
    : { lat: facilities[0].lat, lng: facilities[0].lng };

  // If we don't have a start location, use the first facility and remove it from unvisited
  if (!startLocation?.lat || !startLocation?.lng) {
    optimized.push(unvisited.shift()!);
    current = optimized[0];
  }

  // Nearest neighbor algorithm
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistance(
      current.lat,
      current.lng,
      unvisited[0].lat,
      unvisited[0].lng
    );

    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(
        current.lat,
        current.lng,
        unvisited[i].lat,
        unvisited[i].lng
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    const nearest = unvisited.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    current = nearest;
  }

  return optimized;
}

// =====================================================
// INITIAL STATE
// =====================================================

const initialAiOptions: AiOptimizationOptions = {
  shortest_distance: true, // Enable by default for optimal route
  fastest_route: false,
  efficiency: false,
  priority_complex: false,
};

const initialState: UnifiedWorkflowState = {
  // Navigation
  current_step: 1,
  is_loading: false,
  error: null,

  // Step 1: Schedule Mode
  schedule_mode: null,

  // Step 2: Source
  source_method: null,
  source_sub_option: null,

  // Step 2: Schedule Header
  schedule_title: null,
  start_location_id: null,
  start_location_type: 'warehouse',
  planned_date: null,
  planning_window_start: null,
  planning_window_end: null,
  time_window: null,

  // Step 2: Working Set
  working_set: [],

  // Step 2: Decision Support
  ai_optimization_options: initialAiOptions,
  suggested_vehicle_id: null,
  suggested_vehicle_ids: [],

  // Step 2: Notes
  schedule_notes: null,

  // Step 3: Batch Details
  batch_name: null,
  priority: 'medium',
  vehicle_id: null,
  vehicle_ids: [],
  driver_id: null,

  // Step 3: Slot Assignments
  slot_assignments: {},

  // Step 4: Route
  optimized_route: [],
  route_geometry: null,
  total_distance_km: null,
  estimated_duration_min: null,

  // Cross-domain References
  pre_batch_id: null,
  final_batch_id: null,

  // File Upload
  uploaded_file: null,
  parsed_facilities: null,

  // Policy Context
  policy_context: null,

  // Step 3: Packaging
  facility_packaging: {},

  // Routing diagnostics
  routing_fallback_used: false,

  // Copilot
  planning_intent: null,
  planning_candidates: null,
  copilot_plan: null,
};

// =====================================================
// STORE CREATION
// =====================================================

export const useUnifiedWorkflowStore = create<UnifiedWorkflowStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // =====================================================
        // NAVIGATION ACTIONS
        // =====================================================

        nextStep: () => {
          const { current_step, canProceedToNextStep } = get();
          if (canProceedToNextStep() && current_step < 7) {
            set(
              { current_step: (current_step + 1) as UnifiedWorkflowStep },
              false,
              'unified/nextStep'
            );
          }
        },

        previousStep: () => {
          const { current_step } = get();
          if (current_step > 1) {
            set(
              { current_step: (current_step - 1) as UnifiedWorkflowStep },
              false,
              'unified/previousStep'
            );
          }
        },

        goToStep: (step: UnifiedWorkflowStep) => {
          set({ current_step: step }, false, 'unified/goToStep');
        },

        resetWorkflow: () => {
          set({ ...initialState }, false, 'unified/reset');
        },

        // =====================================================
        // STEP 1: SCHEDULE MODE SELECTION
        // =====================================================

        setScheduleMode: (mode: ScheduleMode) => {
          set({ schedule_mode: mode }, false, 'unified/setScheduleMode');
        },

        // =====================================================
        // STEP 2: SOURCE SELECTION
        // =====================================================

        setSourceMethod: (method: SourceMethod) => {
          set(
            {
              source_method: method,
              source_sub_option: method === 'ready' ? 'manual_scheduling' : null,
            },
            false,
            'unified/setSourceMethod'
          );
        },

        setSourceSubOption: (option: SourceSubOption | null) => {
          set({ source_sub_option: option }, false, 'unified/setSourceSubOption');
        },

        // =====================================================
        // STEP 2: SCHEDULE HEADER
        // =====================================================

        setScheduleTitle: (title: string) => {
          set({ schedule_title: title }, false, 'unified/setScheduleTitle');
        },

        setStartLocation: (id: string, type: StartLocationType) => {
          set(
            {
              start_location_id: id,
              start_location_type: type,
            },
            false,
            'unified/setStartLocation'
          );
        },

        setPlannedDate: (date: string) => {
          set(
            {
              planned_date: date,
              planning_window_start: date,
              // keep end in sync if not set separately
            },
            false,
            'unified/setPlannedDate'
          );
        },

        setPlanningWindow: (start: string, end: string | null) => {
          set(
            {
              planning_window_start: start,
              planning_window_end: end,
              planned_date: start, // backward compat
            },
            false,
            'unified/setPlanningWindow'
          );
        },

        setTimeWindow: (window: TimeWindow | null) => {
          set({ time_window: window }, false, 'unified/setTimeWindow');
        },

        setScheduleNotes: (notes: string | null) => {
          set({ schedule_notes: notes }, false, 'unified/setScheduleNotes');
        },

        // =====================================================
        // STEP 2: WORKING SET (Middle Column)
        // =====================================================

        addToWorkingSet: (item: WorkingSetItem) => {
          const { working_set } = get();
          // Check if facility already exists
          if (working_set.some((ws) => ws.facility_id === item.facility_id)) {
            return;
          }
          // Add with correct sequence
          const newItem: WorkingSetItem = {
            ...item,
            sequence: working_set.length + 1,
          };
          set(
            { working_set: [...working_set, newItem] },
            false,
            'unified/addToWorkingSet'
          );
        },

        removeFromWorkingSet: (facilityId: string) => {
          const { working_set } = get();
          const filtered = working_set.filter((ws) => ws.facility_id !== facilityId);
          // Re-sequence
          const resequenced = filtered.map((ws, idx) => ({
            ...ws,
            sequence: idx + 1,
          }));
          set({ working_set: resequenced }, false, 'unified/removeFromWorkingSet');
        },

        reorderWorkingSet: (fromIndex: number, toIndex: number) => {
          const { working_set } = get();
          if (
            fromIndex < 0 ||
            fromIndex >= working_set.length ||
            toIndex < 0 ||
            toIndex >= working_set.length
          ) {
            return;
          }

          const items = [...working_set];
          const [movedItem] = items.splice(fromIndex, 1);
          items.splice(toIndex, 0, movedItem);

          // Re-sequence
          const resequenced = items.map((ws, idx) => ({
            ...ws,
            sequence: idx + 1,
          }));

          set({ working_set: resequenced }, false, 'unified/reorderWorkingSet');
        },

        clearWorkingSet: () => {
          set({ working_set: [] }, false, 'unified/clearWorkingSet');
        },

        setWorkingSet: (items: WorkingSetItem[]) => {
          // Ensure proper sequencing
          const sequenced = items.map((item, idx) => ({
            ...item,
            sequence: idx + 1,
          }));
          set({ working_set: sequenced }, false, 'unified/setWorkingSet');
        },

        // =====================================================
        // STEP 2: AI OPTIMIZATION OPTIONS
        // =====================================================

        setAiOptimizationOptions: (options: Partial<AiOptimizationOptions>) => {
          const { ai_optimization_options } = get();
          set(
            {
              ai_optimization_options: {
                ...ai_optimization_options,
                ...options,
              },
            },
            false,
            'unified/setAiOptimizationOptions'
          );
        },

        toggleAiOption: (option: keyof AiOptimizationOptions) => {
          const { ai_optimization_options } = get();
          set(
            {
              ai_optimization_options: {
                ...ai_optimization_options,
                [option]: !ai_optimization_options[option],
              },
            },
            false,
            'unified/toggleAiOption'
          );
        },

        // =====================================================
        // STEP 2: VEHICLE SUGGESTION
        // =====================================================

        setSuggestedVehicle: (vehicleId: string | null) => {
          set(
            {
              suggested_vehicle_id: vehicleId,
              suggested_vehicle_ids: vehicleId ? [vehicleId] : [],
            },
            false,
            'unified/setSuggestedVehicle'
          );
        },

        setSuggestedVehicles: (vehicleIds: string[]) => {
          set(
            {
              suggested_vehicle_ids: vehicleIds,
              suggested_vehicle_id: vehicleIds[0] ?? null,
            },
            false,
            'unified/setSuggestedVehicles'
          );
        },

        // =====================================================
        // STEP 2: FILE UPLOAD
        // =====================================================

        setUploadedFile: (file: File | null) => {
          set({ uploaded_file: file }, false, 'unified/setUploadedFile');
        },

        setParsedFacilities: (facilities: ParsedFacility[] | null) => {
          set({ parsed_facilities: facilities }, false, 'unified/setParsedFacilities');
        },

        updateParsedFacility: (rowIndex: number, updates: Partial<ParsedFacility>) => {
          const { parsed_facilities } = get();
          if (!parsed_facilities) return;

          const updated = parsed_facilities.map((f) =>
            f.row_index === rowIndex ? { ...f, ...updates, user_corrected: true } : f
          );
          set({ parsed_facilities: updated }, false, 'unified/updateParsedFacility');
        },

        // =====================================================
        // STEP 2: POLICY CONTEXT
        // =====================================================

        setPolicyContext: (context: PolicyContext | null) => {
          set({ policy_context: context }, false, 'unified/setPolicyContext');
        },

        // =====================================================
        // STEP 3: FACILITY PACKAGING
        // =====================================================

        setFacilityPackaging: (facilityId: string, data: FacilityPackagingData | null) => {
          const { facility_packaging } = get();
          if (data === null) {
            const { [facilityId]: _, ...rest } = facility_packaging;
            set({ facility_packaging: rest }, false, 'unified/setFacilityPackaging/clear');
          } else {
            set(
              { facility_packaging: { ...facility_packaging, [facilityId]: data } },
              false,
              'unified/setFacilityPackaging'
            );
          }
        },

        // =====================================================
        // STEP 2 -> PRE-BATCH OPERATIONS
        // =====================================================

        savePreBatch: async (): Promise<string> => {
          // Actual persistence is handled by the useCreatePreBatch mutation in
          // UnifiedWorkflowDialog. This store method exists only to allow external
          // callers to signal that a pre-batch save should happen; the dialog wires
          // up the real mutation and calls actions.set({ pre_batch_id }) on success.
          throw new Error(
            'savePreBatch must be called via useCreatePreBatch in UnifiedWorkflowDialog, not directly from the store.'
          );
        },

        loadPreBatch: async (id: string): Promise<void> => {
          // Loading a pre-batch hydrates the store from DB data. Callers should
          // use usePreBatch(id) query and map fields into the store manually.
          set({ pre_batch_id: id }, false, 'unified/loadPreBatch/setRef');
        },

        // =====================================================
        // STEP 3: BATCH DETAILS
        // =====================================================

        setBatchName: (name: string) => {
          set({ batch_name: name }, false, 'unified/setBatchName');
        },

        setPriority: (priority: Priority) => {
          set({ priority }, false, 'unified/setPriority');
        },

        commitVehicle: (vehicleId: string) => {
          const prev = get().vehicle_ids;
          const next = prev.includes(vehicleId) ? prev : [vehicleId, ...prev.filter(id => id !== vehicleId)];
          set(
            {
              vehicle_id: vehicleId,
              vehicle_ids: next,
              slot_assignments: {},
            },
            false,
            'unified/commitVehicle'
          );
        },

        commitVehicles: (vehicleIds: string[]) => {
          set(
            {
              vehicle_ids: vehicleIds,
              vehicle_id: vehicleIds[0] ?? null,
              slot_assignments: {},
            },
            false,
            'unified/commitVehicles'
          );
        },

        assignDriver: (driverId: string | null) => {
          set({ driver_id: driverId }, false, 'unified/assignDriver');
        },

        // =====================================================
        // STEP 3: SLOT ASSIGNMENTS
        // =====================================================

        assignFacilityToSlot: (
          slotKey: string,
          facilityId: string,
          requisitionIds: string[]
        ) => {
          const { slot_assignments, working_set } = get();

          // Find facility info from working set
          const facility = working_set.find((ws) => ws.facility_id === facilityId);

          const assignment: SlotAssignment = {
            slot_key: slotKey,
            facility_id: facilityId,
            facility_name: facility?.facility_name,
            requisition_ids: requisitionIds,
            slot_demand: facility?.slot_demand ?? 1,
            weight_kg: facility?.weight_kg,
            volume_m3: facility?.volume_m3,
          };

          set(
            {
              slot_assignments: {
                ...slot_assignments,
                [slotKey]: assignment,
              },
            },
            false,
            'unified/assignFacilityToSlot'
          );
        },

        unassignSlot: (slotKey: string) => {
          const { slot_assignments } = get();
          const { [slotKey]: _, ...rest } = slot_assignments;
          set({ slot_assignments: rest }, false, 'unified/unassignSlot');
        },

        autoAssignSlots: () => {
          const { working_set, vehicle_ids, vehicle_id } = get();

          // Determine primary vehicle for slot key generation
          const primaryVehicleId = vehicle_ids[0] ?? vehicle_id ?? 'vehicle';

          const newAssignments: SlotAssignmentMap = {};
          working_set.forEach((ws, index) => {
            // slot_key format matches DB constraint: "{vehicleId}-standard-{n}"
            const slotKey = `${primaryVehicleId}-standard-${index + 1}`;
            newAssignments[slotKey] = {
              slot_key:        slotKey,
              facility_id:     ws.facility_id,
              facility_name:   ws.facility_name,
              requisition_ids: ws.requisition_ids,
              slot_demand:     ws.slot_demand,
              weight_kg:       ws.weight_kg,
              volume_m3:       ws.volume_m3,
              tier_name:       'standard',
              tier_order:      1,
              slot_number:     index + 1,
            };
          });

          set({ slot_assignments: newAssignments }, false, 'unified/autoAssignSlots');
        },

        clearSlotAssignments: () => {
          set({ slot_assignments: {} }, false, 'unified/clearSlotAssignments');
        },

        // =====================================================
        // STEP 4: ROUTE OPTIMIZATION
        // =====================================================

        optimizeRoute: async (
          facilitiesWithCoords: Array<{ id: string; lat?: number; lng?: number }> = [],
          startLocation?: { lat?: number; lng?: number } | null
        ): Promise<void> => {
          set({ is_loading: true, error: null }, false, 'unified/optimizeRoute/start');

          const { working_set, ai_optimization_options } = get();

          // Create facility lookup map
          const facilityMap = new Map(facilitiesWithCoords.map((f) => [f.id, f]));

          // Build list of facilities with coordinates
          const facilitiesWithValidCoords = working_set
            .map((ws) => {
              const coords = facilityMap.get(ws.facility_id);
              return coords?.lat && coords?.lng
                ? {
                    id: ws.facility_id,
                    name: ws.facility_name,
                    lat: coords.lat,
                    lng: coords.lng,
                    sequence: ws.sequence,
                  }
                : null;
            })
            .filter((f): f is NonNullable<typeof f> => f !== null);

          if (facilitiesWithValidCoords.length === 0) {
            set(
              {
                error: 'No facilities with valid coordinates found',
                is_loading: false,
              },
              false,
              'unified/optimizeRoute/error'
            );
            return;
          }

          // Apply optimization based on selected options
          let optimizedFacilities = [...facilitiesWithValidCoords];

          if (ai_optimization_options.shortest_distance) {
            // Use nearest neighbor algorithm for shortest distance
            optimizedFacilities = optimizeNearestNeighbor(
              facilitiesWithValidCoords,
              startLocation
            );
          } else if (ai_optimization_options.fastest_route) {
            // For fastest route, prioritize highways/main roads (simplified: use shortest distance)
            optimizedFacilities = optimizeNearestNeighbor(
              facilitiesWithValidCoords,
              startLocation
            );
          } else if (ai_optimization_options.priority_complex) {
            // Keep original order (assumes facilities are already ordered by priority)
            optimizedFacilities = facilitiesWithValidCoords;
          } else {
            // Default: use current working set order
            optimizedFacilities = facilitiesWithValidCoords.sort((a, b) => a.sequence - b.sequence);
          }

          // Build route points
          const route: RoutePoint[] = optimizedFacilities.map((f, idx) => ({
            lat: f.lat,
            lng: f.lng,
            facility_id: f.id,
            sequence: idx + 1,
          }));

          // Build ordered waypoints for road routing
          const waypoints: Array<{ lat: number; lng: number }> = [];
          if (startLocation?.lat && startLocation?.lng) {
            waypoints.push({ lat: startLocation.lat, lng: startLocation.lng });
          }
          optimizedFacilities.forEach((f) => waypoints.push({ lat: f.lat, lng: f.lng }));

          // Fetch actual road route
          let roadGeometry: Array<[number, number]> | null = null;
          let totalDistance = 0;
          let estimatedDuration = 0;

          const roadResult = waypoints.length >= 2
            ? await getRoadRoute(waypoints, ai_optimization_options.fastest_route ? 'balanced' : 'short')
            : null;

          let routeFallbackUsed = false;

          if (roadResult) {
            roadGeometry = roadResult.geometry;
            totalDistance = roadResult.roadDistanceKm;
            const serviceTimeMin = optimizedFacilities.length * 20;
            estimatedDuration = Math.round(roadResult.roadTimeMinutes + serviceTimeMin + 15);
          } else {
            // Straight-line fallback — coordinates must be [lng, lat] for GeoJSON convention
            routeFallbackUsed = true;
            const straightCoords: [number, number][] = waypoints.map(w => [w.lng, w.lat]);
            if (straightCoords.length >= 2) {
              totalDistance = calculateRouteDistance(straightCoords);
            }
            const travelTimeMin = (totalDistance / 40) * 60;
            estimatedDuration = Math.round(travelTimeMin + optimizedFacilities.length * 20 + 15);
          }

          set(
            {
              optimized_route: route,
              route_geometry: roadGeometry,
              total_distance_km: Math.round(totalDistance * 100) / 100,
              estimated_duration_min: estimatedDuration,
              routing_fallback_used: routeFallbackUsed,
              is_loading: false,
              // Warn user if routing API was unavailable
              error: routeFallbackUsed
                ? 'Road routing unavailable — distances estimated using straight-line calculation. ETAs may be inaccurate.'
                : null,
            },
            false,
            'unified/optimizeRoute/success'
          );
        },

        setOptimizedRoute: (route: RoutePoint[], distance: number, duration: number) => {
          set(
            {
              optimized_route: route,
              total_distance_km: distance,
              estimated_duration_min: duration,
            },
            false,
            'unified/setOptimizedRoute'
          );
        },

        // =====================================================
        // STEP 5: FINALIZE
        // =====================================================

        confirmAndCreateBatch: async (): Promise<string> => {
          // Actual batch creation is handled by useConvertPreBatchToBatch in
          // UnifiedWorkflowDialog which has access to React Query context.
          // This stub exists only to satisfy the interface contract.
          throw new Error(
            'confirmAndCreateBatch must be called via useConvertPreBatchToBatch in UnifiedWorkflowDialog, not directly from the store.'
          );
        },

        // =====================================================
        // VALIDATION
        // =====================================================

        canProceedToNextStep: (): boolean => {
          const state = get();

          switch (state.current_step) {
            case 1:
              // Step 1: Must have schedule mode selected
              return state.schedule_mode !== null;

            case 2:
              // Step 2: Must have source method selected
              if (!state.source_method) return false;
              if (state.source_method === 'ready' && !state.source_sub_option) {
                return false;
              }
              return true;

            case 3: {
              // Copilot: must have planning intent with window defined
              if (state.schedule_mode === 'copilot') {
                return (
                  state.planning_intent !== null &&
                  !!state.planning_intent.planning_window_start &&
                  !!state.planning_intent.planning_window_end
                );
              }
              // Manual: Must have schedule details and working set
              const hasScheduleDetails =
                state.schedule_title !== null &&
                state.schedule_title.trim() !== '' &&
                state.start_location_id !== null &&
                (state.planning_window_start !== null || state.planned_date !== null);

              if (state.source_method === 'service_policy') {
                return (
                  hasScheduleDetails &&
                  state.policy_context !== null &&
                  state.working_set.length > 0
                );
              }
              if (state.source_method === 'upload') {
                return hasScheduleDetails && state.working_set.length > 0;
              }
              return hasScheduleDetails && state.working_set.length > 0;
            }

            case 4: {
              // Copilot: must have planning candidates resolved
              if (state.schedule_mode === 'copilot') {
                return state.planning_candidates !== null;
              }
              // Manual: All facilities must have packaging defined
              if (state.working_set.length === 0) return false;
              return state.working_set.every(
                (ws) =>
                  state.facility_packaging[ws.facility_id] !== undefined &&
                  state.facility_packaging[ws.facility_id].packages.length > 0
              );
            }

            case 5:
              // Copilot: must have plan generated
              if (state.schedule_mode === 'copilot') {
                return state.copilot_plan !== null;
              }
              // Manual: Must have batch name and at least one vehicle committed
              return (
                state.batch_name !== null &&
                state.batch_name.trim() !== '' &&
                (state.vehicle_ids.length > 0 || state.vehicle_id !== null)
              );

            case 6:
              // Copilot: review/approve — always can proceed
              if (state.schedule_mode === 'copilot') return true;
              // Manual: Must have optimized route
              return state.optimized_route.length > 0;

            case 7:
              // Step 7: Review — always can proceed (to submit)
              return true;

            default:
              return false;
          }
        },

        getValidationErrors: (): string[] => {
          const state = get();
          const errors: string[] = [];

          switch (state.current_step) {
            case 1:
              if (!state.schedule_mode) {
                errors.push('Please select a scheduling mode');
              }
              break;

            case 2:
              if (!state.source_method) {
                errors.push('Please select a source method');
              }
              if (state.source_method === 'ready' && !state.source_sub_option) {
                errors.push('Please select a scheduling option');
              }
              break;

            case 3:
              if (!state.schedule_title || state.schedule_title.trim() === '') {
                errors.push('Schedule title is required');
              }
              if (!state.start_location_id) {
                errors.push('Start location is required');
              }
              if (!state.planning_window_start && !state.planned_date) {
                errors.push('Planning window is required');
              }
              if (state.source_method === 'service_policy' && !state.policy_context) {
                errors.push('Please select a service policy cluster');
              }
              if (state.working_set.length === 0) {
                if (state.source_method === 'upload') {
                  errors.push('Please upload a file and add matched facilities to the schedule');
                } else {
                  errors.push('Please add at least one facility to the schedule');
                }
              }
              break;

            case 4: {
              const pendingFacilities = state.working_set.filter(
                (ws) =>
                  !state.facility_packaging[ws.facility_id] ||
                  state.facility_packaging[ws.facility_id].packages.length === 0
              );
              if (pendingFacilities.length > 0) {
                errors.push(
                  `${pendingFacilities.length} ${pendingFacilities.length === 1 ? 'facility' : 'facilities'} still need packaging defined`
                );
              }
              break;
            }

            case 5:
              if (!state.batch_name || state.batch_name.trim() === '') {
                errors.push('Batch name is required');
              }
              if (state.vehicle_ids.length === 0 && !state.vehicle_id) {
                errors.push('At least one vehicle is required');
              }
              break;

            case 6:
              if (state.optimized_route.length === 0) {
                errors.push('Route optimization is required');
              }
              break;
          }

          return errors;
        },

        // =====================================================
        // LOADING / ERROR
        // =====================================================

        setLoading: (loading: boolean) => {
          set({ is_loading: loading }, false, 'unified/setLoading');
        },

        setError: (error: string | null) => {
          set({ error }, false, 'unified/setError');
        },

        // =====================================================
        // COPILOT ACTIONS
        // =====================================================

        setPlanningIntent: (intent) => {
          set({ planning_intent: intent }, false, 'unified/setPlanningIntent');
        },

        setPlanningCandidates: (candidates) => {
          set({ planning_candidates: candidates }, false, 'unified/setPlanningCandidates');
        },

        setCopilotPlan: (plan) => {
          set({ copilot_plan: plan }, false, 'unified/setCopilotPlan');
        },

        updateDispatchRunProposal: (runId, updates) => {
          const { copilot_plan } = get();
          if (!copilot_plan) return;
          set(
            {
              copilot_plan: {
                ...copilot_plan,
                dispatch_runs: copilot_plan.dispatch_runs.map((r) =>
                  r.id === runId ? { ...r, ...updates, user_overridden: true } : r
                ),
              },
            },
            false,
            'unified/updateDispatchRunProposal'
          );
        },
      }),
      {
        name: 'unified-workflow-storage',
        // Selectively persist (exclude files and loading state)
        partialize: (state) => ({
          current_step: state.current_step,
          schedule_mode: state.schedule_mode,
          source_method: state.source_method,
          source_sub_option: state.source_sub_option,
          schedule_title: state.schedule_title,
          start_location_id: state.start_location_id,
          start_location_type: state.start_location_type,
          planned_date: state.planned_date,
          planning_window_start: state.planning_window_start,
          planning_window_end: state.planning_window_end,
          time_window: state.time_window,
          working_set: state.working_set,
          ai_optimization_options: state.ai_optimization_options,
          suggested_vehicle_id: state.suggested_vehicle_id,
          suggested_vehicle_ids: state.suggested_vehicle_ids,
          schedule_notes: state.schedule_notes,
          batch_name: state.batch_name,
          priority: state.priority,
          vehicle_id: state.vehicle_id,
          vehicle_ids: state.vehicle_ids,
          driver_id: state.driver_id,
          slot_assignments: state.slot_assignments,
          optimized_route: state.optimized_route,
          total_distance_km: state.total_distance_km,
          estimated_duration_min: state.estimated_duration_min,
          pre_batch_id: state.pre_batch_id,
          final_batch_id: state.final_batch_id,
          facility_packaging: state.facility_packaging,
          routing_fallback_used: state.routing_fallback_used,
        }),
      }
    ),
    { name: 'UnifiedWorkflow' }
  )
);

// =====================================================
// SELECTOR HOOKS
// =====================================================

/** Get current step */
export const useCurrentStep = () =>
  useUnifiedWorkflowStore((state) => state.current_step);

/** Get source method */
export const useSourceMethod = () =>
  useUnifiedWorkflowStore((state) => state.source_method);

/** Get source sub-option */
export const useSourceSubOption = () =>
  useUnifiedWorkflowStore((state) => state.source_sub_option);

/** Get schedule details */
export const useScheduleDetails = () =>
  useUnifiedWorkflowStore(useShallow((state) => ({
    title: state.schedule_title,
    startLocationId: state.start_location_id,
    startLocationType: state.start_location_type,
    plannedDate: state.planned_date,
    planningWindowStart: state.planning_window_start,
    planningWindowEnd: state.planning_window_end,
    timeWindow: state.time_window,
    notes: state.schedule_notes,
  })));

/** Get working set */
export const useWorkingSet = () =>
  useUnifiedWorkflowStore((state) => state.working_set);

/** Get AI optimization options */
export const useAiOptions = () =>
  useUnifiedWorkflowStore((state) => state.ai_optimization_options);

/** Get batch details */
export const useBatchDetails = () =>
  useUnifiedWorkflowStore(useShallow((state) => ({
    name: state.batch_name,
    priority: state.priority,
    vehicleId: state.vehicle_id,
    driverId: state.driver_id,
  })));

/** Get slot assignments */
export const useSlotAssignments = () =>
  useUnifiedWorkflowStore((state) => state.slot_assignments);

/** Get route info */
export const useRouteInfo = () =>
  useUnifiedWorkflowStore(useShallow((state) => ({
    route: state.optimized_route,
    distanceKm: state.total_distance_km,
    durationMin: state.estimated_duration_min,
  })));

/** Get loading state */
export const useWorkflowLoading = () =>
  useUnifiedWorkflowStore((state) => state.is_loading);

/** Get error state */
export const useWorkflowError = () =>
  useUnifiedWorkflowStore((state) => state.error);

/** Check if can proceed */
export const useCanProceed = () =>
  useUnifiedWorkflowStore((state) => {
    // Inline validation logic to avoid calling get() which can cause loops
    switch (state.current_step) {
      case 1:
        return state.schedule_mode !== null;

      case 2:
        if (!state.source_method) return false;
        if (state.source_method === 'ready' && !state.source_sub_option) {
          return false;
        }
        return true;

      case 3: {
        if (state.schedule_mode === 'copilot') {
          return (
            state.planning_intent !== null &&
            !!state.planning_intent.planning_window_start &&
            !!state.planning_intent.planning_window_end
          );
        }
        const hasScheduleDetails =
          state.schedule_title !== null &&
          state.schedule_title.trim() !== '' &&
          state.start_location_id !== null &&
          (state.planning_window_start !== null || state.planned_date !== null);

        if (state.source_method === 'service_policy') {
          return (
            hasScheduleDetails &&
            state.policy_context !== null &&
            state.working_set.length > 0
          );
        }

        return hasScheduleDetails && state.working_set.length > 0;
      }

      case 4:
        if (state.schedule_mode === 'copilot') return state.planning_candidates !== null;
        if (state.working_set.length === 0) return false;
        return state.working_set.every(
          (ws) =>
            state.facility_packaging[ws.facility_id] !== undefined &&
            state.facility_packaging[ws.facility_id].packages.length > 0
        );

      case 5:
        if (state.schedule_mode === 'copilot') return state.copilot_plan !== null;
        return (
          state.batch_name !== null &&
          state.batch_name.trim() !== '' &&
          (state.vehicle_ids.length > 0 || state.vehicle_id !== null)
        );

      case 6:
        if (state.schedule_mode === 'copilot') return true;
        return state.optimized_route.length > 0;

      case 7:
        return true;

      default:
        return false;
    }
  });

/** Get validation errors */
export const useValidationErrors = () =>
  useUnifiedWorkflowStore((state) => {
    // Inline validation logic to avoid calling get() which can cause loops
    const errors: string[] = [];

    switch (state.current_step) {
      case 1:
        if (!state.schedule_mode) {
          errors.push('Please select a scheduling mode');
        }
        break;

      case 2:
        if (!state.source_method) {
          errors.push('Please select a source method');
        }
        if (state.source_method === 'ready' && !state.source_sub_option) {
          errors.push('Please select a scheduling option');
        }
        break;

      case 3:
        if (state.schedule_mode === 'copilot') {
          if (!state.planning_intent?.planning_window_start) {
            errors.push('Planning window start date is required');
          }
          if (!state.planning_intent?.planning_window_end) {
            errors.push('Planning window end date is required');
          }
        } else {
          if (!state.schedule_title || state.schedule_title.trim() === '') {
            errors.push('Schedule title is required');
          }
          if (!state.start_location_id) {
            errors.push('Start location is required');
          }
          if (!state.planning_window_start && !state.planned_date) {
            errors.push('Planning window is required');
          }
          if (state.working_set.length === 0) {
            if (state.source_method === 'upload') {
              errors.push('Please upload a file and add matched facilities to the schedule');
            } else {
              errors.push('Please add at least one facility to the schedule');
            }
          }
        }
        break;

      case 4: {
        const pending = state.working_set.filter(
          (ws) =>
            !state.facility_packaging[ws.facility_id] ||
            state.facility_packaging[ws.facility_id].packages.length === 0
        );
        if (pending.length > 0) {
          errors.push(`${pending.length} ${pending.length === 1 ? 'facility' : 'facilities'} still need packaging defined`);
        }
        break;
      }

      case 5:
        if (!state.batch_name || state.batch_name.trim() === '') {
          errors.push('Batch name is required');
        }
        if (state.vehicle_ids.length === 0 && !state.vehicle_id) {
          errors.push('At least one vehicle is required');
        }
        break;

      case 6:
        if (state.optimized_route.length === 0) {
          errors.push('Route optimization is required');
        }
        break;
    }

    return errors;
  });

/**
 * Get workflow actions - actions are stable and don't need reactive subscription.
 * Using getState() instead of a selector avoids infinite loop issues with useSyncExternalStore.
 */
export const useWorkflowActions = () => {
  // Actions are defined in the store and never change, so we can safely
  // memoize with empty deps. Using getState() avoids useSyncExternalStore issues.
  return useMemo(() => {
    const state = useUnifiedWorkflowStore.getState();
    return {
      // Navigation
      nextStep: state.nextStep,
      previousStep: state.previousStep,
      goToStep: state.goToStep,
      resetWorkflow: state.resetWorkflow,
      // Step 1
      setScheduleMode: state.setScheduleMode,
      // Step 2
      setSourceMethod: state.setSourceMethod,
      setSourceSubOption: state.setSourceSubOption,
      // Step 2
      setScheduleTitle: state.setScheduleTitle,
      setStartLocation: state.setStartLocation,
      setPlannedDate: state.setPlannedDate,
      setPlanningWindow: state.setPlanningWindow,
      setTimeWindow: state.setTimeWindow,
      setScheduleNotes: state.setScheduleNotes,
      addToWorkingSet: state.addToWorkingSet,
      removeFromWorkingSet: state.removeFromWorkingSet,
      reorderWorkingSet: state.reorderWorkingSet,
      clearWorkingSet: state.clearWorkingSet,
      setWorkingSet: state.setWorkingSet,
      setAiOptimizationOptions: state.setAiOptimizationOptions,
      toggleAiOption: state.toggleAiOption,
      setSuggestedVehicle: state.setSuggestedVehicle,
      setSuggestedVehicles: state.setSuggestedVehicles,
      setUploadedFile: state.setUploadedFile,
      setParsedFacilities: state.setParsedFacilities,
      updateParsedFacility: state.updateParsedFacility,
      setPolicyContext: state.setPolicyContext,
      setFacilityPackaging: state.setFacilityPackaging,
      savePreBatch: state.savePreBatch,
      loadPreBatch: state.loadPreBatch,
      // Copilot intent
      setPlanningIntent: state.setPlanningIntent,
      setPlanningCandidates: state.setPlanningCandidates,
      setCopilotPlan: state.setCopilotPlan,
      updateDispatchRunProposal: state.updateDispatchRunProposal,
      // Step 3
      setBatchName: state.setBatchName,
      setPriority: state.setPriority,
      commitVehicle: state.commitVehicle,
      commitVehicles: state.commitVehicles,
      assignDriver: state.assignDriver,
      assignFacilityToSlot: state.assignFacilityToSlot,
      unassignSlot: state.unassignSlot,
      autoAssignSlots: state.autoAssignSlots,
      clearSlotAssignments: state.clearSlotAssignments,
      // Step 4
      optimizeRoute: state.optimizeRoute,
      setOptimizedRoute: state.setOptimizedRoute,
      // Step 5
      confirmAndCreateBatch: state.confirmAndCreateBatch,
      // Utils
      setLoading: state.setLoading,
      setError: state.setError,
    };
  }, []);
};
