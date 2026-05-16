/**
 * Phosphor Icons Map for RouteServe Operational Map
 *
 * Governance Rules:
 * 1. Icons identify ENTITY CLASS only (never state)
 * 2. Icons are monochrome (use currentColor for theming)
 * 3. Circular containers ONLY for moving entities (vehicles, drivers)
 * 4. Static infrastructure (warehouses, facilities) use standalone icons
 * 5. Colors encode state via MapLibre paint expressions, not icon choice
 *
 * Grid Spec:
 * - Artboard: 256×256
 * - Inner icon: 160×160 (48px padding each side)
 * - Safe rotation radius: 128px
 *
 * Note: Using simplified placeholder icons. These will render as circles with labels
 * until proper Phosphor icons SVG paths are implemented.
 */

// For now, we'll use a simple placeholder system
// The sprite generation script will create visual placeholders

/**
 * Phosphor Icon Map
 *
 * Naming Convention: {domain}.{entity}.{variant}
 * - domain: entity | badge | state | route | control
 * - entity: vehicle | driver | warehouse | facility | waypoint
 * - variant: truck | van | etc.
 */
export const PHOSPHOR_ICON_MAP = {
  // Entity icons - Moving objects (circular containers)
  'entity.vehicle.truck': 'truck',
  'entity.vehicle.van': 'car',
  'entity.driver': 'user',

  // Entity icons - Static infrastructure (no containers)
  'entity.warehouse': 'warehouse',
  'entity.facility': 'first-aid',
  'entity.facility.generic': 'buildings',
  'entity.waypoint': 'map-pin',

  // Status badges (overlay indicators)
  'badge.delayed': 'clock',
  'badge.over_capacity': 'trend-up',
  'badge.under_utilized': 'trend-down',
  'badge.offline': 'wifi-slash',
  'badge.completed': 'check-circle',

  // Alert state icons
  'state.alert.breakdown': 'x',
  'state.alert.delay': 'clock',
  'state.alert.critical': 'warning',
  'state.alert.fuel': 'gas-pump',

  // Route indicators
  'route.arrow': 'arrow-right',
  'route.waypoint': 'map-pin',

  // Control icons (for UI controls)
  'control.locate': 'navigation',
  'control.layers': 'stack',
  'control.recenter': 'crosshair',
  'control.batches': 'package',
} as const;

/**
 * Type for Phosphor sprite names
 */
export type PhosphorSpriteName = keyof typeof PHOSPHOR_ICON_MAP;

/**
 * Entities that should have circular backgrounds
 * (moving objects only)
 */
export const CIRCULAR_ENTITIES = new Set<PhosphorSpriteName>([
  'entity.vehicle.truck',
  'entity.vehicle.van',
  'entity.driver',
]);

/**
 * Check if an entity should have a circular background
 */
export function hasCircularBackground(spriteName: PhosphorSpriteName): boolean {
  return CIRCULAR_ENTITIES.has(spriteName);
}

/**
 * Get the Phosphor icon identifier for a sprite name
 */
export function getPhosphorIcon(spriteName: PhosphorSpriteName) {
  return PHOSPHOR_ICON_MAP[spriteName];
}

/**
 * Get all sprite names
 */
export function getAllSpriteNames(): PhosphorSpriteName[] {
  return Object.keys(PHOSPHOR_ICON_MAP) as PhosphorSpriteName[];
}
