/**
 * Default Vehicle Configurations
 * Pre-populated dimensions and specs for each vehicle category
 */

import type { TierConfig } from '@/types/vlms-onboarding';

interface DefaultVehicleConfig {
  dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  payload: {
    gross_weight_kg: number;
    max_payload_kg: number;
  };
  tiers: TierConfig[];
}

export const DEFAULT_VEHICLE_CONFIGS: Record<string, DefaultVehicleConfig> = {
  // EU Categories - Motorcycles (1 tier)
  L1: {
    dimensions: { length_cm: 180, width_cm: 70, height_cm: 110 },
    payload: { gross_weight_kg: 250, max_payload_kg: 100 },
    tiers: [
      { tier_name: 'Cargo Basket', tier_order: 1, slot_count: 4 }
    ],
  },
  L2: {
    dimensions: { length_cm: 220, width_cm: 80, height_cm: 120 },
    payload: { gross_weight_kg: 400, max_payload_kg: 150 },
    tiers: [
      { tier_name: 'Rear Cargo', tier_order: 1, slot_count: 4 }
    ],
  },

  // Sedans/Small Vehicles (2 tiers)
  M1: {
    dimensions: { length_cm: 450, width_cm: 180, height_cm: 145 },
    payload: { gross_weight_kg: 2000, max_payload_kg: 500 },
    tiers: [
      { tier_name: 'Lower', tier_order: 1, slot_count: 4 },
      { tier_name: 'Upper', tier_order: 2, slot_count: 3 },
    ],
  },

  // Vans (3 tiers)
  M2: {
    dimensions: { length_cm: 520, width_cm: 190, height_cm: 200 },
    payload: { gross_weight_kg: 3500, max_payload_kg: 800 },
    tiers: [
      { tier_name: 'Lower', tier_order: 1, slot_count: 4 },
      { tier_name: 'Middle', tier_order: 2, slot_count: 4 },
      { tier_name: 'Upper', tier_order: 3, slot_count: 3 },
    ],
  },
  N1: {
    dimensions: { length_cm: 550, width_cm: 200, height_cm: 210 },
    payload: { gross_weight_kg: 3500, max_payload_kg: 1200 },
    tiers: [
      { tier_name: 'Lower', tier_order: 1, slot_count: 5 },
      { tier_name: 'Middle', tier_order: 2, slot_count: 5 },
      { tier_name: 'Upper', tier_order: 3, slot_count: 4 },
    ],
  },

  // Trucks (4 tiers)
  N2: {
    dimensions: { length_cm: 750, width_cm: 250, height_cm: 280 },
    payload: { gross_weight_kg: 12000, max_payload_kg: 5000 },
    tiers: [
      { tier_name: 'Lower', tier_order: 1, slot_count: 6 },
      { tier_name: 'Middle', tier_order: 2, slot_count: 5 },
      { tier_name: 'Upper', tier_order: 3, slot_count: 4 },
      { tier_name: 'Top', tier_order: 4, slot_count: 3 },
    ],
  },
  N3: {
    dimensions: { length_cm: 1350, width_cm: 255, height_cm: 300 },
    payload: { gross_weight_kg: 40000, max_payload_kg: 25000 },
    tiers: [
      { tier_name: 'Lower', tier_order: 1, slot_count: 8 },
      { tier_name: 'Middle', tier_order: 2, slot_count: 7 },
      { tier_name: 'Upper', tier_order: 3, slot_count: 6 },
      { tier_name: 'Top', tier_order: 4, slot_count: 5 },
    ],
  },

  // RouteServe Shortcuts
  BIKO_MOPED: {
    dimensions: { length_cm: 180, width_cm: 70, height_cm: 110 },
    payload: { gross_weight_kg: 250, max_payload_kg: 100 },
    tiers: [
      { tier_name: 'Front Basket', tier_order: 1, slot_count: 5 }
    ],
  },
  BIKO_KEKE: {
    dimensions: { length_cm: 280, width_cm: 130, height_cm: 180 },
    payload: { gross_weight_kg: 600, max_payload_kg: 300 },
    tiers: [
      { tier_name: 'Cargo Area', tier_order: 1, slot_count: 8 }
    ],
  },
  BIKO_MINIVAN: {
    dimensions: { length_cm: 520, width_cm: 190, height_cm: 200 },
    payload: { gross_weight_kg: 3500, max_payload_kg: 900 },
    tiers: [
      { tier_name: 'Lower', tier_order: 1, slot_count: 5 },
      { tier_name: 'Upper', tier_order: 2, slot_count: 4 },
    ],
  },
  BIKO_COLDCHAIN: {
    dimensions: { length_cm: 550, width_cm: 200, height_cm: 220 },
    payload: { gross_weight_kg: 3500, max_payload_kg: 1000 },
    tiers: [
      { tier_name: 'Refrigerated Lower', tier_order: 1, slot_count: 5 },
      { tier_name: 'Refrigerated Upper', tier_order: 2, slot_count: 4 },
    ],
  },
};

export function getDefaultConfig(categoryCode: string): DefaultVehicleConfig | null {
  return DEFAULT_VEHICLE_CONFIGS[categoryCode] || null;
}
