/**
 * VLMS Vehicle Onboarding - Capacity Calculations
 * Utility functions for cargo volume and tier capacity calculations
 */

import type { TierConfig, DimensionalConfig, CapacityConfig } from '@/types/vlms-onboarding';

// =====================================================
// DIMENSIONAL CALCULATIONS
// =====================================================

/**
 * Calculate cargo volume in cubic meters from dimensions in centimeters
 * Formula: (L/100 × W/100 × H/100) = m³
 */
export function calculateVolumeFromDimensions(
  length_cm: number,
  width_cm: number,
  height_cm: number
): number {
  if (length_cm <= 0 || width_cm <= 0 || height_cm <= 0) {
    throw new Error('All dimensions must be greater than zero');
  }

  // Convert cm to meters and calculate volume
  const volumeM3 = (length_cm / 100) * (width_cm / 100) * (height_cm / 100);

  // Round to 2 decimal places
  return Math.round(volumeM3 * 100) / 100;
}

/**
 * Create dimensional config with calculated volume
 */
export function createDimensionalConfig(
  length_cm: number,
  width_cm: number,
  height_cm: number
): DimensionalConfig {
  return {
    length_cm,
    width_cm,
    height_cm,
    calculated_volume_m3: calculateVolumeFromDimensions(length_cm, width_cm, height_cm),
  };
}

/**
 * Estimate dimensions from volume (assumes standard cargo box proportions)
 * Typical ratio: 2:1:1 (length:width:height)
 */
export function estimateDimensionsFromVolume(volume_m3: number): DimensionalConfig {
  if (volume_m3 <= 0) {
    throw new Error('Volume must be greater than zero');
  }

  // Assume 2:1:1 ratio for L:W:H
  // V = 2x * x * x = 2x³
  // x = ∛(V/2)
  const x = Math.cbrt(volume_m3 / 2);

  const length_cm = Math.round(2 * x * 100);
  const width_cm = Math.round(x * 100);
  const height_cm = Math.round(x * 100);

  return createDimensionalConfig(length_cm, width_cm, height_cm);
}

// =====================================================
// TIER CALCULATIONS
// =====================================================

/**
 * Calculate tier capacities from percentages and total capacity
 */
export function calculateTierCapacities(
  tierConfigs: TierConfig[],
  totalCapacityKg: number,
  totalVolumeM3: number
): TierConfig[] {
  return tierConfigs.map((tier) => ({
    ...tier,
    max_weight_kg: tier.weight_pct
      ? Math.round((tier.weight_pct / 100) * totalCapacityKg)
      : tier.max_weight_kg,
    max_volume_m3: tier.volume_pct
      ? Math.round((tier.volume_pct / 100) * totalVolumeM3 * 100) / 100
      : tier.max_volume_m3,
  }));
}

/**
 * Calculate percentage distributions from absolute tier values
 */
export function calculateTierPercentages(
  tierConfigs: TierConfig[],
  totalCapacityKg?: number,
  totalVolumeM3?: number
): TierConfig[] {
  const totalTierWeight = tierConfigs.reduce(
    (sum, tier) => sum + (tier.max_weight_kg || 0),
    0
  );
  const totalTierVolume = tierConfigs.reduce(
    (sum, tier) => sum + (tier.max_volume_m3 || 0),
    0
  );

  return tierConfigs.map((tier) => ({
    ...tier,
    weight_pct:
      totalCapacityKg && tier.max_weight_kg
        ? Math.round((tier.max_weight_kg / totalCapacityKg) * 100)
        : totalTierWeight && tier.max_weight_kg
        ? Math.round((tier.max_weight_kg / totalTierWeight) * 100)
        : undefined,
    volume_pct:
      totalVolumeM3 && tier.max_volume_m3
        ? Math.round((tier.max_volume_m3 / totalVolumeM3) * 100)
        : totalTierVolume && tier.max_volume_m3
        ? Math.round((tier.max_volume_m3 / totalTierVolume) * 100)
        : undefined,
  }));
}

/**
 * Sum total tier capacities
 */
export function sumTierCapacities(tierConfigs: TierConfig[]): {
  totalWeightKg: number;
  totalVolumeM3: number;
} {
  const totalWeightKg = tierConfigs.reduce(
    (sum, tier) => sum + (tier.max_weight_kg || 0),
    0
  );
  const totalVolumeM3 = tierConfigs.reduce(
    (sum, tier) => sum + (tier.max_volume_m3 || 0),
    0
  );

  return {
    totalWeightKg: Math.round(totalWeightKg),
    totalVolumeM3: Math.round(totalVolumeM3 * 100) / 100,
  };
}

/**
 * Validate tier order sequence
 */
export function validateTierOrder(tierConfigs: TierConfig[]): boolean {
  if (tierConfigs.length === 0) return true;

  const orders = tierConfigs.map((t) => t.tier_order).sort((a, b) => a - b);

  // Check for sequential ordering starting from 1
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) return false;
  }

  return true;
}

/**
 * Sort tiers by order
 */
export function sortTiersByOrder(tierConfigs: TierConfig[]): TierConfig[] {
  return [...tierConfigs].sort((a, b) => a.tier_order - b.tier_order);
}

/**
 * Create default tier configuration
 */
export function createDefaultTierConfig(
  tierCount: number,
  totalCapacityKg: number,
  totalVolumeM3: number
): TierConfig[] {
  if (tierCount === 1) {
    return [
      {
        tier_name: 'Cargo',
        tier_order: 1,
        max_weight_kg: totalCapacityKg,
        max_volume_m3: totalVolumeM3,
        weight_pct: 100,
        volume_pct: 100,
        slot_count: 3,
      },
    ];
  }

  if (tierCount === 3) {
    // Standard 30-40-30 distribution
    return [
      {
        tier_name: 'Lower',
        tier_order: 1,
        max_weight_kg: Math.round(totalCapacityKg * 0.3),
        max_volume_m3: Math.round(totalVolumeM3 * 0.3 * 100) / 100,
        weight_pct: 30,
        volume_pct: 30,
        slot_count: 3,
      },
      {
        tier_name: 'Middle',
        tier_order: 2,
        max_weight_kg: Math.round(totalCapacityKg * 0.4),
        max_volume_m3: Math.round(totalVolumeM3 * 0.4 * 100) / 100,
        weight_pct: 40,
        volume_pct: 40,
        slot_count: 4,
      },
      {
        tier_name: 'Upper',
        tier_order: 3,
        max_weight_kg: Math.round(totalCapacityKg * 0.3),
        max_volume_m3: Math.round(totalVolumeM3 * 0.3 * 100) / 100,
        weight_pct: 30,
        volume_pct: 30,
        slot_count: 3,
      },
    ];
  }

  // Equal distribution for other tier counts
  const weightPerTier = Math.round(totalCapacityKg / tierCount);
  const volumePerTier = Math.round((totalVolumeM3 / tierCount) * 100) / 100;
  const pctPerTier = Math.round(100 / tierCount);

  return Array.from({ length: tierCount }, (_, i) => ({
    tier_name: `Tier ${i + 1}`,
    tier_order: i + 1,
    max_weight_kg: weightPerTier,
    max_volume_m3: volumePerTier,
    weight_pct: pctPerTier,
    volume_pct: pctPerTier,
    slot_count: 3,
  }));
}

// =====================================================
// BOX PRESETS
// =====================================================

export interface BoxPreset {
  id: string;
  name: string;
  description: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
}

/**
 * Standard packaging presets used for slot computation.
 * Each preset represents the footprint of one "slot unit".
 */
export const BOX_PRESETS: BoxPreset[] = [
  {
    id: 'box-xs',
    name: 'XS',
    description: 'Vials, syringes, small packs',
    length_cm: 20,
    width_cm: 15,
    height_cm: 10,
  },
  {
    id: 'box-s',
    name: 'Small',
    description: 'Blister packs, diagnostic kits',
    length_cm: 30,
    width_cm: 20,
    height_cm: 15,
  },
  {
    id: 'box-m',
    name: 'Medium',
    description: 'Standard distribution carton',
    length_cm: 40,
    width_cm: 30,
    height_cm: 25,
  },
  {
    id: 'box-l',
    name: 'Large',
    description: 'Bulk commodity box',
    length_cm: 60,
    width_cm: 40,
    height_cm: 35,
  },
  {
    id: 'box-xl',
    name: 'XL',
    description: 'Program bulk pallet unit',
    length_cm: 80,
    width_cm: 60,
    height_cm: 50,
  },
];

export function getBoxPresetById(id: string): BoxPreset | undefined {
  return BOX_PRESETS.find((b) => b.id === id);
}

// =====================================================
// SLOT CAPACITY ENGINE
// =====================================================

export interface SlotConstraints {
  maxTiers: number;
  maxSlotsPerTier: number;
}

export interface SlotLayoutResult {
  /** Raw fit before operational constraints */
  rawFit: { n_L: number; n_W: number; n_H: number };
  /** Number of vertical tiers (after constraints) */
  tiers: number;
  /** Slots per tier (after constraints) */
  slotsPerTier: number;
  /** Grid columns for visual rendering */
  gridCols: number;
  /** Grid rows per tier for visual rendering */
  gridRows: number;
  /** Total slots = tiers × slotsPerTier */
  totalSlots: number;
  /** True when at least one constraint was applied */
  isConstrained: boolean;
}

/**
 * Compute slot layout from vehicle cargo dimensions, box preset, and operational constraints.
 *
 * Formula (per axis):
 *   n_L = floor(vehicle.length / box.length)
 *   n_W = floor(vehicle.width  / box.width)
 *   n_H = floor(vehicle.height / box.height)
 *
 * Then:
 *   rawTiers      = n_H
 *   rawSlots      = n_L × n_W
 *   tiers         = min(rawTiers, constraints.maxTiers)
 *   slotsPerTier  = min(rawSlots, constraints.maxSlotsPerTier)
 */
export function computeSlotLayout(
  vehicle: { length_cm: number; width_cm: number; height_cm: number },
  box: BoxPreset,
  constraints: SlotConstraints
): SlotLayoutResult {
  const nL = Math.max(1, Math.floor(vehicle.length_cm / box.length_cm));
  const nW = Math.max(1, Math.floor(vehicle.width_cm / box.width_cm));
  const nH = Math.max(1, Math.floor(vehicle.height_cm / box.height_cm));

  const rawSlots = nL * nW;
  const rawTiers = nH;

  const tiers = Math.min(rawTiers, constraints.maxTiers);
  const slotsPerTier = Math.min(rawSlots, constraints.maxSlotsPerTier);

  const { rows: gridRows, cols: gridCols } = deriveSlotGrid(slotsPerTier);

  return {
    rawFit: { n_L: nL, n_W: nW, n_H: nH },
    tiers,
    slotsPerTier,
    gridCols,
    gridRows,
    totalSlots: tiers * slotsPerTier,
    isConstrained: rawTiers > constraints.maxTiers || rawSlots > constraints.maxSlotsPerTier,
  };
}

/**
 * Map a slot count to a clean (rows × cols) grid for visual rendering.
 * Favours landscape layouts (wider than tall).
 */
export function deriveSlotGrid(count: number): { rows: number; cols: number } {
  if (count <= 1) return { rows: 1, cols: 1 };
  if (count <= 2) return { rows: 1, cols: 2 };
  if (count <= 3) return { rows: 1, cols: 3 };
  if (count <= 4) return { rows: 2, cols: 2 };
  if (count <= 6) return { rows: 2, cols: 3 };
  if (count <= 8) return { rows: 2, cols: 4 };
  if (count <= 9) return { rows: 3, cols: 3 };
  if (count <= 12) return { rows: 3, cols: 4 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { rows, cols };
}

// =====================================================
// AUTO-CALCULATION: TIERS & SLOTS FROM DIMENSIONS
// =====================================================

/**
 * Standard slot footprint in m² (~40cm × 40cm package)
 * Used to calculate how many slots fit per tier
 */
const SLOT_FOOTPRINT_M2 = 0.16;

/**
 * Automatically calculate optimal tier configuration and interior dimensions
 * from cargo dimensions (L×W×H) and payload.
 *
 * Logic:
 *  - Tier count derived from cargo height (constrained by vehicle class)
 *  - Slots per tier derived from floor area ÷ slot footprint
 *  - Weight & volume distributed across tiers
 *  - Interior dimensions derived from cargo dimensions (cargo ≈ usable interior)
 */
export function calculateAutoTiersFromDimensions(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  maxPayloadKg: number,
  constraints?: { minTiers: number; maxTiers: number; totalMaxSlots?: number; maxSlotsPerTier?: number }
): {
  tiers: TierConfig[];
  interiorDimensions: { length_cm: number; width_cm: number; height_cm: number };
} {
  if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
    return { tiers: [], interiorDimensions: { length_cm: 0, width_cm: 0, height_cm: 0 } };
  }

  const minTiers = constraints?.minTiers ?? 1;
  const maxTiers = constraints?.maxTiers ?? 4;
  const totalMaxSlots = constraints?.totalMaxSlots ?? 20;
  const maxSlotsPerTier = constraints?.maxSlotsPerTier ?? 12;

  // --- Determine tier count from height ---
  let tierCount: number;
  if (heightCm < 120) {
    tierCount = 1;
  } else if (heightCm < 180) {
    tierCount = 2;
  } else if (heightCm < 260) {
    tierCount = 3;
  } else {
    tierCount = 4;
  }
  // Clamp to vehicle class constraints
  tierCount = Math.max(minTiers, Math.min(maxTiers, tierCount));

  // --- Calculate slots per tier from floor area ---
  const floorAreaM2 = (lengthCm / 100) * (widthCm / 100);
  let rawSlotsPerTier = Math.max(1, Math.floor(floorAreaM2 / SLOT_FOOTPRINT_M2));
  rawSlotsPerTier = Math.min(rawSlotsPerTier, maxSlotsPerTier, 12);

  // Ensure total doesn't exceed max
  const maxPerTierFromTotal = Math.floor(totalMaxSlots / tierCount);
  const slotsPerTier = Math.max(1, Math.min(rawSlotsPerTier, maxPerTierFromTotal));

  // --- Build tier configs ---
  const volumeM3 = calculateVolumeFromDimensions(lengthCm, widthCm, heightCm);
  const tierNames = getTierNames(tierCount);

  // Weight distribution: bottom-heavy for stability (heavier at bottom)
  const weightDistributions: Record<number, number[]> = {
    1: [1.0],
    2: [0.6, 0.4],
    3: [0.4, 0.35, 0.25],
    4: [0.35, 0.3, 0.2, 0.15],
  };
  const weightPcts = weightDistributions[tierCount] || Array(tierCount).fill(1 / tierCount);

  const tiers: TierConfig[] = tierNames.map((name, i) => {
    // Slightly reduce slots for upper tiers (accessibility / lighter items)
    const slotReduction = i >= 2 ? 1 : 0;
    const tierSlots = Math.max(1, slotsPerTier - slotReduction);

    return {
      tier_name: name,
      tier_order: i + 1,
      max_weight_kg: maxPayloadKg > 0 ? Math.round(maxPayloadKg * weightPcts[i]) : undefined,
      max_volume_m3: Math.round((volumeM3 / tierCount) * 100) / 100,
      weight_pct: Math.round(weightPcts[i] * 100),
      volume_pct: Math.round(100 / tierCount),
      slot_count: tierSlots,
    };
  });

  // Final total-slot clamp
  let totalSlots = tiers.reduce((s, t) => s + (t.slot_count || 0), 0);
  if (totalSlots > totalMaxSlots) {
    // Remove from top tiers first
    for (let i = tiers.length - 1; i >= 0 && totalSlots > totalMaxSlots; i--) {
      const excess = totalSlots - totalMaxSlots;
      const canRemove = Math.min(excess, (tiers[i].slot_count || 1) - 1);
      tiers[i].slot_count = (tiers[i].slot_count || 1) - canRemove;
      totalSlots -= canRemove;
    }
  }

  // --- Interior dimensions (cargo area ≈ interior usable space) ---
  const interiorDimensions = {
    length_cm: lengthCm,
    width_cm: widthCm,
    height_cm: heightCm,
  };

  return { tiers, interiorDimensions };
}

/**
 * Get tier names based on count
 */
function getTierNames(count: number): string[] {
  switch (count) {
    case 1:
      return ['Cargo'];
    case 2:
      return ['Lower', 'Upper'];
    case 3:
      return ['Lower', 'Middle', 'Upper'];
    case 4:
      return ['Lower', 'Middle', 'Upper', 'Top'];
    default:
      return Array.from({ length: count }, (_, i) => `Tier ${i + 1}`);
  }
}

// =====================================================
// CAPACITY CONFIG HELPERS
// =====================================================

/**
 * Create capacity config from vehicle type defaults
 */
export function createCapacityConfigFromDefaults(
  defaultCapacityKg?: number,
  defaultCapacityM3?: number,
  defaultTierConfig?: TierConfig[]
): CapacityConfig {
  const capacity_kg = defaultCapacityKg || 1000;
  const capacity_m3 = defaultCapacityM3 || 4.5;

  let tieredConfig = defaultTierConfig || [];

  // If tier config has percentages but no absolute values, calculate them
  if (tieredConfig.length > 0) {
    tieredConfig = calculateTierCapacities(tieredConfig, capacity_kg, capacity_m3);
  }

  return {
    capacity_kg,
    capacity_m3,
    tiered_config: tieredConfig,
    use_dimensions: false,
  };
}

/**
 * Update capacity config with new dimensions
 */
export function updateCapacityWithDimensions(
  config: CapacityConfig,
  dimensions: DimensionalConfig
): CapacityConfig {
  return {
    ...config,
    capacity_m3: dimensions.calculated_volume_m3,
    dimensions,
    use_dimensions: true,
  };
}

/**
 * Update capacity config with manual values
 */
export function updateCapacityManual(
  config: CapacityConfig,
  capacity_kg: number,
  capacity_m3: number
): CapacityConfig {
  return {
    ...config,
    capacity_kg,
    capacity_m3,
    dimensions: undefined,
    use_dimensions: false,
  };
}

/**
 * Recalculate tier capacities when total capacity changes
 */
export function recalculateTierCapacities(
  config: CapacityConfig,
  newCapacityKg?: number,
  newCapacityM3?: number
): CapacityConfig {
  const capacity_kg = newCapacityKg ?? config.capacity_kg ?? 1000;
  const capacity_m3 = newCapacityM3 ?? config.capacity_m3 ?? 4.5;

  const tieredConfig = calculateTierCapacities(
    config.tiered_config,
    capacity_kg,
    capacity_m3
  );

  return {
    ...config,
    capacity_kg,
    capacity_m3,
    tiered_config: tieredConfig,
  };
}

// =====================================================
// FORMAT HELPERS
// =====================================================

/**
 * Format volume with unit
 */
export function formatVolume(volumeM3: number): string {
  return `${volumeM3.toFixed(2)} m³`;
}

/**
 * Format weight with unit
 */
export function formatWeight(weightKg: number): string {
  if (weightKg >= 1000) {
    return `${(weightKg / 1000).toFixed(1)} tons`;
  }
  return `${weightKg} kg`;
}

/**
 * Format dimensions
 */
export function formatDimensions(dimensions: DimensionalConfig): string {
  const fmt = (cm: number) => (cm / 100).toFixed(2);
  return `${fmt(dimensions.length_cm)} × ${fmt(dimensions.width_cm)} × ${fmt(dimensions.height_cm)} m`;
}

/**
 * Format tier summary
 */
export function formatTierSummary(tier: TierConfig): string {
  const parts: string[] = [tier.tier_name];

  if (tier.max_weight_kg) {
    parts.push(formatWeight(tier.max_weight_kg));
  }

  if (tier.max_volume_m3) {
    parts.push(formatVolume(tier.max_volume_m3));
  }

  return parts.join(' • ');
}
