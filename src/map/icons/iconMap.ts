// src/map/icons/iconMap.ts

import {
  Hospital,
  Warehouse,
  Truck,
  Layers,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  WifiOff,
  CheckCircle2,
  Play,
  StopCircle,
  Shuffle,
  Navigation,
  Plus,
  Minus,
  RotateCcw,
  LocateFixed,
  Eye,
  Grid,
  SlidersHorizontal,
  CheckSquare,
  Package,
  GitCompare,
  Gauge,
  PlayCircle,
  PauseCircle,
  Clock3,
  Flame,
  Download,
  MapPin,
  User,
  Users,
  Route,
  Circle,
  Square,
  Triangle,
  XCircle,
  Zap,
  TrendingFlat,
} from "lucide-react";

/**
 * ------------------------------------------------------------------
 * ROUTESERVE MAP SYSTEM - CANONICAL ICON REGISTRY
 * ------------------------------------------------------------------
 *
 * GOVERNANCE RULES (STRICTLY ENFORCED):
 *
 * 1. Icons identify ENTITY CLASS ONLY
 *    - facility, warehouse, vehicle, batch, alert
 *
 * 2. Icons NEVER encode state
 *    - No color changes per status
 *    - No size changes per priority
 *    - State is encoded via marker container (color, fill, badge)
 *
 * 3. Icons are ALWAYS used inside marker containers
 *    - Icons are monochrome (white or muted)
 *    - Markers provide contrast and state encoding
 *
 * 4. Icons are imported ONLY from this file
 *    - Direct imports from lucide-react are FORBIDDEN
 *    - Enforced via ESLint rule (see .eslintrc.js)
 *
 * 5. Custom icons must follow lucide styling
 *    - Same stroke width (2px)
 *    - Same size constraints (24x24)
 *    - Monochrome only
 *
 * ------------------------------------------------------------------
 */

/**
 * ------------------------------------------------------------------
 * ICON TYPE DEFINITIONS
 * ------------------------------------------------------------------
 */

export type MapEntityIcon =
  | "facility"
  | "warehouse"
  | "vehicle"
  | "batch"
  | "alert"
  | "driver"
  | "waypoint";

export type MapStatusIcon =
  | "delayed"
  | "overCapacity"
  | "underUtilized"
  | "offline"
  | "completed"
  | "onTime"
  | "critical";

export type MapControlIcon =
  | "zoomIn"
  | "zoomOut"
  | "resetBearing"
  | "locate"
  | "layers"
  | "representationMinimal"
  | "representationEntity"
  | "filters";

export type PlanningIcon =
  | "selectFacility"
  | "batchGroup"
  | "scenarioCompare"
  | "capacityEstimate"
  | "measureDistance"
  | "drawZone";

export type OperationalIcon =
  | "tradeOff"
  | "approve"
  | "reject"
  | "capacity"
  | "eta"
  | "liveRoute";

export type ForensicIcon =
  | "playback"
  | "pause"
  | "timeline"
  | "heatmap"
  | "export";

export type GeometricIcon =
  | "circle"
  | "square"
  | "triangle"
  | "pin";

/**
 * ------------------------------------------------------------------
 * ICON MAP (CANONICAL)
 * ------------------------------------------------------------------
 */

export const iconMap = {
  /**
   * ENTITY ICONS
   * Used to identify entity class on map markers
   * - Always rendered inside marker containers
   * - Monochrome (white or muted)
   * - Never change based on state
   */
  entities: {
    facility: Hospital,
    warehouse: Warehouse,
    vehicle: Truck,
    batch: Layers,
    alert: AlertTriangle,
    driver: User,
    waypoint: MapPin,
  },

  /**
   * STATUS ICONS
   * Used as badges or secondary indicators
   * - Never used as primary marker icon
   * - Usually small, corner-positioned
   * - Indicate exception/state
   */
  status: {
    delayed: Clock,
    overCapacity: TrendingUp,
    underUtilized: TrendingDown,
    offline: WifiOff,
    completed: CheckCircle2,
    onTime: CheckCircle2,
    critical: Zap,
  },

  /**
   * ROUTING ICONS
   * Used for route visualization and controls
   */
  routing: {
    start: Play,
    end: StopCircle,
    reroute: Shuffle,
    navigate: Navigation,
    route: Route,
  },

  /**
   * MAP CONTROLS
   * Used in control buttons and toolbars
   */
  controls: {
    zoomIn: Plus,
    zoomOut: Minus,
    resetBearing: RotateCcw,
    locate: LocateFixed,
    layers: Layers,
    representationMinimal: Grid,
    representationEntity: Eye,
    filters: SlidersHorizontal,
  },

  /**
   * PLANNING MODE ICONS
   * Used in planning map tools and actions
   */
  planning: {
    selectFacility: CheckSquare,
    batchGroup: Package,
    scenarioCompare: GitCompare,
    capacityEstimate: Gauge,
    measureDistance: Navigation,
    drawZone: Square,
  },

  /**
   * OPERATIONAL MODE ICONS
   * Used in operational map for live execution
   */
  operational: {
    tradeOff: Shuffle,
    approve: CheckCircle2,
    reject: XCircle,
    capacity: Gauge,
    eta: Clock3,
    liveRoute: Route,
  },

  /**
   * FORENSIC MODE ICONS
   * Used in forensic map for historical analysis
   */
  forensic: {
    playback: PlayCircle,
    pause: PauseCircle,
    timeline: Clock3,
    heatmap: Flame,
    export: Download,
  },

  /**
   * GEOMETRIC ICONS
   * Used in minimal/overview representation
   * - Simple shapes without semantic meaning
   * - For high-density clustering
   */
  geometric: {
    circle: Circle,
    square: Square,
    triangle: Triangle,
    pin: MapPin,
  },
} as const;

/**
 * ------------------------------------------------------------------
 * HELPER TYPES
 * ------------------------------------------------------------------
 */

export type IconMap = typeof iconMap;
export type IconCategory = keyof IconMap;

/**
 * ------------------------------------------------------------------
 * SPRITE NAMING CONVENTION
 * ------------------------------------------------------------------
 *
 * When generating MapLibre sprites, use this naming pattern:
 *
 * Pattern: {domain}.{entity}.{variant}
 *
 * Examples:
 * - entity.facility
 * - entity.warehouse
 * - entity.vehicle
 * - badge.alert
 * - badge.delayed
 * - control.locate
 *
 * Domains:
 * - entity: Primary entity markers
 * - badge: Status/alert badges
 * - control: Map control buttons
 * - geometric: Simple shapes
 *
 * ------------------------------------------------------------------
 */

export const SPRITE_NAMING = {
  /**
   * Generate sprite name from icon category and key
   *
   * @param category - Icon category (entities, status, etc.)
   * @param key - Icon key within category
   * @returns Sprite name following convention
   *
   * @example
   * SPRITE_NAMING.generate('entities', 'facility') // => 'entity.facility'
   * SPRITE_NAMING.generate('status', 'delayed') // => 'badge.delayed'
   */
  generate: (category: IconCategory, key: string): string => {
    const domainMap: Record<IconCategory, string> = {
      entities: "entity",
      status: "badge",
      routing: "route",
      controls: "control",
      planning: "planning",
      operational: "operational",
      forensic: "forensic",
      geometric: "geometric",
    };

    const domain = domainMap[category] || category;
    return `${domain}.${key}`;
  },

  /**
   * Get all sprite names for sprite sheet generation
   *
   * @returns Array of all sprite names
   */
  getAllNames: (): string[] => {
    const names: string[] = [];

    (Object.keys(iconMap) as IconCategory[]).forEach((category) => {
      const categoryIcons = iconMap[category];
      Object.keys(categoryIcons).forEach((key) => {
        names.push(SPRITE_NAMING.generate(category, key));
      });
    });

    return names;
  },
} as const;

/**
 * ------------------------------------------------------------------
 * ZOOM-BASED VISIBILITY RULES
 * ------------------------------------------------------------------
 *
 * Icons are NOT always visible. Visibility depends on zoom level:
 *
 * | Zoom Level | Behavior                          |
 * |------------|-----------------------------------|
 * | < Z1 (6)   | Clusters only (no icons)          |
 * | Z1-Z2      | Marker + icon                     |
 * | >= Z2 (12) | Marker + icon + label             |
 *
 * This is enforced in MapLibre layer configuration.
 *
 * ------------------------------------------------------------------
 */

export const ZOOM_BREAKPOINTS = {
  Z1: 6,  // Minimum zoom to show icons
  Z2: 12, // Minimum zoom to show labels
} as const;

/**
 * ------------------------------------------------------------------
 * USAGE EXAMPLES
 * ------------------------------------------------------------------
 *
 * CORRECT USAGE:
 * ```tsx
 * import { iconMap } from '@/map/icons/iconMap';
 *
 * const FacilityIcon = iconMap.entities.facility;
 *
 * <div className="rounded-full bg-red-500 p-1.5">
 *   <FacilityIcon className="size-3.5 text-white" />
 * </div>
 * ```
 *
 * FORBIDDEN USAGE:
 * ```tsx
 * import { Hospital } from 'lucide-react'; // ❌ FORBIDDEN
 * ```
 *
 * ------------------------------------------------------------------
 */
