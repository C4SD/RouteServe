/**
 * =====================================================
 * RouteServe Scheduler Feature - TypeScript Type Definitions
 * =====================================================
 * Comprehensive type system for the Scheduler planning cockpit
 */

// =====================================================
// ENUMS
// =====================================================

export type SchedulerBatchStatus =
  | 'draft'        // Initial creation, not yet ready
  | 'ready'        // Ready for dispatch assignment
  | 'scheduled'    // Driver/vehicle assigned, awaiting dispatch
  | 'published'    // Pushed to FleetOps (delivery_batches)
  | 'cancelled';   // Cancelled before dispatch

export type SchedulingMode =
  | 'manual'       // Human-created grouping
  | 'ai_optimized' // AI optimization run
  | 'uploaded'     // From Excel/CSV file
  | 'template';    // From saved template

export type OptimizationStatus =
  | 'pending'      // Queued for processing
  | 'running'      // Currently optimizing
  | 'completed'    // Successfully completed
  | 'failed';      // Optimization failed

export type TimeWindow =
  | 'morning'      // 6am - 12pm
  | 'afternoon'    // 12pm - 6pm
  | 'evening'      // 6pm - 10pm
  | 'all_day';     // Flexible timing

export type Priority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

export type Zone =
  | 'North'
  | 'South'
  | 'East'
  | 'West'
  | 'Central';

export type SchedulerView =
  | 'map'
  | 'calendar'
  | 'list'
  | 'kanban';

export type RecurrenceType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom';

export type TimeWindowMode =
  | 'strict'    // Enforce delivery windows
  | 'flexible'; // Allow time window flexibility

export type PriorityWeight =
  | 'low'
  | 'medium'
  | 'high';

// =====================================================
// CORE MODELS
// =====================================================

export interface SchedulerBatch {
  id: string;

  // Identification
  name: string | null;
  batch_code: string;

  // Planning details
  warehouse_id: string;
  facility_ids: string[];
  planned_date: string; // ISO date string
  time_window: TimeWindow | null;

  // Assignment
  driver_id: string | null;
  vehicle_id: string | null; // first vehicle (backward compat)
  vehicle_ids?: string[]; // multi-vehicle

  // Route & Optimization
  optimized_route: RoutePoint[] | null;
  total_distance_km: number | null;
  estimated_duration_min: number | null;

  // Capacity tracking
  total_consignments: number;
  total_weight_kg: number | null;
  total_volume_m3: number | null;
  capacity_utilization_pct: number | null;

  // Status & Workflow
  status: SchedulerBatchStatus;
  scheduling_mode: SchedulingMode | null;
  priority: Priority;

  // Metadata
  created_by: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  scheduled_at: string | null;
  published_at: string | null;
  published_batch_id: string | null;

  // Additional data
  notes: string | null;
  tags: string[] | null;
  zone: Zone | null;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  facility_id: string;
  sequence: number;
  eta?: string; // ISO timestamp
  distance_from_previous?: number; // km
}

export interface ScheduleTemplate {
  id: string;

  // Template details
  name: string;
  description: string | null;

  // Pattern definition
  warehouse_id: string | null;
  facility_ids: string[];

  // Recurrence
  recurrence_type: RecurrenceType | null;
  recurrence_days: number[] | null; // [0,1,2,3,4] for Mon-Fri
  time_window: TimeWindow | null;

  // Default assignments
  default_driver_id: string | null;
  default_vehicle_id: string | null;

  // Settings
  auto_schedule: boolean;
  active: boolean;
  priority: Priority;

  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  usage_count: number;
}

export interface OptimizationRun {
  id: string;

  // Run details
  run_name: string | null;

  // Input parameters
  warehouse_id: string | null;
  facility_ids: string[];
  capacity_threshold: number;
  time_window_mode: TimeWindowMode;
  priority_weights: PriorityWeights | null;

  // Vehicle constraints
  vehicle_constraints: VehicleConstraints | null;

  // Results
  status: OptimizationStatus;
  result_batches: OptimizedBatch[] | null;
  total_batches_created: number | null;
  total_distance_km: number | null;
  total_duration_min: number | null;
  avg_capacity_utilization: number | null;

  // Performance metrics
  optimization_time_ms: number | null;
  algorithm_used: string | null;

  // Metadata
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;

  // Link to created batches
  scheduler_batch_ids: string[] | null;
}

export interface PriorityWeights {
  distance: PriorityWeight;
  duration: PriorityWeight;
  cost: PriorityWeight;
}

export interface VehicleConstraints {
  type?: string;
  capacity_min?: number;
  capacity_max?: number;
}

export interface OptimizedBatch {
  facilityIds: string[];
  route: RoutePoint[];
  totalDistance: number;
  estimatedDuration: number;
  capacityUsed: number;
  suggestedVehicle: string;
}

export interface SchedulerSettings {
  id: string;

  // User reference
  user_id: string;

  // Default settings
  default_warehouse_id: string | null;
  default_capacity_threshold: number;
  default_time_window: TimeWindow;

  // UI preferences
  default_view: SchedulerView;
  show_zones: boolean;
  auto_cluster_enabled: boolean;

  // Notification preferences
  notify_on_optimization_complete: boolean;
  notify_on_publish: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
}

// =====================================================
// UI STATE TYPES
// =====================================================

export interface SchedulerFilters {
  status?: SchedulerBatchStatus[];
  warehouse_id?: string;
  zone?: Zone[];
  date_range?: {
    from: string; // ISO date
    to: string;   // ISO date
  };
  driver_id?: string;
  vehicle_id?: string;
  search?: string; // Facility name, batch ID, etc.
  priority?: Priority[];
}

export interface SchedulerStats {
  total_batches: number;
  ready_count: number;
  scheduled_count: number;
  in_transit_count: number;
  issues_count: number;
  completed_count: number;
  total_consignments: number;
  total_distance_km: number;
  avg_capacity: number;
  active_warehouses: number;
  assigned_drivers: number;
  assigned_vehicles: number;
}

export interface SchedulerViewState {
  current_view: SchedulerView;
  selected_batch_id: string | null;
  drawer_open: boolean;
  filters: SchedulerFilters;
}

// =====================================================
// WIZARD STATE TYPES
// =====================================================

export type WizardStep = 1 | 2 | 3 | 4;

export interface WizardState {
  current_step: WizardStep;
  source_method: 'ready' | 'upload' | 'manual' | null;
  scheduling_mode: 'manual' | 'ai_optimized' | null;

  // Schedule metadata (new for comprehensive form)
  schedule_title: string | null;
  warehouse_id: string | null;
  planned_date: string | null; // ISO date string
  time_window: TimeWindow | null;
  vehicle_id: string | null;
  driver_id: string | null;
  notes: string | null;

  selected_facilities: string[];
  uploaded_file: File | null;
  file_data: UploadedDispatchData | null;
  created_batches: BatchAssignment[];
  optimization_params: OptimizationParams | null;
  optimization_results: OptimizedBatch[] | null;
}

export interface BatchAssignment {
  id: string; // Temporary ID for UI
  name: string;
  facility_ids: string[];
  driver_id: string | null;
  vehicle_id: string | null;
  route: RoutePoint[] | null;
  total_distance_km: number | null;
  estimated_duration_min: number | null;
  total_consignments: number;
  capacity_utilization_pct: number | null;
}

export interface OptimizationParams {
  warehouse_id: string;
  facility_ids: string[];
  capacity_threshold: number;
  time_window_mode: TimeWindowMode;
  priority_weights: PriorityWeights;
  vehicle_constraints?: VehicleConstraints;
}

// =====================================================
// FILE UPLOAD TYPES
// =====================================================

export interface UploadedDispatchData {
  file_name: string;
  rows: DispatchRow[];
  valid_count: number;
  error_count: number;
  warning_count: number;
}

export interface DispatchRow {
  facility_id: string;
  address: string;
  order_volume: number | null;
  time_window: string | null;
  priority: Priority | null;
  special_requirements: string | null;

  // Validation
  is_valid: boolean;
  errors: string[];
  warnings: string[];

  // Geocoding (if address provided)
  geocoded_lat: number | null;
  geocoded_lng: number | null;
  geocoding_confidence: number | null;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateSchedulerBatchRequest {
  name?: string;
  warehouse_id: string;
  facility_ids: string[];
  planned_date: string;
  time_window?: TimeWindow;
  driver_id?: string;
  vehicle_id?: string;
  scheduling_mode?: SchedulingMode;
  priority?: Priority;
  notes?: string;
  tags?: string[];
  zone?: Zone;
}

export interface UpdateSchedulerBatchRequest {
  name?: string;
  facility_ids?: string[];
  planned_date?: string;
  time_window?: TimeWindow;
  driver_id?: string;
  vehicle_id?: string;
  status?: SchedulerBatchStatus;
  priority?: Priority;
  notes?: string;
  tags?: string[];
}

export interface PublishToFleetOpsRequest {
  scheduler_batch_ids: string[];
}

export interface PublishToFleetOpsResponse {
  success: boolean;
  published_batches: Array<{
    scheduler_batch_id: string;
    delivery_batch_id: string;
  }>;
  errors: Array<{
    scheduler_batch_id: string;
    error_message: string;
  }>;
}

export interface OptimizeRouteRequest {
  warehouse_id: string;
  facility_ids: string[];
  capacity_threshold?: number;
  time_window_mode?: TimeWindowMode;
  priority_weights?: PriorityWeights;
  vehicle_constraints?: VehicleConstraints;
}

export interface OptimizeRouteResponse {
  success: boolean;
  optimization_run_id: string;
  result_batches: OptimizedBatch[];
  total_batches_created: number;
  total_distance_km: number;
  total_duration_min: number;
  avg_capacity_utilization: number;
  optimization_time_ms: number;
}

// =====================================================
// EXTENDED TYPES (with joined data)
// =====================================================

export interface SchedulerBatchWithDetails extends SchedulerBatch {
  warehouse?: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  driver?: {
    id: string;
    name: string;
    phone: string;
    status: string;
  };
  vehicle?: {
    id: string;
    type: string;
    plate_number: string;
    capacity: number;
  };
  facilities?: Array<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    type: string;
  }>;
}

// =====================================================
// CALENDAR EVENT TYPE
// =====================================================

export interface SchedulerCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: SchedulerBatch;
  backgroundColor: string;
  borderColor: string;
}

// =====================================================
// GANTT CHART TYPES
// =====================================================

export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number; // 0-100
  dependencies: string[];
  type: 'task' | 'milestone';
  styles?: {
    backgroundColor?: string;
    progressColor?: string;
  };
}

export interface GanttRow {
  facility_id: string;
  facility_name: string;
  planned_eta: Date;
  actual_arrival: Date | null;
  dwell_time_min: number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Make all fields optional except ID
export type SchedulerBatchUpdate = PartialBy<SchedulerBatch, 'id'>;

// =====================================================
// VALIDATION SCHEMAS (for use with Zod)
// =====================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}
