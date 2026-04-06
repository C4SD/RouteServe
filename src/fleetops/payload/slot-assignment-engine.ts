/**
 * =====================================================
 * SLOT ASSIGNMENT ENGINE
 * =====================================================
 *
 * Intelligent facility-to-slot allocation.
 * Strategy: Heavy items → Lower tier, Light items → Upper tier.
 *
 * IMPORTANT:
 *   - NO allowOverflow option (removed)
 *   - All assignments must pass validation
 *   - Deterministic assignment based on rules
 */

import type {
  VehicleCapacity,
  VehicleSlot,
  SlotAssignment,
  AssignableFacility,
  AssignmentRule,
  AssignmentOptions,
  AssignmentResult,
} from './types';
import {
  generateVehicleSlotMap,
  validateSlotAssignment,
} from './slot-mapper';

// =====================================================
// AUTO-ASSIGNMENT ENGINE
// =====================================================

/**
 * Automatically assign facilities to vehicle slots.
 * Strategy: Heavy items → Lower tier, Light items → Upper tier.
 *
 * IMPORTANT: No overflow allowed. All facilities must fit or assignment fails.
 */
export function autoAssignFacilitiesToSlots(
  facilities: AssignableFacility[],
  vehicle: VehicleCapacity,
  options: AssignmentOptions = {}
): AssignmentResult {
  const {
    rules = [{ priority: 'weight', order: 'descending' }],
    fillStrategy = 'lower-first',
  } = options;

  const result: AssignmentResult = {
    success: false,
    assignments: [],
    unassigned: [],
    errors: [],
    warnings: [],
  };

  // Get available slots
  const availableSlots = generateVehicleSlotMap(vehicle);

  if (availableSlots.length === 0) {
    result.errors.push('Vehicle has no available slots');
    result.unassigned = [...facilities];
    return result;
  }

  // STRICT: No overflow allowed
  if (facilities.length > availableSlots.length) {
    result.errors.push(
      `Cannot fit ${facilities.length} facilities into ${availableSlots.length} slots. Assignment blocked.`
    );
    result.unassigned = [...facilities];
    return result;
  }

  // Sort facilities by weight (heaviest first)
  const sortedFacilities = sortFacilitiesByRules(facilities, rules);

  // Group slots by tier
  const slotsByTier = groupSlotsByTier(availableSlots);

  // Get tier order based on fill strategy
  const tierOrder = getTierOrder(slotsByTier, fillStrategy);

  // Assign facilities to slots
  let currentTierIndex = 0;
  let currentSlotIndexInTier = 0;

  for (const facility of sortedFacilities) {
    let assigned = false;

    while (currentTierIndex < tierOrder.length && !assigned) {
      const tierName = tierOrder[currentTierIndex];
      const tierSlots = slotsByTier[tierName];

      if (currentSlotIndexInTier < tierSlots.length) {
        const slot = tierSlots[currentSlotIndexInTier];

        // Validate assignment
        const validation = validateSlotAssignment(facility, slot);

        if (validation.valid) {
          // Create assignment — propagate program + storage_type for traceability
          result.assignments.push({
            slot_key: slot.slot_key,
            vehicle_id: vehicle.vehicle_id,
            tier_name: slot.tier_name,
            slot_number: slot.slot_number,
            facility_id: facility.id,
            load_kg: facility.estimated_weight,
            load_volume_m3: facility.estimated_volume,
            sequence_order: result.assignments.length + 1,
            program: facility.program,
            storage_type: facility.storage_type,
          });

          // Mark slot as occupied
          slot.occupied = true;
          slot.assigned_facility_id = facility.id;

          assigned = true;

          // Add warnings if any
          if (validation.warnings) {
            result.warnings.push(...validation.warnings);
          }
        } else {
          result.warnings.push(`Facility ${facility.id}: ${validation.error}`);
        }

        currentSlotIndexInTier++;
      } else {
        // Move to next tier
        currentTierIndex++;
        currentSlotIndexInTier = 0;
      }
    }

    if (!assigned) {
      result.unassigned.push(facility);
      result.errors.push(
        `Could not assign facility ${facility.id} - no suitable slots available`
      );
    }
  }

  // Success only if ALL facilities are assigned
  result.success = result.unassigned.length === 0;

  return result;
}

/**
 * Optimize slot assignment order (reorder for better balance).
 */
export function optimizeSlotAssignment(
  assignments: SlotAssignment[],
  _vehicle: VehicleCapacity
): SlotAssignment[] {
  // Sort by weight descending
  const sorted = [...assignments].sort((a, b) => {
    const weightA = a.load_kg || 0;
    const weightB = b.load_kg || 0;
    return weightB - weightA;
  });

  // Reassign sequence order
  return sorted.map((assignment, index) => ({
    ...assignment,
    sequence_order: index + 1,
  }));
}

/**
 * Detect slot conflicts (multiple facilities per slot).
 */
export function detectSlotConflicts(
  assignments: SlotAssignment[]
): Array<{ slot_key: string; facilities: string[]; conflict: string }> {
  const slotMap = new Map<string, string[]>();

  for (const assignment of assignments) {
    const facilities = slotMap.get(assignment.slot_key) || [];
    facilities.push(assignment.facility_id);
    slotMap.set(assignment.slot_key, facilities);
  }

  const conflicts: Array<{ slot_key: string; facilities: string[]; conflict: string }> = [];

  for (const [slotKey, facilityIds] of slotMap.entries()) {
    if (facilityIds.length > 1) {
      conflicts.push({
        slot_key: slotKey,
        facilities: facilityIds,
        conflict: `${facilityIds.length} facilities assigned to same slot`,
      });
    }
  }

  return conflicts;
}

// =====================================================
// VEHICLE SUGGESTIONS
// =====================================================

/**
 * Suggest optimal vehicle for batch.
 * Prefers 70-90% utilization.
 */
export function suggestOptimalVehicle(
  facilities: AssignableFacility[],
  availableVehicles: VehicleCapacity[]
): {
  vehicle: VehicleCapacity | null;
  score: number;
  reason: string;
} | null {
  if (availableVehicles.length === 0) {
    return null;
  }

  const facilityCount = facilities.length;
  const totalWeight = facilities.reduce((sum, f) => sum + (f.estimated_weight || 0), 0);
  const totalVolume = facilities.reduce((sum, f) => sum + (f.estimated_volume || 0), 0);
  const requiresColdChain = facilities.some(
    (f) => f.storage_type === 'cold' || f.storage_type === 'frozen'
  );

  let bestVehicle: VehicleCapacity | null = null;
  let bestScore = -1;
  let bestReason = '';

  for (const vehicle of availableVehicles) {
    const slots = generateVehicleSlotMap(vehicle);
    const vehicleCapacityKg = vehicle.capacity_kg || 0;
    const vehicleCapacityM3 = vehicle.capacity_m3 || 0;

    // Hard reject: cold chain required but vehicle lacks it
    if (requiresColdChain && !vehicle.is_cold_chain) {
      continue;
    }

    // Skip if insufficient slots
    if (slots.length < facilityCount) {
      continue;
    }

    // Skip if insufficient capacity
    if (totalWeight > vehicleCapacityKg || totalVolume > vehicleCapacityM3) {
      continue;
    }

    // Calculate utilization
    const slotUtilization = facilityCount / slots.length;
    const weightUtilization = vehicleCapacityKg > 0 ? totalWeight / vehicleCapacityKg : 0;
    const volumeUtilization = vehicleCapacityM3 > 0 ? totalVolume / vehicleCapacityM3 : 0;

    // Optimal utilization is 70-90% (target 80%)
    const optimalUtilization = 0.8;
    const slotScore = 100 - Math.abs(slotUtilization - optimalUtilization) * 100;
    const weightScore = 100 - Math.abs(weightUtilization - optimalUtilization) * 100;
    const volumeScore = 100 - Math.abs(volumeUtilization - optimalUtilization) * 100;

    // Combined score (weighted average)
    const score = slotScore * 0.4 + weightScore * 0.4 + volumeScore * 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestVehicle = vehicle;
      bestReason = `${Math.round(slotUtilization * 100)}% slot utilization, ${Math.round(weightUtilization * 100)}% weight capacity`;
    }
  }

  if (!bestVehicle) {
    return null;
  }

  return {
    vehicle: bestVehicle,
    score: Math.round(bestScore),
    reason: bestReason,
  };
}

/**
 * Compute load composition by program from slot assignments.
 * Returns each program's share of total slots as a percentage.
 * Slots with no program tag are grouped under "Untagged".
 */
export function computeLoadComposition(
  assignments: SlotAssignment[]
): Array<{ program: string; slots: number; pct: number }> {
  if (assignments.length === 0) return [];

  const countsByProgram = new Map<string, number>();

  for (const assignment of assignments) {
    const key = assignment.program ?? 'Untagged';
    countsByProgram.set(key, (countsByProgram.get(key) ?? 0) + 1);
  }

  const total = assignments.length;

  return Array.from(countsByProgram.entries())
    .map(([program, slots]) => ({
      program,
      slots,
      pct: Math.round((slots / total) * 100),
    }))
    .sort((a, b) => b.slots - a.slots);
}

/**
 * Get assignment statistics.
 */
export function getAssignmentStats(assignments: SlotAssignment[]): {
  totalAssignments: number;
  totalWeight: number;
  totalVolume: number;
  tierDistribution: Record<string, number>;
} {
  const stats = {
    totalAssignments: assignments.length,
    totalWeight: 0,
    totalVolume: 0,
    tierDistribution: {} as Record<string, number>,
  };

  for (const assignment of assignments) {
    stats.totalWeight += assignment.load_kg || 0;
    stats.totalVolume += assignment.load_volume_m3 || 0;

    const count = stats.tierDistribution[assignment.tier_name] || 0;
    stats.tierDistribution[assignment.tier_name] = count + 1;
  }

  return stats;
}

// =====================================================
// INTERNAL HELPERS
// =====================================================

/**
 * Sort facilities by assignment rules.
 */
function sortFacilitiesByRules(
  facilities: AssignableFacility[],
  rules: AssignmentRule[]
): AssignableFacility[] {
  const sorted = [...facilities];

  for (const rule of [...rules].reverse()) {
    sorted.sort((a, b) => {
      let comparison = 0;

      switch (rule.priority) {
        case 'weight':
          comparison = (a.estimated_weight || 0) - (b.estimated_weight || 0);
          break;
        case 'volume':
          comparison = (a.estimated_volume || 0) - (b.estimated_volume || 0);
          break;
        case 'fragile':
          comparison = (a.fragile ? 1 : 0) - (b.fragile ? 1 : 0);
          break;
        case 'sequence':
          comparison = 0; // Maintain original order
          break;
      }

      return rule.order === 'descending' ? -comparison : comparison;
    });
  }

  return sorted;
}

/**
 * Group slots by tier name.
 */
function groupSlotsByTier(slots: VehicleSlot[]): Record<string, VehicleSlot[]> {
  const grouped: Record<string, VehicleSlot[]> = {};

  for (const slot of slots) {
    if (!grouped[slot.tier_name]) {
      grouped[slot.tier_name] = [];
    }
    grouped[slot.tier_name].push(slot);
  }

  // Sort slots within each tier by slot_number
  for (const tierName in grouped) {
    grouped[tierName].sort((a, b) => a.slot_number - b.slot_number);
  }

  return grouped;
}

/**
 * Get tier order based on fill strategy.
 */
function getTierOrder(
  slotsByTier: Record<string, VehicleSlot[]>,
  strategy: 'lower-first' | 'upper-first' | 'balanced'
): string[] {
  const tiers = Object.keys(slotsByTier);

  // Get tier order numbers
  const tierInfo = tiers.map((tierName) => {
    const slots = slotsByTier[tierName];
    const tierOrder = slots.length > 0 ? slots[0].tier_order : 999;
    return { tierName, tierOrder };
  });

  // Sort by tier_order
  tierInfo.sort((a, b) => a.tier_order - b.tier_order);

  switch (strategy) {
    case 'lower-first':
      // Lower tier first (tier_order ascending)
      return tierInfo.map((t) => t.tierName);

    case 'upper-first':
      // Upper tier first (tier_order descending)
      return [...tierInfo].reverse().map((t) => t.tierName);

    case 'balanced': {
      // Alternate between tiers
      const result: string[] = [];
      let lowerIndex = 0;
      let upperIndex = tierInfo.length - 1;
      let useLower = true;

      while (lowerIndex <= upperIndex) {
        if (useLower) {
          result.push(tierInfo[lowerIndex].tierName);
          lowerIndex++;
        } else {
          result.push(tierInfo[upperIndex].tierName);
          upperIndex--;
        }
        useLower = !useLower;
      }

      return result;
    }

    default:
      return tierInfo.map((t) => t.tierName);
  }
}
