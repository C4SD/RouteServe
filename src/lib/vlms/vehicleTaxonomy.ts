/**
 * VLMS Vehicle Taxonomy
 * Static taxonomy for the 5-category vehicle classification system.
 * Categories and sub-types are defined here (no DB dependency at selection time).
 * Compatible with VehicleCategory and VehicleType interfaces from vlms-onboarding.ts.
 */

import type { VehicleCategory, VehicleType } from '@/types/vlms-onboarding';
import type { SlotConstraints } from './capacityCalculations';

// =====================================================
// SILHOUETTE PATHS
// icon_name is used to store the silhouette path
// =====================================================

const SILO = '/assets/vehicles/silhouettes';

// =====================================================
// TIER CONFIG HELPERS
// =====================================================

const singleTier = [
  { tier_name: 'Cargo', tier_order: 1, weight_pct: 100, volume_pct: 100, slot_count: 4 },
];

const twoTiers = [
  { tier_name: 'Lower', tier_order: 1, weight_pct: 55, volume_pct: 55, slot_count: 4 },
  { tier_name: 'Upper', tier_order: 2, weight_pct: 45, volume_pct: 45, slot_count: 4 },
];

const threeTiers = [
  { tier_name: 'Lower', tier_order: 1, weight_pct: 40, volume_pct: 35, slot_count: 4 },
  { tier_name: 'Middle', tier_order: 2, weight_pct: 40, volume_pct: 40, slot_count: 4 },
  { tier_name: 'Upper', tier_order: 3, weight_pct: 20, volume_pct: 25, slot_count: 4 },
];

const fourTiers = [
  { tier_name: 'Floor', tier_order: 1, weight_pct: 35, volume_pct: 30, slot_count: 6 },
  { tier_name: 'Lower', tier_order: 2, weight_pct: 30, volume_pct: 30, slot_count: 6 },
  { tier_name: 'Middle', tier_order: 3, weight_pct: 25, volume_pct: 25, slot_count: 6 },
  { tier_name: 'Upper', tier_order: 4, weight_pct: 10, volume_pct: 15, slot_count: 6 },
];

const ts = '2026-01-01T00:00:00Z';

// =====================================================
// CATEGORIES
// =====================================================

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  {
    id: 'cat-light-mobility',
    code: 'LIGHT_MOBILITY',
    name: 'Light Mobility',
    display_name: 'Light Mobility',
    source: 'biko',
    description: 'Last-mile, rapid response, and low-volume delivery',
    icon_name: `${SILO}/L1.webp`,
    default_tier_config: singleTier,
    created_at: ts,
    updated_at: ts,
  },
  {
    id: 'cat-passenger',
    code: 'PASSENGER',
    name: 'Passenger Vehicles',
    display_name: 'Passenger Vehicles',
    source: 'biko',
    description: 'Personnel movement and light transport',
    icon_name: `${SILO}/M1.webp`,
    default_tier_config: twoTiers,
    created_at: ts,
    updated_at: ts,
  },
  {
    id: 'cat-lcv',
    code: 'LCV',
    name: 'Light Commercial',
    display_name: 'Light Commercial Vehicles',
    source: 'biko',
    description: 'Mid-scale distribution and commercial delivery',
    icon_name: `${SILO}/N1.webp`,
    default_tier_config: twoTiers,
    created_at: ts,
    updated_at: ts,
  },
  {
    id: 'cat-heavy-truck',
    code: 'HEAVY_TRUCK',
    name: 'Heavy Trucks',
    display_name: 'Heavy Trucks',
    source: 'biko',
    description: 'Bulk haulage and inter-state logistics',
    icon_name: `${SILO}/N3.webp`,
    default_tier_config: threeTiers,
    created_at: ts,
    updated_at: ts,
  },
  {
    id: 'cat-specialized',
    code: 'SPECIALIZED',
    name: 'Specialized Vehicles',
    display_name: 'Specialized Vehicles',
    source: 'biko',
    description: 'Purpose-built or modified for specific operations',
    icon_name: `${SILO}/BIKO_COLDCHAIN.webp`,
    default_tier_config: twoTiers,
    created_at: ts,
    updated_at: ts,
  },
];

// =====================================================
// SUB-TYPES PER CATEGORY
// =====================================================

const SUBTYPES: Record<string, VehicleType[]> = {
  'cat-light-mobility': [
    {
      id: 'type-motorcycle',
      category_id: 'cat-light-mobility',
      code: 'MOTORCYCLE',
      name: 'Motorcycle',
      description: 'Two-wheeled motorized vehicle for rapid delivery',
      default_capacity_kg: 100,
      default_capacity_m3: 0.1,
      icon_name: `${SILO}/L1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-scooter',
      category_id: 'cat-light-mobility',
      code: 'SCOOTER',
      name: 'Scooter',
      description: 'Step-through frame urban delivery scooter',
      default_capacity_kg: 60,
      default_capacity_m3: 0.08,
      icon_name: `${SILO}/L1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-moped',
      category_id: 'cat-light-mobility',
      code: 'MOPED',
      name: 'Moped',
      description: 'Low-power motorized bicycle for light loads',
      default_capacity_kg: 50,
      default_capacity_m3: 0.06,
      icon_name: `${SILO}/BIKO_MOPED.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-three-wheeler',
      category_id: 'cat-light-mobility',
      code: 'THREE_WHEELER',
      name: 'Three-Wheeler',
      description: 'Auto rickshaw / Keke — urban last-mile transport',
      default_capacity_kg: 300,
      default_capacity_m3: 0.6,
      icon_name: `${SILO}/BIKO_KEKE.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-cargo-tricycle',
      category_id: 'cat-light-mobility',
      code: 'CARGO_TRICYCLE',
      name: 'Cargo Tricycle',
      description: 'Three-wheeled cargo bicycle or motorized trike',
      default_capacity_kg: 250,
      default_capacity_m3: 0.5,
      icon_name: `${SILO}/BIKO_KEKE.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
  ],

  'cat-passenger': [
    {
      id: 'type-sedan',
      category_id: 'cat-passenger',
      code: 'SEDAN',
      name: 'Sedan',
      description: 'Standard 4-door passenger car',
      default_capacity_kg: 400,
      default_capacity_m3: 0.5,
      icon_name: `${SILO}/M1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-suv',
      category_id: 'cat-passenger',
      code: 'SUV',
      name: 'SUV',
      description: 'Sport Utility Vehicle with higher ground clearance',
      default_capacity_kg: 500,
      default_capacity_m3: 0.8,
      icon_name: `${SILO}/M1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-hatchback',
      category_id: 'cat-passenger',
      code: 'HATCHBACK',
      name: 'Hatchback',
      description: 'Compact car with rear hatch for cargo access',
      default_capacity_kg: 350,
      default_capacity_m3: 0.4,
      icon_name: `${SILO}/M1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-wagon',
      category_id: 'cat-passenger',
      code: 'WAGON',
      name: 'Wagon (Estate)',
      description: 'Extended boot estate car for larger loads',
      default_capacity_kg: 500,
      default_capacity_m3: 0.7,
      icon_name: `${SILO}/M1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-minivan-mpv',
      category_id: 'cat-passenger',
      code: 'MINIVAN_MPV',
      name: 'Minivan / MPV',
      description: 'Multi-Purpose Vehicle for passengers and cargo',
      default_capacity_kg: 700,
      default_capacity_m3: 2.0,
      icon_name: `${SILO}/BIKO_MINIVAN.webp`,
      default_tier_config: twoTiers,
      created_at: ts,
      updated_at: ts,
    },
  ],

  'cat-lcv': [
    {
      id: 'type-panel-van',
      category_id: 'cat-lcv',
      code: 'PANEL_VAN',
      name: 'Panel Van',
      description: 'Enclosed cargo van for urban distribution',
      default_capacity_kg: 1200,
      default_capacity_m3: 8.0,
      icon_name: `${SILO}/M2.webp`,
      default_tier_config: twoTiers,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-minibus',
      category_id: 'cat-lcv',
      code: 'MINIBUS',
      name: 'Minibus',
      description: 'Passenger minibus, also used for staff transport',
      default_capacity_kg: 2000,
      default_capacity_m3: 5.0,
      icon_name: `${SILO}/BIKO_MINIVAN.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-pickup-truck',
      category_id: 'cat-lcv',
      code: 'PICKUP_TRUCK',
      name: 'Pickup Truck',
      description: 'Open-bed truck for flexible cargo hauling',
      default_capacity_kg: 1000,
      default_capacity_m3: 3.5,
      icon_name: `${SILO}/N1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-light-box-truck',
      category_id: 'cat-lcv',
      code: 'LIGHT_BOX_TRUCK',
      name: 'Light Box Truck',
      description: 'Rigid box body truck for medium loads',
      default_capacity_kg: 3500,
      default_capacity_m3: 18.0,
      icon_name: `${SILO}/N1.webp`,
      default_tier_config: twoTiers,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-refrigerated-van',
      category_id: 'cat-lcv',
      code: 'REFRIGERATED_VAN',
      name: 'Refrigerated Van',
      description: 'Temperature-controlled van for cold chain delivery',
      default_capacity_kg: 1000,
      default_capacity_m3: 6.0,
      icon_name: `${SILO}/BIKO_COLDCHAIN.webp`,
      default_tier_config: twoTiers,
      created_at: ts,
      updated_at: ts,
    },
  ],

  'cat-heavy-truck': [
    {
      id: 'type-box-truck',
      category_id: 'cat-heavy-truck',
      code: 'BOX_TRUCK',
      name: 'Box Truck',
      description: 'Large rigid box body truck for bulk cargo',
      default_capacity_kg: 10000,
      default_capacity_m3: 40.0,
      icon_name: `${SILO}/N2.webp`,
      default_tier_config: threeTiers,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-flatbed-truck',
      category_id: 'cat-heavy-truck',
      code: 'FLATBED_TRUCK',
      name: 'Flatbed Truck',
      description: 'Open flatbed for oversized or irregular cargo',
      default_capacity_kg: 12000,
      default_capacity_m3: 35.0,
      icon_name: `${SILO}/N2.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-semi-trailer',
      category_id: 'cat-heavy-truck',
      code: 'SEMI_TRAILER',
      name: 'Semi-Trailer',
      description: 'Articulated truck for long-haul interstate logistics',
      default_capacity_kg: 25000,
      default_capacity_m3: 90.0,
      icon_name: `${SILO}/N3.webp`,
      default_tier_config: fourTiers,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-tipper-truck',
      category_id: 'cat-heavy-truck',
      code: 'TIPPER_TRUCK',
      name: 'Tipper / Dump Truck',
      description: 'Hydraulic tipping body for bulk loose materials',
      default_capacity_kg: 15000,
      default_capacity_m3: 12.0,
      icon_name: `${SILO}/N2.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-tanker-truck',
      category_id: 'cat-heavy-truck',
      code: 'TANKER_TRUCK',
      name: 'Tanker Truck',
      description: 'Liquid or gas transport in pressurized tank',
      default_capacity_kg: 20000,
      default_capacity_m3: 25.0,
      icon_name: `${SILO}/N3.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-refrigerated-truck',
      category_id: 'cat-heavy-truck',
      code: 'REFRIGERATED_TRUCK',
      name: 'Refrigerated Truck',
      description: 'Large cold chain truck for bulk temperature-sensitive cargo',
      default_capacity_kg: 18000,
      default_capacity_m3: 55.0,
      icon_name: `${SILO}/BIKO_COLDCHAIN.webp`,
      default_tier_config: threeTiers,
      created_at: ts,
      updated_at: ts,
    },
  ],

  'cat-specialized': [
    {
      id: 'type-ambulance',
      category_id: 'cat-specialized',
      code: 'AMBULANCE',
      name: 'Ambulance',
      description: 'Emergency medical response and patient transport',
      default_capacity_kg: 800,
      default_capacity_m3: 4.0,
      icon_name: `${SILO}/M2.webp`,
      default_tier_config: twoTiers,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-mobile-clinic',
      category_id: 'cat-specialized',
      code: 'MOBILE_CLINIC',
      name: 'Mobile Clinic',
      description: 'Self-contained medical facility on wheels',
      default_capacity_kg: 3000,
      default_capacity_m3: 15.0,
      icon_name: `${SILO}/M2.webp`,
      default_tier_config: twoTiers,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-cold-chain-vehicle',
      category_id: 'cat-specialized',
      code: 'COLD_CHAIN',
      name: 'Cold Chain Vehicle',
      description: 'Dedicated temperature-controlled pharmaceutical transport',
      default_capacity_kg: 2000,
      default_capacity_m3: 10.0,
      icon_name: `${SILO}/BIKO_COLDCHAIN.webp`,
      default_tier_config: twoTiers,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-utility-vehicle',
      category_id: 'cat-specialized',
      code: 'UTILITY_VEHICLE',
      name: 'Utility Vehicle',
      description: 'Service and maintenance support vehicle',
      default_capacity_kg: 600,
      default_capacity_m3: 2.0,
      icon_name: `${SILO}/N1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 'type-armored-vehicle',
      category_id: 'cat-specialized',
      code: 'ARMORED_VEHICLE',
      name: 'Armored Vehicle',
      description: 'Secure high-value cargo and personnel transport',
      default_capacity_kg: 1000,
      default_capacity_m3: 3.0,
      icon_name: `${SILO}/M1.webp`,
      default_tier_config: singleTier,
      created_at: ts,
      updated_at: ts,
    },
  ],
};

// =====================================================
// SLOT CONSTRAINTS PER VEHICLE TYPE
// =====================================================

/**
 * Operational constraints for slot/tier layout per vehicle type.
 * These cap the raw mathematical fit so the result is ergonomically usable
 * (driver can reach all slots, load is stable, etc.).
 */
const VEHICLE_TYPE_SLOT_CONSTRAINTS: Record<string, SlotConstraints> = {
  // Light Mobility — bikes/scooters carry 1 rear carrier
  'type-motorcycle':     { maxTiers: 1, maxSlotsPerTier: 1 },
  'type-scooter':        { maxTiers: 1, maxSlotsPerTier: 1 },
  'type-moped':          { maxTiers: 1, maxSlotsPerTier: 1 },
  'type-three-wheeler':  { maxTiers: 1, maxSlotsPerTier: 4 },
  'type-cargo-tricycle': { maxTiers: 1, maxSlotsPerTier: 4 },

  // Passenger — boot/trunk only
  'type-sedan':          { maxTiers: 1, maxSlotsPerTier: 4 },
  'type-suv':            { maxTiers: 1, maxSlotsPerTier: 4 },
  'type-hatchback':      { maxTiers: 1, maxSlotsPerTier: 4 },
  'type-wagon':          { maxTiers: 1, maxSlotsPerTier: 6 },
  'type-minivan-mpv':    { maxTiers: 2, maxSlotsPerTier: 4 },

  // LCV
  'type-panel-van':        { maxTiers: 2, maxSlotsPerTier: 6 },
  'type-minibus':          { maxTiers: 1, maxSlotsPerTier: 6 },
  'type-pickup-truck':     { maxTiers: 1, maxSlotsPerTier: 6 },
  'type-light-box-truck':  { maxTiers: 3, maxSlotsPerTier: 8 },
  'type-refrigerated-van': { maxTiers: 2, maxSlotsPerTier: 6 },

  // Heavy Trucks
  'type-box-truck':          { maxTiers: 3, maxSlotsPerTier: 12 },
  'type-flatbed-truck':      { maxTiers: 1, maxSlotsPerTier: 12 },
  'type-semi-trailer':       { maxTiers: 4, maxSlotsPerTier: 12 },
  'type-tipper-truck':       { maxTiers: 1, maxSlotsPerTier: 12 },
  'type-tanker-truck':       { maxTiers: 1, maxSlotsPerTier: 4 },
  'type-refrigerated-truck': { maxTiers: 3, maxSlotsPerTier: 12 },

  // Specialized
  'type-ambulance':          { maxTiers: 2, maxSlotsPerTier: 4 },
  'type-mobile-clinic':      { maxTiers: 2, maxSlotsPerTier: 8 },
  'type-cold-chain-vehicle': { maxTiers: 2, maxSlotsPerTier: 6 },
  'type-utility-vehicle':    { maxTiers: 1, maxSlotsPerTier: 4 },
  'type-armored-vehicle':    { maxTiers: 1, maxSlotsPerTier: 4 },
};

const DEFAULT_SLOT_CONSTRAINTS: SlotConstraints = { maxTiers: 2, maxSlotsPerTier: 6 };

export function getSlotConstraints(typeId: string): SlotConstraints {
  return VEHICLE_TYPE_SLOT_CONSTRAINTS[typeId] ?? DEFAULT_SLOT_CONSTRAINTS;
}

// =====================================================
// ACCESSORS
// =====================================================

export function getSubtypesByCategory(categoryId: string): VehicleType[] {
  return SUBTYPES[categoryId] ?? [];
}

export function getCategoryById(id: string): VehicleCategory | undefined {
  return VEHICLE_CATEGORIES.find((c) => c.id === id);
}

export function getSubtypeById(id: string): VehicleType | undefined {
  for (const types of Object.values(SUBTYPES)) {
    const found = types.find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}
