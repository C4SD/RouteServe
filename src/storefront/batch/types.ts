/**
 * =====================================================
 * STOREFRONT BATCH TYPES
 * =====================================================
 *
 * These types define the Batch domain as owned by Storefront.
 * Batch is the output of facility grouping and capacity planning.
 *
 * IMPORTANT: Batch is immutable after creation.
 * FleetOps reads batch data but cannot mutate it.
 */

/**
 * Slot demand for a single facility.
 * Computed once from requisition packaging, then frozen.
 */
export interface FacilitySlotDemand {
  facility_id: string;
  slot_demand: number;
  weight_kg?: number;
  volume_m3?: number;
  packaging_id?: string;
}

/**
 * Frozen snapshot of slot allocation for a batch.
 * Computed once at batch creation, never mutated.
 */
export interface BatchSlotSnapshot {
  total_slot_demand: number;
  facility_demands: FacilitySlotDemand[];
  computed_at: string;
  version: number;
}

/**
 * Storefront Batch - the unit of facility grouping.
 * Contains ONLY what Storefront owns.
 */
export interface StorefrontBatch {
  batch_id: string;
  route_id?: string;

  // Facility list (owned by Storefront)
  facilities: string[];

  // Capacity data (READ-ONLY, from requisition packaging)
  slot_demand_per_facility: Record<string, number>;

  // Frozen capacity snapshot
  slot_snapshot: BatchSlotSnapshot;

  // Metadata
  warehouse_id: string;
  planned_date: string;
  status: StorefrontBatchStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Timestamps
  created_at: string;
  updated_at: string;
  finalized_at?: string;
}

export type StorefrontBatchStatus =
  | 'draft'         // Being assembled
  | 'ready'         // Ready for capacity validation
  | 'validated'     // Passed capacity check
  | 'finalized'     // Frozen, ready for FleetOps
  | 'published'     // Sent to FleetOps
  | 'cancelled';    // Cancelled before publish

/**
 * Request to create a new batch.
 * Must include requisition references for slot demand derivation.
 */
export interface CreateBatchRequest {
  warehouse_id: string;
  facility_ids: string[];
  requisition_ids: string[];
  planned_date: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * Result of batch capacity validation.
 */
export interface BatchCapacityValidation {
  valid: boolean;
  total_slot_demand: number;
  total_weight_kg?: number;
  total_volume_m3?: number;
  errors: string[];
  warnings: string[];
}

/**
 * Contract for FleetOps handoff.
 * This is what FleetOps receives when a batch is published.
 */
export interface BatchHandoffContract {
  batch_id: string;
  warehouse_id: string;
  facilities: string[];
  slot_snapshot: BatchSlotSnapshot;
  planned_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// =====================================================
// BATCH INTEGRITY CHECK
// =====================================================

/**
 * Result of a batch integrity check.
 * Used by analytics and PoD linkage per RFC-012 spec.
 */
export interface BatchIntegrityCheck {
  hasIntegrity: boolean;
  checks: {
    hasVehicle: boolean;
    hasFacilities: boolean;
    hasWarehouse: boolean;
    hasSlotSnapshot: boolean;
    noSlotOverflow: boolean;
    hasValidStatus: boolean;
  };
  errors: string[];
}

/**
 * Check batch integrity against RFC-012 requirements.
 *
 * A batch has integrity if:
 * - Has a vehicle assigned
 * - Has at least one facility
 * - Has a warehouse
 * - Has a valid slot snapshot
 * - No slot overflow (facilities <= available slots)
 * - Has a valid status
 */
export function checkBatchIntegrity(
  batch: Partial<StorefrontBatch> & {
    vehicle_id?: string;
    vehicleSlots?: number;
  }
): BatchIntegrityCheck {
  const errors: string[] = [];

  const hasVehicle = Boolean(batch.vehicle_id);
  if (!hasVehicle) errors.push('No vehicle assigned');

  const hasFacilities = (batch.facilities?.length || 0) > 0;
  if (!hasFacilities) errors.push('No facilities in batch');

  const hasWarehouse = Boolean(batch.warehouse_id);
  if (!hasWarehouse) errors.push('No warehouse specified');

  const hasSlotSnapshot = Boolean(batch.slot_snapshot?.computed_at);
  if (!hasSlotSnapshot && batch.status !== 'draft') {
    errors.push('Missing slot snapshot');
  }

  // Check slot overflow
  const totalSlotDemand = batch.slot_snapshot?.total_slot_demand || batch.facilities?.length || 0;
  const availableSlots = batch.vehicleSlots || Infinity;
  const noSlotOverflow = totalSlotDemand <= availableSlots;
  if (!noSlotOverflow) {
    errors.push(`Slot overflow: ${totalSlotDemand} required, ${availableSlots} available`);
  }

  const validStatuses: StorefrontBatchStatus[] = [
    'draft', 'ready', 'validated', 'finalized', 'published', 'cancelled'
  ];
  const hasValidStatus = Boolean(batch.status && validStatuses.includes(batch.status));
  if (!hasValidStatus) errors.push(`Invalid status: ${batch.status}`);

  const hasIntegrity =
    hasVehicle &&
    hasFacilities &&
    hasWarehouse &&
    (hasSlotSnapshot || batch.status === 'draft') &&
    noSlotOverflow &&
    hasValidStatus;

  return {
    hasIntegrity,
    checks: {
      hasVehicle,
      hasFacilities,
      hasWarehouse,
      hasSlotSnapshot,
      noSlotOverflow,
      hasValidStatus,
    },
    errors,
  };
}

// =====================================================
// BATCH GROUPING (route-aware order assembly)
// =====================================================

/**
 * A single delivery order to be grouped into a batch.
 */
export interface OrderItem {
  id: string;
  facility_id: string;
  slot_demand?: number;
  weight_kg?: number;
  volume_m3?: number;
  program?: string;
}

/**
 * A pre-defined route with an ordered stop sequence.
 */
export interface RouteDefinition {
  route_id: string;
  facility_ids: string[]; // ordered stop sequence
}

/**
 * Output of groupOrdersIntoBatches: orders co-located on the same route.
 */
export interface BatchGrouping {
  route_id: string;
  facility_ids: string[];   // sorted by route stop sequence
  order_ids: string[];
  total_slot_demand: number;
  total_weight_kg: number;
  total_volume_m3: number;
}

/**
 * Slot utilization metrics for a batch.
 */
export interface BatchSlotMetrics {
  requiredSlots: number;
  availableSlots: number;
  utilizationPercent: number;
  efficiencyRating: 'optimal' | 'underutilized' | 'overutilized' | 'overflow';
}

/**
 * Calculate slot utilization metrics for a batch.
 * Per RFC-012: optimal utilization is 70-90%.
 */
export function calculateSlotMetrics(
  requiredSlots: number,
  availableSlots: number
): BatchSlotMetrics {
  if (availableSlots === 0) {
    return {
      requiredSlots,
      availableSlots,
      utilizationPercent: 0,
      efficiencyRating: 'overflow',
    };
  }

  const utilizationPercent = (requiredSlots / availableSlots) * 100;

  let efficiencyRating: BatchSlotMetrics['efficiencyRating'];
  if (requiredSlots > availableSlots) {
    efficiencyRating = 'overflow';
  } else if (utilizationPercent >= 70 && utilizationPercent <= 90) {
    efficiencyRating = 'optimal';
  } else if (utilizationPercent < 70) {
    efficiencyRating = 'underutilized';
  } else {
    efficiencyRating = 'overutilized';
  }

  return {
    requiredSlots,
    availableSlots,
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    efficiencyRating,
  };
}
