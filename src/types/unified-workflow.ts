/**
 * =====================================================
 * Unified Scheduler-Batch Workflow Types
 * =====================================================
 * Types for the unified 5-step workflow combining
 * Storefront scheduler (Steps 1-2) and FleetOps batch (Steps 3-5)
 */

import type { TimeWindow, Priority, RoutePoint } from './scheduler';
import type { PlanningCandidate, PlanningIntent, CopilotPlan } from './scheduling-copilot';

// =====================================================
// WORKFLOW STEP TYPES
// =====================================================

export type UnifiedWorkflowStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ScheduleMode = 'manual' | 'copilot';

export type SourceMethod = 'ready' | 'upload' | 'manual' | 'service_policy';

export type SourceSubOption = 'manual_scheduling' | 'ai_optimization';

export type StartLocationType = 'warehouse' | 'facility';

export type PreBatchStatus = 'draft' | 'ready' | 'converted' | 'cancelled';

// =====================================================
// PLANNING WINDOW TYPE
// =====================================================

export interface PlanningWindow {
  start: string; // ISO date YYYY-MM-DD
  end: string | null; // ISO date, null = open-ended from start
}

// =====================================================
// POLICY CONTEXT (service_policy source method)
// =====================================================

export interface PolicyContext {
  service_area_id: string;
  service_area_name: string;
  policy_id: string;
  policy_name: string;
  cluster_id: string;
  cluster_code: string; // Z1, Z2, …
  cluster_name: string | null;
}

// =====================================================
// PACKAGING TYPES (Step 3)
// =====================================================

export type FacilityPackageTypeName = 'Carton' | 'Kit / Bag' | 'Box';
export type FacilityPackageSizeName = 'S' | 'M' | 'L' | 'XL';

export interface FacilityPackagingRow {
  id: string;
  type: FacilityPackageTypeName;
  size: FacilityPackageSizeName;
  unit_weight: number;
  quantity: number;
}

export interface FacilityPackagingData {
  facility_id: string;
  packages: FacilityPackagingRow[];
  computed: {
    total_weight: number;
    total_volume: number;
    total_packages: number;
    total_slots: number;
  };
}

// =====================================================
// WORKING SET TYPES (Step 2)
// =====================================================

export interface WorkingSetItem {
  facility_id: string;
  facility_name: string;
  facility_code?: string;
  lga?: string;
  zone?: string;
  requisition_ids: string[];
  slot_demand: number;
  weight_kg?: number;
  volume_m3?: number;
  eta?: string;
  sequence: number;
}

export interface AiOptimizationOptions {
  shortest_distance: boolean;
  fastest_route: boolean;
  efficiency: boolean;
  priority_complex: boolean;
}

// =====================================================
// SLOT ASSIGNMENT TYPES (Step 3)
// =====================================================

export interface SlotAssignment {
  slot_key: string;
  facility_id: string;
  facility_name?: string;
  requisition_ids: string[];
  slot_demand: number;
  weight_kg?: number;
  volume_m3?: number;
  tier_name?: string;
  tier_order?: number;
  slot_number?: number;
}

export type SlotAssignmentMap = Record<string, SlotAssignment>;

export interface SlotInfo {
  slot_key: string;
  tier_name: string;
  tier_order: number;
  slot_number: number;
  capacity_kg?: number;
  capacity_m3?: number;
  is_assigned: boolean;
  assignment?: SlotAssignment;
}

// =====================================================
// PRE-BATCH TYPES (Database Model)
// =====================================================

export interface PreBatch {
  id: string;
  workspace_id: string;

  // Step 1: Source
  source_method: SourceMethod;
  source_sub_option: SourceSubOption | null;

  // Step 2: Schedule
  schedule_title: string;
  start_location_id: string;
  start_location_type: StartLocationType;
  planned_date: string; // kept for backward compat — equals planning_window_start
  planning_window_start: string;
  planning_window_end: string | null;
  time_window?: TimeWindow | null;

  // Working Set
  facility_order: string[];
  facility_requisition_map: Record<string, string[]>;

  // AI Options
  ai_optimization_options: AiOptimizationOptions | null;

  // Vehicle Suggestion
  suggested_vehicle_id: string | null; // kept for compat (first of suggested_vehicle_ids)
  suggested_vehicle_ids: string[] | null;

  // Policy context (populated when source_method = 'service_policy')
  policy_context: PolicyContext | null;

  // Packaging snapshot (persisted at draft-save / confirm time)
  facility_packaging: Record<string, FacilityPackagingData> | null;

  // Status
  status: PreBatchStatus;

  // References
  converted_batch_id: string | null;

  // Notes
  notes?: string | null;

  // Audit
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreBatchWithRelations extends PreBatch {
  // Joined relations (when fetched with expand)
  start_location?: {
    id: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  suggested_vehicle?: {
    id: string;
    model: string;
    plate_number: string;
    capacity: number;
    max_weight: number;
  };
  converted_batch?: {
    id: string;
    name: string;
    status: string;
  };
  created_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

// =====================================================
// CREATE/UPDATE PAYLOADS
// =====================================================

export interface CreatePreBatchPayload {
  workspace_id: string;
  source_method: SourceMethod;
  source_sub_option?: SourceSubOption | null;
  schedule_title: string;
  start_location_id: string;
  start_location_type: StartLocationType;
  planned_date: string;
  planning_window_start?: string;
  planning_window_end?: string | null;
  time_window?: TimeWindow | null;
  facility_order: string[];
  facility_requisition_map: Record<string, string[]>;
  ai_optimization_options?: AiOptimizationOptions | null;
  suggested_vehicle_id?: string | null;
  suggested_vehicle_ids?: string[] | null;
  policy_context?: PolicyContext | null;
  facility_packaging?: Record<string, FacilityPackagingData> | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface UpdatePreBatchPayload {
  schedule_title?: string;
  start_location_id?: string;
  start_location_type?: StartLocationType;
  planned_date?: string;
  planning_window_start?: string;
  planning_window_end?: string | null;
  time_window?: TimeWindow | null;
  facility_order?: string[];
  facility_requisition_map?: Record<string, string[]>;
  ai_optimization_options?: AiOptimizationOptions | null;
  suggested_vehicle_id?: string | null;
  suggested_vehicle_ids?: string[] | null;
  status?: PreBatchStatus;
  converted_batch_id?: string | null;
  notes?: string | null;
}

// =====================================================
// QUERY FILTERS
// =====================================================

export interface PreBatchFilters {
  status?: PreBatchStatus[];
  start_location_id?: string;
  planned_date_from?: string;
  planned_date_to?: string;
  created_by?: string;
  search?: string;
}

// =====================================================
// UNIFIED WORKFLOW STATE
// =====================================================

export interface UnifiedWorkflowState {
  // Navigation
  current_step: UnifiedWorkflowStep;
  is_loading: boolean;
  error: string | null;

  // Step 1: Schedule Mode Selection
  schedule_mode: ScheduleMode | null;

  // Step 2: Source Selection
  source_method: SourceMethod | null;
  source_sub_option: SourceSubOption | null;

  // Step 2: Schedule (Header)
  schedule_title: string | null;
  start_location_id: string | null;
  start_location_type: StartLocationType;
  planned_date: string | null; // backward compat — equals planning_window_start
  planning_window_start: string | null;
  planning_window_end: string | null;
  time_window: TimeWindow | null;

  // Step 2: Working Set (Middle Column)
  working_set: WorkingSetItem[];

  // Step 2: Decision Support (Right Column)
  ai_optimization_options: AiOptimizationOptions;
  suggested_vehicle_id: string | null; // first of suggested_vehicle_ids (backward compat)
  suggested_vehicle_ids: string[];

  // Step 2: Notes
  schedule_notes: string | null;

  // Step 3: Batch Details
  batch_name: string | null;
  priority: Priority;
  vehicle_id: string | null; // first of vehicle_ids (backward compat)
  vehicle_ids: string[]; // COMMITTED vehicles (multi-vehicle)
  driver_id: string | null;

  // Step 3: Slot Assignments
  slot_assignments: SlotAssignmentMap;

  // Step 4: Route
  optimized_route: RoutePoint[];
  route_geometry: Array<[number, number]> | null; // [lng, lat] road path from routing API
  total_distance_km: number | null;
  estimated_duration_min: number | null;

  // Cross-domain References
  pre_batch_id: string | null;
  final_batch_id: string | null;

  // File Upload (for 'upload' source method)
  uploaded_file: File | null;
  parsed_facilities: ParsedFacility[] | null;

  // Policy Context (for 'service_policy' source method)
  policy_context: PolicyContext | null;

  // Step 3: Packaging (per-facility packaging declarations)
  facility_packaging: Record<string, FacilityPackagingData>;

  // Routing diagnostics
  routing_fallback_used: boolean;

  // =====================================================
  // COPILOT MODE STATE
  // =====================================================
  // Only active when schedule_mode === 'copilot'

  // Copilot Step 3: Planning intent (user-defined preferences)
  planning_intent: PlanningIntent | null;

  // Copilot Step 4: Resolved planning candidates (enriched from source)
  planning_candidates: PlanningCandidate[] | null;

  // Copilot Step 4→5: Generated execution plan
  copilot_plan: CopilotPlan | null;
}

// Re-export copilot types so consumers can import from this module
export type { PlanningCandidate, PlanningIntent, CopilotPlan };

// =====================================================
// FILE UPLOAD TYPES
// =====================================================

export interface ParsedFacility {
  row_index: number;
  raw_name: string;
  matched_facility_id: string | null;
  matched_facility_name: string | null;
  confidence_score: number;
  is_valid: boolean;
  error_message?: string;
  user_corrected?: boolean;
  // Coordinates carried from the matched DB facility — required for road routing
  lat?: number;
  lng?: number;
}

export interface FileUploadResult {
  file_name: string;
  file_type: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  facilities: ParsedFacility[];
}

// =====================================================
// ROUTE PREVIEW TYPES
// =====================================================

export interface RoutePreview {
  points: RoutePreviewPoint[];
  total_distance_km: number;
  estimated_duration_min: number;
  longest_segment_km: number;
  avg_segment_km: number;
}

export interface RoutePreviewPoint {
  facility_id: string;
  facility_name: string;
  lat: number;
  lng: number;
  sequence: number;
  distance_from_previous_km?: number;
  eta?: string;
}

// =====================================================
// INSIGHTS TYPES
// =====================================================

export interface WorkflowInsights {
  total_facilities: number;
  total_requisitions: number;
  total_payload_kg: number;
  total_volume_m3: number;
  total_slot_demand: number;
  estimated_turnaround_hours: number;
  route_distance_km: number;
  suggested_vehicle_count: number;
  capacity_utilization_pct?: number;
}

// =====================================================
// VEHICLE SUGGESTION TYPES
// =====================================================

export interface VehicleSuggestion {
  vehicle_id: string;
  vehicle_model: string;
  vehicle_plate: string;
  total_slots: number;
  available_slots: number;
  capacity_kg: number;
  capacity_m3: number;
  utilization_pct: number;
  fit_score: number; // 0-100, higher is better fit
  reason: string;
}

// =====================================================
// WIZARD ACTION TYPES
// =====================================================

export interface UnifiedWorkflowActions {
  // Navigation
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: UnifiedWorkflowStep) => void;
  resetWorkflow: () => void;

  // Step 1: Schedule Mode
  setScheduleMode: (mode: ScheduleMode) => void;

  // Step 2: Source
  setSourceMethod: (method: SourceMethod) => void;
  setSourceSubOption: (option: SourceSubOption | null) => void;

  // Step 2: Schedule Header
  setScheduleTitle: (title: string) => void;
  setStartLocation: (id: string, type: StartLocationType) => void;
  setPlannedDate: (date: string) => void;
  setPlanningWindow: (start: string, end: string | null) => void;
  setTimeWindow: (window: TimeWindow | null) => void;
  setScheduleNotes: (notes: string | null) => void;

  // Step 2: Working Set
  addToWorkingSet: (item: WorkingSetItem) => void;
  removeFromWorkingSet: (facilityId: string) => void;
  reorderWorkingSet: (fromIndex: number, toIndex: number) => void;
  clearWorkingSet: () => void;
  setWorkingSet: (items: WorkingSetItem[]) => void;

  // Step 2: AI Options
  setAiOptimizationOptions: (options: Partial<AiOptimizationOptions>) => void;
  toggleAiOption: (option: keyof AiOptimizationOptions) => void;

  // Step 2: Vehicle Suggestion
  setSuggestedVehicle: (vehicleId: string | null) => void;
  setSuggestedVehicles: (vehicleIds: string[]) => void;

  // Step 2: File Upload
  setUploadedFile: (file: File | null) => void;
  setParsedFacilities: (facilities: ParsedFacility[] | null) => void;
  updateParsedFacility: (rowIndex: number, updates: Partial<ParsedFacility>) => void;

  // Step 2: Policy Context (service_policy source method)
  setPolicyContext: (context: PolicyContext | null) => void;

  // Step 3: Packaging
  setFacilityPackaging: (facilityId: string, data: FacilityPackagingData | null) => void;

  // Step 2 -> Pre-batch
  savePreBatch: () => Promise<string>;
  loadPreBatch: (id: string) => Promise<void>;

  // Step 3: Batch Details
  setBatchName: (name: string) => void;
  setPriority: (priority: Priority) => void;
  commitVehicle: (vehicleId: string) => void;
  commitVehicles: (vehicleIds: string[]) => void;
  assignDriver: (driverId: string | null) => void;

  // Step 3: Slot Assignments
  assignFacilityToSlot: (slotKey: string, facilityId: string, requisitionIds: string[]) => void;
  unassignSlot: (slotKey: string) => void;
  autoAssignSlots: () => void;
  clearSlotAssignments: () => void;

  // Step 4: Route
  optimizeRoute: (
    facilitiesWithCoords: Array<{ id: string; lat?: number; lng?: number }>,
    startLocation?: { lat?: number; lng?: number } | null
  ) => Promise<void>;
  setOptimizedRoute: (route: RoutePoint[], distance: number, duration: number) => void;

  // Step 5: Finalize
  confirmAndCreateBatch: () => Promise<string>;

  // Validation
  canProceedToNextStep: () => boolean;
  getValidationErrors: () => string[];

  // Loading/Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // =====================================================
  // COPILOT ACTIONS
  // =====================================================
  setPlanningIntent: (intent: PlanningIntent) => void;
  setPlanningCandidates: (candidates: PlanningCandidate[]) => void;
  setCopilotPlan: (plan: CopilotPlan | null) => void;
  updateDispatchRunProposal: (runId: string, updates: Partial<import('./scheduling-copilot').DispatchRunProposal>) => void;
}

export type UnifiedWorkflowStore = UnifiedWorkflowState & UnifiedWorkflowActions;

// =====================================================
// EXECUTION ENGINE TYPES (Manual Scheduling — Step 5)
// =====================================================

export type ClusteringStrategy =
  | 'geographic_proximity'
  | 'balanced_workload'
  | 'sla_priority';

export type ExecutionStrategy =
  | 'maximize_vehicle_reuse'
  | 'fastest_completion'
  | 'minimize_operational_days'
  | 'balance_fleet_utilization';

export type ReturnToBaseBuffer = 'immediate' | 'half_day' | 'next_day';

export interface ExecutionEngineConfig {
  clustering_strategy: ClusteringStrategy;
  execution_strategy: ExecutionStrategy;
  working_hours_start: string; // "09:00"
  working_hours_end: string;   // "16:00"
  service_buffer_min: number;  // e.g. 45
  return_buffer: ReturnToBaseBuffer;
  allow_multi_day: boolean;
  allow_same_day_reuse: boolean;
  respect_facility_hours: boolean;
  respect_driver_shift: boolean;
}

export const DEFAULT_EXECUTION_CONFIG: ExecutionEngineConfig = {
  clustering_strategy: 'geographic_proximity',
  execution_strategy: 'maximize_vehicle_reuse',
  working_hours_start: '09:00',
  working_hours_end: '16:00',
  service_buffer_min: 45,
  return_buffer: 'immediate',
  allow_multi_day: true,
  allow_same_day_reuse: true,
  respect_facility_hours: true,
  respect_driver_shift: true,
};

export interface DispatchRunProjection {
  id: string;
  run_index: number;
  wave_id: string;
  vehicle_id: string | null;
  vehicle_label: string | null;
  facility_ids: string[];
  facility_names: string[];
  total_slots: number;
  departure_time: string; // "09:00"
  return_time: string;    // "13:00"
  duration_min: number;
}

export interface ExecutionWaveProjection {
  id: string;
  wave_index: number;
  date: string;  // ISO date YYYY-MM-DD
  label: string; // "Wave 1 · Mon, May 15"
  vehicle_ids: string[];
  vehicle_labels: string[];
  runs: DispatchRunProjection[];
  facility_ids: string[];
  total_slots: number;
  total_facilities: number;
}

export interface ExecutionEngineWarning {
  id: string;
  message: string;
}

export interface ExecutionProjection {
  operational_days: number;
  total_waves: number;
  total_runs: number;
  total_facilities: number;
  total_slots: number;
  vehicle_utilization_avg: number; // 0–100
  vehicle_reuse_enabled: boolean;
  projected_completion: string | null; // ISO date
  waves: ExecutionWaveProjection[];
  warnings: ExecutionEngineWarning[];
}

// Manual override: user can re-assign vehicles to a wave
export interface WaveVehicleOverride {
  wave_id: string;
  vehicle_ids: string[];
}

// =====================================================
// DISPATCH RUN TYPES
// =====================================================

export type DispatchRunStatus =
  | 'planned'
  | 'loading'
  | 'pending'
  | 'departed'
  | 'dispatched'
  | 'in_transit'
  | 'delayed'
  | 'partial_delivery'
  | 'returned'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Legal state-machine transitions
export const DISPATCH_RUN_TRANSITIONS: Record<DispatchRunStatus, DispatchRunStatus[]> = {
  planned:          ['loading', 'pending', 'cancelled'],
  loading:          ['departed', 'pending', 'cancelled'],
  pending:          ['dispatched', 'loading', 'cancelled'],
  departed:         ['in_transit', 'delayed', 'cancelled'],
  dispatched:       ['in_transit', 'departed', 'delayed', 'cancelled'],
  in_transit:       ['completed', 'partial_delivery', 'delayed', 'cancelled'],
  delayed:          ['in_transit', 'partial_delivery', 'cancelled'],
  partial_delivery: ['returned', 'completed', 'cancelled'],
  returned:         ['completed', 'cancelled'],
  completed:        [],
  failed:           [],
  cancelled:        [],
};

export const DISPATCH_RUN_STATUS_LABELS: Record<DispatchRunStatus, string> = {
  planned:          'Planned',
  loading:          'Loading',
  pending:          'Pending Dispatch',
  departed:         'Departed',
  dispatched:       'Dispatched',
  in_transit:       'In Transit',
  delayed:          'Delayed',
  partial_delivery: 'Partial Delivery',
  returned:         'Returned',
  completed:        'Completed',
  failed:           'Failed',
  cancelled:        'Cancelled',
};

export interface ReturnedDelivery {
  facility_id: string;
  facility_name: string;
  reason: string;
  action: 'reschedule' | 'merge_future' | 'manual' | 'warehouse_return';
}

export interface VehicleAllocation {
  vehicle_id: string;
  vehicle_label?: string;
  facilities: string[]; // facility_ids
  slots_used: number;
  capacity: number;
}

export interface DispatchRun {
  id: string;
  workspace_id: string;
  batch_id: string;
  status: DispatchRunStatus;

  vehicle_id: string | null;
  vehicle_ids: string[];
  driver_id: string | null;

  planned_departure: string | null;
  planned_return: string | null;
  dispatched_at: string | null;
  departed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  estimated_arrival: string | null;

  stops_total: number;
  stops_completed: number;
  distance_km: number | null;
  duration_min: number | null;

  returned_deliveries: ReturnedDelivery[] | null;
  vehicle_allocations: VehicleAllocation[] | null;

  notes: string | null;
  cancel_reason: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDispatchRunPayload {
  batch_id: string;
  vehicle_id?: string | null;
  vehicle_ids?: string[];
  driver_id?: string | null;
  stops_total?: number;
  distance_km?: number | null;
  duration_min?: number | null;
  planned_departure?: string | null;
  planned_return?: string | null;
  vehicle_allocations?: VehicleAllocation[] | null;
  notes?: string | null;
}

export interface UpdateDispatchRunPayload {
  status?: DispatchRunStatus;
  stops_completed?: number;
  estimated_arrival?: string | null;
  notes?: string | null;
  cancel_reason?: string | null;
}

// =====================================================
// CONVERT PRE-BATCH PAYLOAD
// =====================================================

export interface ConvertPreBatchPayload {
  preBatchId: string;
  batchName: string;
  /** Primary vehicle (required). */
  vehicleId: string;
  /** All committed vehicles — kept in sync with vehicle_ids[]. */
  vehicleIds: string[];
  driverId?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  slotAssignments: Record<string, SlotAssignment>;
  facilityPackaging: Record<string, FacilityPackagingData>;
  optimizedRoute?: RoutePoint[];
  totalDistanceKm?: number;
  estimatedDurationMin?: number;
  routeFallbackUsed?: boolean;
  planningWindowStart?: string | null;
  planningWindowEnd?: string | null;
  plannedReturn?: string | null;
  vehicleAllocations?: VehicleAllocation[] | null;
  notes?: string | null;
}
