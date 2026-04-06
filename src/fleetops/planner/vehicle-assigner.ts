/**
 * =====================================================
 * VEHICLE ASSIGNER
 * =====================================================
 *
 * Assigns vehicles to batches.
 * Uses capacity validation from payload module.
 */

import type {
  VehicleAssignment,
  VehicleAssignmentRequest,
  ExecutablePlan,
  OptimizedRoute,
  VehiclePlan,
  SingleVehiclePlan,
  MultiVehiclePlan,
} from './types';
import type { VehicleCapacity } from '@/fleetops/payload';
import type { BatchHandoffContract } from '@/storefront/batch';

/**
 * Assign vehicle to batch.
 * Validates capacity before assignment.
 */
export function assignVehicleToBatch(
  request: VehicleAssignmentRequest,
  vehicle: VehicleCapacity
): VehicleAssignment | { error: string } {
  // Validate slot capacity
  if (request.slot_demand > vehicle.total_slots) {
    return {
      error: `Batch requires ${request.slot_demand} slots but vehicle has ${vehicle.total_slots}`,
    };
  }

  // Validate weight capacity
  if (request.total_weight_kg && request.total_weight_kg > vehicle.capacity_kg) {
    return {
      error: `Batch weight (${request.total_weight_kg}kg) exceeds vehicle capacity (${vehicle.capacity_kg}kg)`,
    };
  }

  // Validate volume capacity
  if (request.total_volume_m3 && request.total_volume_m3 > vehicle.capacity_m3) {
    return {
      error: `Batch volume (${request.total_volume_m3}m³) exceeds vehicle capacity (${vehicle.capacity_m3}m³)`,
    };
  }

  // Calculate utilization
  const slotUtilization = (request.slot_demand / vehicle.total_slots) * 100;
  const weightUtilization = request.total_weight_kg
    ? (request.total_weight_kg / vehicle.capacity_kg) * 100
    : 0;
  const volumeUtilization = request.total_volume_m3
    ? (request.total_volume_m3 / vehicle.capacity_m3) * 100
    : 0;

  return {
    batch_id: request.batch_id,
    vehicle_id: request.vehicle_id,
    driver_id: request.driver_id,
    assigned_at: new Date().toISOString(),
    slot_utilization_pct: Math.round(slotUtilization),
    weight_utilization_pct: Math.round(weightUtilization),
    volume_utilization_pct: Math.round(volumeUtilization),
  };
}

/**
 * Find best single vehicle for batch.
 * Prefers vehicles with 70-90% utilization.
 * Hard-rejects vehicles that lack cold chain when the batch requires it.
 */
export function findBestVehicleForBatch(
  slotDemand: number,
  totalWeightKg: number,
  totalVolumeM3: number,
  availableVehicles: VehicleCapacity[],
  requiresColdChain: boolean = false
): VehicleCapacity | null {
  // Filter vehicles that can handle the batch
  const suitableVehicles = availableVehicles.filter((v) => {
    if (requiresColdChain && !v.is_cold_chain) return false;
    return (
      v.total_slots >= slotDemand &&
      v.capacity_kg >= totalWeightKg &&
      v.capacity_m3 >= totalVolumeM3
    );
  });

  if (suitableVehicles.length === 0) {
    return null;
  }

  // Score vehicles by utilization (target 80%)
  const scored = suitableVehicles.map((vehicle) => {
    const slotUtil = slotDemand / vehicle.total_slots;
    const weightUtil = totalWeightKg / vehicle.capacity_kg;
    const volumeUtil = totalVolumeM3 / vehicle.capacity_m3;

    // Combined utilization (weighted average)
    const avgUtil = (slotUtil * 0.4 + weightUtil * 0.4 + volumeUtil * 0.2);

    // Score: prefer 80% utilization
    const score = 100 - Math.abs(avgUtil - 0.8) * 100;

    return { vehicle, score };
  });

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  return scored[0].vehicle;
}

/**
 * Create executable plan from batch, route, and vehicle assignment.
 */
export function createExecutablePlan(
  batch: BatchHandoffContract,
  route: OptimizedRoute,
  vehicleAssignment: VehicleAssignment
): ExecutablePlan {
  return {
    plan_id: generatePlanId(),
    batch_id: batch.batch_id,
    route,
    vehicle_assignment: vehicleAssignment,
    slot_snapshot: batch.slot_snapshot,
    facilities: batch.facilities,
    created_at: new Date().toISOString(),
    status: 'ready',
  };
}

/**
 * Validate executable plan.
 */
export function validateExecutablePlan(plan: ExecutablePlan): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate route covers all facilities
  const routeFacilities = new Set(plan.route.points.map((p) => p.facility_id));
  const missingInRoute = plan.facilities.filter((f) => !routeFacilities.has(f));

  if (missingInRoute.length > 0) {
    errors.push(`Route missing facilities: ${missingInRoute.join(', ')}`);
  }

  // Validate vehicle assignment
  if (!plan.vehicle_assignment.vehicle_id) {
    errors.push('No vehicle assigned');
  }

  // Validate slot utilization doesn't exceed 100%
  if (plan.vehicle_assignment.slot_utilization_pct > 100) {
    errors.push(`Slot utilization exceeds 100% (${plan.vehicle_assignment.slot_utilization_pct}%)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Recommend a vehicle plan for a batch.
 *
 * Strategy:
 *   1. Try a single vehicle first (prefers 70-90% utilization, target 80%).
 *   2. If no single vehicle fits, bin-pack facilities across the fleet
 *      (Best-Fit Decreasing on slot demand, largest vehicles preferred).
 *
 * Returns null when even individual facilities exceed all available vehicles.
 *
 * score: 0–100 where 100 = perfect 80% utilization across slots + weight + volume.
 */
export function recommendVehiclePlan(
  batch: BatchHandoffContract,
  vehicles: VehicleCapacity[]
): VehiclePlan | null {
  if (vehicles.length === 0) return null;

  const { slot_snapshot } = batch;
  const totalSlots = slot_snapshot.total_slot_demand;
  const totalWeight = slot_snapshot.facility_demands.reduce(
    (s, fd) => s + (fd.weight_kg ?? 0),
    0
  );
  const totalVolume = slot_snapshot.facility_demands.reduce(
    (s, fd) => s + (fd.volume_m3 ?? 0),
    0
  );

  // --- 1. Single-vehicle attempt ---
  const bestSingle = findBestVehicleForBatch(totalSlots, totalWeight, totalVolume, vehicles);

  if (bestSingle) {
    const slotUtil = Math.round((totalSlots / bestSingle.total_slots) * 100);
    const weightUtil = bestSingle.capacity_kg > 0
      ? Math.round((totalWeight / bestSingle.capacity_kg) * 100)
      : 0;
    const volumeUtil = bestSingle.capacity_m3 > 0
      ? Math.round((totalVolume / bestSingle.capacity_m3) * 100)
      : 0;
    // Composite utilization, weighted by importance
    const composite = slotUtil * 0.4 + weightUtil * 0.4 + volumeUtil * 0.2;
    const score = Math.round(100 - Math.abs(composite - 80));

    return {
      type: 'single',
      vehicle_id: bestSingle.vehicle_id,
      score,
      slot_utilization_pct: slotUtil,
      weight_utilization_pct: weightUtil,
      volume_utilization_pct: volumeUtil,
      reason: `${slotUtil}% slot utilization, ${weightUtil}% weight capacity`,
    } satisfies SingleVehiclePlan;
  }

  // --- 2. Multi-vehicle fallback: Best-Fit Decreasing bin-packing ---
  // Largest vehicles first (minimizes bins opened)
  const sortedVehicles = [...vehicles].sort((a, b) => b.total_slots - a.total_slots);

  // Sort facility demands heaviest-first
  const sortedDemands = [...slot_snapshot.facility_demands].sort(
    (a, b) => b.slot_demand - a.slot_demand
  );

  type Bin = {
    vehicle: VehicleCapacity;
    facilityIds: string[];
    slots: number;
    weight: number;
    volume: number;
  };

  const bins: Bin[] = [];

  for (const fd of sortedDemands) {
    const fdWeight = fd.weight_kg ?? 0;
    const fdVolume = fd.volume_m3 ?? 0;

    // Best-fit: pick the bin with minimum remaining capacity that still fits
    let bestBin: Bin | null = null;
    let bestRemaining = Infinity;

    for (const bin of bins) {
      const remSlots = bin.vehicle.total_slots - bin.slots - fd.slot_demand;
      const remWeight = bin.vehicle.capacity_kg - bin.weight - fdWeight;
      const remVolume = bin.vehicle.capacity_m3 - bin.volume - fdVolume;
      if (remSlots >= 0 && remWeight >= 0 && remVolume >= 0 && remSlots < bestRemaining) {
        bestBin = bin;
        bestRemaining = remSlots;
      }
    }

    if (bestBin) {
      bestBin.facilityIds.push(fd.facility_id);
      bestBin.slots += fd.slot_demand;
      bestBin.weight += fdWeight;
      bestBin.volume += fdVolume;
    } else {
      // Open a new bin: pick the smallest vehicle that can fit this facility alone
      const vehicleForBin = sortedVehicles.find(
        (v) =>
          v.total_slots >= fd.slot_demand &&
          v.capacity_kg >= fdWeight &&
          v.capacity_m3 >= fdVolume
      );

      if (!vehicleForBin) return null; // Facility too large for any vehicle

      bins.push({
        vehicle: vehicleForBin,
        facilityIds: [fd.facility_id],
        slots: fd.slot_demand,
        weight: fdWeight,
        volume: fdVolume,
      });
    }
  }

  if (bins.length === 0) return null;

  const segments = bins.map((bin) => {
    const slotUtil = Math.round((bin.slots / bin.vehicle.total_slots) * 100);
    const composite =
      slotUtil * 0.4 +
      (bin.vehicle.capacity_kg > 0
        ? Math.round((bin.weight / bin.vehicle.capacity_kg) * 100) * 0.4
        : 0) +
      (bin.vehicle.capacity_m3 > 0
        ? Math.round((bin.volume / bin.vehicle.capacity_m3) * 100) * 0.2
        : 0);
    return {
      vehicle_id: bin.vehicle.vehicle_id,
      facility_ids: bin.facilityIds,
      slot_utilization_pct: slotUtil,
      score: Math.round(100 - Math.abs(composite - 80)),
    };
  });

  const totalScore = Math.round(
    segments.reduce((s, seg) => s + seg.score, 0) / segments.length
  );

  return {
    type: 'multi',
    segments,
    vehicles_needed: bins.length,
    total_score: totalScore,
    reason: `${totalSlots} slots across ${slot_snapshot.facility_demands.length} facilities requires ${bins.length} vehicles`,
  } satisfies MultiVehiclePlan;
}

/**
 * Generate plan ID.
 */
function generatePlanId(): string {
  return `PLAN-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
}
