/**
 * =====================================================
 * FLEETOPS PAYLOAD TYPES
 * =====================================================
 *
 * Single source of truth for slot and capacity types.
 * All slot-related types must be defined here.
 */

/**
 * Vehicle slot definition.
 * Slots come from vehicle onboarding configuration.
 */
export interface VehicleSlot {
  slot_key: string; // Format: "VEH123-Lower-1"
  vehicle_id: string;
  tier_name: string;
  tier_order: number;
  slot_number: number;
  slot_index: number; // Global index across all tiers
  capacity_kg: number;
  capacity_m3: number;
  occupied: boolean;
  assigned_facility_id: string | null;
  assigned_batch_id: string | null;
}

/**
 * Slot assignment record.
 * program and storage_type are propagated from the facility's requisition items
 * and preserved here for load composition reporting and audit.
 */
export interface SlotAssignment {
  slot_key: string;
  vehicle_id: string;
  tier_name: string;
  slot_number: number;
  facility_id: string;
  load_kg?: number;
  load_volume_m3?: number;
  sequence_order?: number;
  program?: string;
  storage_type?: 'ambient' | 'cold' | 'frozen';
}

/**
 * Vehicle capacity info.
 */
export interface VehicleCapacity {
  vehicle_id: string;
  license_plate?: string;
  capacity_kg: number;
  capacity_m3: number;
  total_slots: number;
  is_cold_chain?: boolean;
  tiered_config?: TieredConfig;
}

/**
 * Vehicle tier configuration (from onboarding).
 */
export interface TieredConfig {
  tiers: TierConfig[];
}

/**
 * Single tier configuration.
 */
export interface TierConfig {
  tier_name: string;
  tier_order: number;
  slot_count: number;
  capacity_kg?: number;
  capacity_m3?: number;
}

/**
 * Facility for slot assignment.
 * program and storage_type are derived from the facility's dominant requisition items
 * and propagated into SlotAssignment for traceability.
 */
export interface AssignableFacility {
  id: string;
  name?: string;
  estimated_weight?: number;
  estimated_volume?: number;
  priority?: 'high' | 'medium' | 'low';
  fragile?: boolean;
  program?: string;
  storage_type?: 'ambient' | 'cold' | 'frozen';
}

/**
 * Assignment rule for ordering.
 */
export interface AssignmentRule {
  priority: 'weight' | 'volume' | 'fragile' | 'sequence';
  order: 'ascending' | 'descending';
}

/**
 * Options for slot assignment.
 */
export interface AssignmentOptions {
  rules?: AssignmentRule[];
  fillStrategy?: 'lower-first' | 'upper-first' | 'balanced';
  allowOverflow?: false; // NEVER allow overflow
}

/**
 * Result of slot assignment operation.
 */
export interface AssignmentResult {
  success: boolean;
  assignments: SlotAssignment[];
  unassigned: AssignableFacility[];
  errors: string[];
  warnings: string[];
}

/**
 * Slot utilization statistics.
 */
export interface SlotUtilization {
  totalSlots: number;
  occupiedSlots: number;
  availableSlots: number;
  utilizationPct: number;
  tierUtilization: Record<string, TierUtilization>;
}

/**
 * Per-tier utilization.
 */
export interface TierUtilization {
  total: number;
  occupied: number;
  pct: number;
}

/**
 * Validation result for slot operations.
 */
export interface SlotValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Payload validation result.
 */
export interface PayloadValidationResult {
  isValid: boolean;
  totalWeight: number;
  totalVolume: number;
  weightUtilization: number;
  volumeUtilization: number;
  slotUtilization: number;
  overloadErrors: string[];
  warnings: string[];
}

/**
 * Parsed slot key components.
 */
export interface SlotKeyComponents {
  vehicleId: string;
  tierName: string;
  slotNumber: number;
}
