/**
 * =====================================================
 * BATCH BUILDER
 * =====================================================
 *
 * Handles facility grouping into batches.
 * Derives slot demand from requisition packaging (READ-ONLY).
 *
 * MUST NOT:
 *   - Access vehicle data
 *   - Modify slot assignments
 *   - Recalculate packaging
 */

import type {
  StorefrontBatch,
  StorefrontBatchStatus,
  CreateBatchRequest,
  BatchSlotSnapshot,
  FacilitySlotDemand,
  OrderItem,
  RouteDefinition,
  BatchGrouping,
} from './types';
import type { RequisitionPackaging } from '@/types/requisitions';
import type { VehicleCapacity } from '@/fleetops/payload';

/**
 * Build a batch from requisitions.
 * Slot demand is derived from requisition packaging, not calculated here.
 */
export function buildBatchFromRequisitions(
  request: CreateBatchRequest,
  packagingData: Map<string, RequisitionPackaging>
): StorefrontBatch {
  const now = new Date().toISOString();

  // Derive slot demand from packaging (READ-ONLY)
  const facilityDemands: FacilitySlotDemand[] = [];
  const slotDemandPerFacility: Record<string, number> = {};

  for (const facilityId of request.facility_ids) {
    // Find packaging for this facility's requisitions
    let totalSlotDemand = 0;
    let totalWeightKg = 0;
    let totalVolumeM3 = 0;

    for (const [reqId, packaging] of packagingData.entries()) {
      // Only include packaging from this request's requisitions
      if (request.requisition_ids.includes(reqId)) {
        totalSlotDemand += packaging.rounded_slot_demand;
        totalWeightKg += packaging.total_weight_kg || 0;
        totalVolumeM3 += packaging.total_volume_m3 || 0;
      }
    }

    facilityDemands.push({
      facility_id: facilityId,
      slot_demand: totalSlotDemand,
      weight_kg: totalWeightKg,
      volume_m3: totalVolumeM3,
    });

    slotDemandPerFacility[facilityId] = totalSlotDemand;
  }

  // Create frozen slot snapshot
  const slotSnapshot: BatchSlotSnapshot = {
    total_slot_demand: facilityDemands.reduce((sum, fd) => sum + fd.slot_demand, 0),
    facility_demands: facilityDemands,
    computed_at: now,
    version: 1,
  };

  return {
    batch_id: generateBatchId(),
    route_id: undefined,
    facilities: request.facility_ids,
    slot_demand_per_facility: slotDemandPerFacility,
    slot_snapshot: slotSnapshot,
    warehouse_id: request.warehouse_id,
    planned_date: request.planned_date,
    status: 'draft',
    priority: request.priority || 'medium',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Finalize a batch for FleetOps handoff.
 * After finalization, the batch is immutable.
 */
export function finalizeBatch(batch: StorefrontBatch): StorefrontBatch {
  if (batch.status === 'finalized' || batch.status === 'published') {
    throw new Error('Batch is already finalized');
  }

  if (batch.status === 'cancelled') {
    throw new Error('Cannot finalize cancelled batch');
  }

  return {
    ...batch,
    status: 'finalized',
    finalized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Check if a batch can be modified.
 */
export function isBatchMutable(batch: StorefrontBatch): boolean {
  return batch.status === 'draft' || batch.status === 'ready';
}

/**
 * Add facilities to a draft batch.
 * Re-derives slot demands from packaging.
 */
export function addFacilitiesToBatch(
  batch: StorefrontBatch,
  facilityIds: string[],
  packagingData: Map<string, RequisitionPackaging>
): StorefrontBatch {
  if (!isBatchMutable(batch)) {
    throw new Error('Cannot modify finalized batch');
  }

  const newFacilityIds = [
    ...batch.facilities,
    ...facilityIds.filter((id) => !batch.facilities.includes(id)),
  ];

  // Re-derive slot demands
  const facilityDemands: FacilitySlotDemand[] = [];
  const slotDemandPerFacility: Record<string, number> = {};

  for (const facilityId of newFacilityIds) {
    let totalSlotDemand = batch.slot_demand_per_facility[facilityId] || 0;

    // Add new facility demands from packaging
    if (facilityIds.includes(facilityId)) {
      for (const [, packaging] of packagingData.entries()) {
        totalSlotDemand += packaging.rounded_slot_demand;
      }
    }

    facilityDemands.push({
      facility_id: facilityId,
      slot_demand: totalSlotDemand,
    });

    slotDemandPerFacility[facilityId] = totalSlotDemand;
  }

  const slotSnapshot: BatchSlotSnapshot = {
    total_slot_demand: facilityDemands.reduce((sum, fd) => sum + fd.slot_demand, 0),
    facility_demands: facilityDemands,
    computed_at: new Date().toISOString(),
    version: batch.slot_snapshot.version + 1,
  };

  return {
    ...batch,
    facilities: newFacilityIds,
    slot_demand_per_facility: slotDemandPerFacility,
    slot_snapshot: slotSnapshot,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Remove facilities from a draft batch.
 */
export function removeFacilitiesFromBatch(
  batch: StorefrontBatch,
  facilityIds: string[]
): StorefrontBatch {
  if (!isBatchMutable(batch)) {
    throw new Error('Cannot modify finalized batch');
  }

  const remainingFacilities = batch.facilities.filter(
    (id) => !facilityIds.includes(id)
  );

  const slotDemandPerFacility: Record<string, number> = {};
  const facilityDemands: FacilitySlotDemand[] = [];

  for (const facilityId of remainingFacilities) {
    const demand = batch.slot_demand_per_facility[facilityId] || 0;
    slotDemandPerFacility[facilityId] = demand;
    facilityDemands.push({
      facility_id: facilityId,
      slot_demand: demand,
    });
  }

  const slotSnapshot: BatchSlotSnapshot = {
    total_slot_demand: facilityDemands.reduce((sum, fd) => sum + fd.slot_demand, 0),
    facility_demands: facilityDemands,
    computed_at: new Date().toISOString(),
    version: batch.slot_snapshot.version + 1,
  };

  return {
    ...batch,
    facilities: remainingFacilities,
    slot_demand_per_facility: slotDemandPerFacility,
    slot_snapshot: slotSnapshot,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Split a batch into sub-batches that each fit within a single vehicle's capacity.
 *
 * Uses Best-Fit Decreasing bin-packing: facilities sorted by slot demand (desc),
 * each placed into the first existing bin that can still accommodate it.
 * A new bin is opened when no existing bin fits the facility.
 *
 * Returns a single-element array when the batch already fits one vehicle.
 * Sub-batch IDs are suffixed: BATCH-xxx-1, BATCH-xxx-2, …
 */
export function splitBatch(
  batch: StorefrontBatch,
  vehicleCapacity: VehicleCapacity
): StorefrontBatch[] {
  const { total_slots, capacity_kg, capacity_m3 } = vehicleCapacity;

  // Build per-facility demand items, sorted heaviest-first
  const items = batch.facilities
    .map((facilityId) => {
      const fd = batch.slot_snapshot.facility_demands.find(
        (d) => d.facility_id === facilityId
      );
      return {
        facility_id: facilityId,
        slot_demand: batch.slot_demand_per_facility[facilityId] ?? 1,
        weight_kg: fd?.weight_kg ?? 0,
        volume_m3: fd?.volume_m3 ?? 0,
      };
    })
    .sort((a, b) => b.slot_demand - a.slot_demand);

  type Bin = {
    items: typeof items;
    slots: number;
    weight: number;
    volume: number;
  };

  const bins: Bin[] = [];

  for (const item of items) {
    // Find first bin that can hold this item
    const bin = bins.find(
      (b) =>
        b.slots + item.slot_demand <= total_slots &&
        b.weight + item.weight_kg <= capacity_kg &&
        b.volume + item.volume_m3 <= capacity_m3
    );

    if (bin) {
      bin.items.push(item);
      bin.slots += item.slot_demand;
      bin.weight += item.weight_kg;
      bin.volume += item.volume_m3;
    } else {
      bins.push({
        items: [item],
        slots: item.slot_demand,
        weight: item.weight_kg,
        volume: item.volume_m3,
      });
    }
  }

  const now = new Date().toISOString();

  return bins.map((bin, index) => {
    const slotDemandPerFacility: Record<string, number> = {};
    const facilityDemands: FacilitySlotDemand[] = [];

    for (const item of bin.items) {
      slotDemandPerFacility[item.facility_id] = item.slot_demand;
      facilityDemands.push({
        facility_id: item.facility_id,
        slot_demand: item.slot_demand,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
      });
    }

    const slotSnapshot: BatchSlotSnapshot = {
      total_slot_demand: bin.slots,
      facility_demands: facilityDemands,
      computed_at: now,
      version: batch.slot_snapshot.version + 1,
    };

    return {
      ...batch,
      batch_id: `${batch.batch_id}-${index + 1}`,
      facilities: bin.items.map((i) => i.facility_id),
      slot_demand_per_facility: slotDemandPerFacility,
      slot_snapshot: slotSnapshot,
      status: 'draft' as StorefrontBatchStatus,
      updated_at: now,
      finalized_at: undefined,
    };
  });
}

/**
 * Group orders into batch groupings by route affinity.
 *
 * Each order is matched to a route via its facility_id.
 * Orders whose facility has no matching route are collected in an 'unrouted' group.
 * Facility IDs within each grouping are deduplicated and sorted by route stop sequence.
 */
export function groupOrdersIntoBatches(
  orders: OrderItem[],
  routes: RouteDefinition[]
): BatchGrouping[] {
  // Build facility → route lookup
  const facilityToRoute = new Map<string, string>();
  for (const route of routes) {
    for (const facilityId of route.facility_ids) {
      facilityToRoute.set(facilityId, route.route_id);
    }
  }

  // Accumulate orders per route
  const groups = new Map<
    string,
    { routeId: string; orders: OrderItem[] }
  >();

  for (const order of orders) {
    const routeId = facilityToRoute.get(order.facility_id) ?? 'unrouted';
    const existing = groups.get(routeId);
    if (existing) {
      existing.orders.push(order);
    } else {
      groups.set(routeId, { routeId, orders: [order] });
    }
  }

  return Array.from(groups.values()).map(({ routeId, orders: grpOrders }) => {
    const route = routes.find((r) => r.route_id === routeId);
    const stopSequence = route?.facility_ids ?? [];

    // Deduplicate facility IDs, preserve route stop order
    const seen = new Set<string>();
    const facilityIds: string[] = [];
    for (const fid of stopSequence) {
      if (!seen.has(fid) && grpOrders.some((o) => o.facility_id === fid)) {
        facilityIds.push(fid);
        seen.add(fid);
      }
    }
    // Append any unrouted facilities that didn't appear in the stop sequence
    for (const order of grpOrders) {
      if (!seen.has(order.facility_id)) {
        facilityIds.push(order.facility_id);
        seen.add(order.facility_id);
      }
    }

    return {
      route_id: routeId,
      facility_ids: facilityIds,
      order_ids: grpOrders.map((o) => o.id),
      total_slot_demand: grpOrders.reduce((s, o) => s + (o.slot_demand ?? 0), 0),
      total_weight_kg: grpOrders.reduce((s, o) => s + (o.weight_kg ?? 0), 0),
      total_volume_m3: grpOrders.reduce((s, o) => s + (o.volume_m3 ?? 0), 0),
    };
  });
}

/**
 * Generate a unique batch ID.
 */
function generateBatchId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `BATCH-${timestamp}-${randomPart}`.toUpperCase();
}
