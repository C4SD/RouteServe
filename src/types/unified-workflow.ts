/**
 * =====================================================
 * Unified Scheduler-Batch Workflow Types
 * =====================================================
 * Types for the unified 5-step workflow combining
 * Storefront scheduler (Steps 1-2) and FleetOps batch (Steps 3-5)
 */

import type { TimeWindow, Priority, RoutePoint } from './scheduler';

// =====================================================
// WORKFLOW STEP TYPES
// =====================================================

export type UnifiedWorkflowStep = 1 | 2 | 3 | 4 | 5;

export type SourceMethod = 'ready' | 'upload' | 'manual' | 'service_policy';

export type SourceSubOption = 'manual_scheduling' | 'ai_optimization';

export type StartLocationType = 'warehouse' | 'facility';

export type PreBatchStatus = 'draft' | 'ready' | 'converted' | 'cancelled';

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
  planned_date: string;
  time_window?: TimeWindow | null;

  // Working Set
  facility_order: string[];
  facility_requisition_map: Record<string, string[]>;

  // AI Options
  ai_optimization_options: AiOptimizationOptions | null;

  // Vehicle Suggestion
  suggested_vehicle_id: string | null;

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
  time_window?: TimeWindow | null;
  facility_order: string[];
  facility_requisition_map: Record<string, string[]>;
  ai_optimization_options?: AiOptimizationOptions | null;
  suggested_vehicle_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface UpdatePreBatchPayload {
  schedule_title?: string;
  start_location_id?: string;
  start_location_type?: StartLocationType;
  planned_date?: string;
  time_window?: TimeWindow | null;
  facility_order?: string[];
  facility_requisition_map?: Record<string, string[]>;
  ai_optimization_options?: AiOptimizationOptions | null;
  suggested_vehicle_id?: string | null;
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

  // Step 1: Source Selection
  source_method: SourceMethod | null;
  source_sub_option: SourceSubOption | null;

  // Step 2: Schedule (Header)
  schedule_title: string | null;
  start_location_id: string | null;
  start_location_type: StartLocationType;
  planned_date: string | null;
  time_window: TimeWindow | null;

  // Step 2: Working Set (Middle Column)
  working_set: WorkingSetItem[];

  // Step 2: Decision Support (Right Column)
  ai_optimization_options: AiOptimizationOptions;
  suggested_vehicle_id: string | null;

  // Step 2: Notes
  schedule_notes: string | null;

  // Step 3: Batch Details
  batch_name: string | null;
  priority: Priority;
  vehicle_id: string | null; // COMMITTED vehicle (not suggestion)
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
}

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

  // Step 1: Source
  setSourceMethod: (method: SourceMethod) => void;
  setSourceSubOption: (option: SourceSubOption | null) => void;

  // Step 2: Schedule Header
  setScheduleTitle: (title: string) => void;
  setStartLocation: (id: string, type: StartLocationType) => void;
  setPlannedDate: (date: string) => void;
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

  // Step 2: File Upload
  setUploadedFile: (file: File | null) => void;
  setParsedFacilities: (facilities: ParsedFacility[] | null) => void;
  updateParsedFacility: (rowIndex: number, updates: Partial<ParsedFacility>) => void;

  // Step 2: Policy Context (service_policy source method)
  setPolicyContext: (context: PolicyContext | null) => void;

  // Step 2 -> Pre-batch
  savePreBatch: () => Promise<string>;
  loadPreBatch: (id: string) => Promise<void>;

  // Step 3: Batch Details
  setBatchName: (name: string) => void;
  setPriority: (priority: Priority) => void;
  commitVehicle: (vehicleId: string) => void;
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
}

export type UnifiedWorkflowStore = UnifiedWorkflowState & UnifiedWorkflowActions;
