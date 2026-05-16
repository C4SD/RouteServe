/**
 * Unit Conversion Library for RouteServe
 *
 * Provides conversion utilities for weight, volume, and distance units
 * commonly used in logistics operations.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type WeightUnit = 'kg' | 'lbs' | 'tons' | 'g';
export type VolumeUnit = 'm3' | 'ft3' | 'liters' | 'gallons';
export type DistanceUnit = 'km' | 'mi' | 'm' | 'ft';

export interface UnitOption {
  value: string;
  label: string;
  conversion: number; // Conversion factor to base unit
}

// ============================================================================
// Conversion Constants
// ============================================================================

/**
 * Weight conversions (base unit: kg)
 */
export const WEIGHT_UNITS: Record<WeightUnit, UnitOption> = {
  kg: { value: 'kg', label: 'kg', conversion: 1 },
  lbs: { value: 'lbs', label: 'lbs', conversion: 2.20462 },
  tons: { value: 'tons', label: 'tons', conversion: 0.001 },
  g: { value: 'g', label: 'g', conversion: 1000 },
};

/**
 * Volume conversions (base unit: m³)
 */
export const VOLUME_UNITS: Record<VolumeUnit, UnitOption> = {
  m3: { value: 'm3', label: 'm³', conversion: 1 },
  ft3: { value: 'ft3', label: 'ft³', conversion: 35.3147 },
  liters: { value: 'liters', label: 'L', conversion: 1000 },
  gallons: { value: 'gallons', label: 'gal', conversion: 264.172 },
};

/**
 * Distance conversions (base unit: km)
 */
export const DISTANCE_UNITS: Record<DistanceUnit, UnitOption> = {
  km: { value: 'km', label: 'km', conversion: 1 },
  mi: { value: 'mi', label: 'mi', conversion: 0.621371 },
  m: { value: 'm', label: 'm', conversion: 1000 },
  ft: { value: 'ft', label: 'ft', conversion: 3280.84 },
};

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert weight between units
 * @param value - The value to convert
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted value
 */
export function convertWeight(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) return value;

  // Convert to base unit (kg)
  const baseValue = value / WEIGHT_UNITS[fromUnit].conversion;

  // Convert to target unit
  return baseValue * WEIGHT_UNITS[toUnit].conversion;
}

/**
 * Convert volume between units
 * @param value - The value to convert
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted value
 */
export function convertVolume(value: number, fromUnit: VolumeUnit, toUnit: VolumeUnit): number {
  if (fromUnit === toUnit) return value;

  // Convert to base unit (m³)
  const baseValue = value / VOLUME_UNITS[fromUnit].conversion;

  // Convert to target unit
  return baseValue * VOLUME_UNITS[toUnit].conversion;
}

/**
 * Convert distance between units
 * @param value - The value to convert
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted value
 */
export function convertDistance(value: number, fromUnit: DistanceUnit, toUnit: DistanceUnit): number {
  if (fromUnit === toUnit) return value;

  // Convert to base unit (km)
  const baseValue = value / DISTANCE_UNITS[fromUnit].conversion;

  // Convert to target unit
  return baseValue * DISTANCE_UNITS[toUnit].conversion;
}

/**
 * Format value with unit label
 * @param value - The value to format
 * @param unit - The unit type
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with unit
 */
export function formatWithUnit(
  value: number,
  unit: WeightUnit | VolumeUnit | DistanceUnit,
  decimals: number = 2
): string {
  const formatted = value.toFixed(decimals);
  const unitLabel =
    WEIGHT_UNITS[unit as WeightUnit]?.label ||
    VOLUME_UNITS[unit as VolumeUnit]?.label ||
    DISTANCE_UNITS[unit as DistanceUnit]?.label ||
    unit;

  return `${formatted} ${unitLabel}`;
}

/**
 * Get available unit options for a unit type
 * @param type - The unit type category
 * @returns Array of available unit options
 */
export function getUnitOptions(type: 'weight' | 'volume' | 'distance'): UnitOption[] {
  switch (type) {
    case 'weight':
      return Object.values(WEIGHT_UNITS);
    case 'volume':
      return Object.values(VOLUME_UNITS);
    case 'distance':
      return Object.values(DISTANCE_UNITS);
    default:
      return [];
  }
}

// ============================================================================
// User Preference Storage
// ============================================================================

const STORAGE_KEY = 'routeserve_unit_preferences';

export interface UnitPreferences {
  weight: WeightUnit;
  volume: VolumeUnit;
  distance: DistanceUnit;
}

/**
 * Get user's preferred units from localStorage
 * @returns User preferences or defaults
 */
export function getUserUnitPreferences(): UnitPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load unit preferences:', error);
  }

  // Default preferences (metric)
  return {
    weight: 'kg',
    volume: 'm3',
    distance: 'km',
  };
}

/**
 * Save user's preferred units to localStorage
 * @param preferences - Unit preferences to save
 */
export function saveUserUnitPreferences(preferences: Partial<UnitPreferences>): void {
  try {
    const current = getUserUnitPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save unit preferences:', error);
  }
}
