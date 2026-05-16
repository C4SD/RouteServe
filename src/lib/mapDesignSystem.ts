/**
 * RouteServe Tactical Map V3 Design System
 *
 * Consistent design tokens for the tactical map interface
 * Inspired by Tesla, Uber, and Palantir design systems
 */

/**
 * Spacing Scale
 * Use consistent spacing throughout all map components
 */
export const SPACING = {
  xs: '8px',    // 0.5rem - Tight spacing
  sm: '12px',   // 0.75rem - Compact spacing
  md: '16px',   // 1rem - Standard spacing
  lg: '24px',   // 1.5rem - Generous spacing
  xl: '32px',   // 2rem - Large spacing
  '2xl': '48px' // 3rem - Extra large spacing
} as const;

/**
 * Border Radius
 * Consistent corner rounding for different element types
 */
export const RADIUS = {
  button: '9999px',  // rounded-full for icon buttons
  card: '12px',      // rounded-xl for cards and KPI displays
  panel: '16px',     // rounded-2xl for panels and drawers
  input: '8px',      // rounded-lg for form inputs
  tag: '6px',        // rounded-md for tags/badges
} as const;

/**
 * Glassmorphism Patterns
 * Backdrop blur + opacity for floating UI elements
 */
export const GLASS = {
  light: 'bg-background/70 backdrop-blur-lg border border-border/40',
  medium: 'bg-background/80 backdrop-blur-md border border-border/50',
  dark: 'bg-background/90 backdrop-blur-sm border border-border/60',
  card: 'bg-card/90 backdrop-blur-md border border-border/40',
} as const;

/**
 * Shadow Elevation
 * Consistent shadow styles for depth
 */
export const SHADOW = {
  subtle: 'shadow-sm',           // Minimal elevation
  soft: 'shadow-md',             // Standard elevation
  floating: 'shadow-lg',         // Floating elements
  drawer: 'shadow-xl',           // Drawers and panels
  dramatic: 'shadow-2xl',        // Modal overlays
} as const;

/**
 * Z-Index Layers
 * Consistent stacking order for all map elements
 */
export const Z_INDEX = {
  map: 0,                 // Base map layer
  mapControls: 900,       // KPIRibbon, PlaybackBar (float above map)
  toolbar: 1000,          // MapToolbarClusters
  floatingPanels: 1000,   // SearchPanel, LayersPanel (same level as toolbar)
  drawer: 1100,           // AnalyticsDrawer (above floating panels)
  modal: 1200,            // Dialogs and modals
  entityDrawer: 1300,     // DriverDrawer, VehicleDrawer, BatchDrawer
  toast: 9999,            // Toast notifications (always on top)
} as const;

/**
 * Icon Sizes
 * Consistent icon sizing
 */
export const ICON_SIZE = {
  xs: 14,   // Small icons
  sm: 16,   // Compact icons
  md: 18,   // Standard icons
  lg: 20,   // Large icons
  xl: 24,   // Extra large icons
} as const;

/**
 * Button Sizes
 * Consistent button dimensions
 */
export const BUTTON_SIZE = {
  icon: 'w-10 h-10',           // Standard icon button
  iconSm: 'w-8 h-8',           // Small icon button
  iconLg: 'w-12 h-12',         // Large icon button
} as const;

/**
 * Transitions
 * Consistent animation timing
 */
export const TRANSITION = {
  fast: 'transition-all duration-150 ease-in-out',
  normal: 'transition-all duration-300 ease-in-out',
  slow: 'transition-all duration-500 ease-in-out',
  drawer: 'transition-transform duration-300 ease-in-out',
} as const;

/**
 * Container Widths
 * Standard container sizes for consistency
 */
export const CONTAINER = {
  toolbar: 'w-16',           // Toolbar cluster container
  drawer: 'w-[480px]',       // Analytics drawer
  playback: 'max-w-3xl',     // Playback bar
  kpi: 'max-w-2xl',          // KPI ribbon
  panel: 'w-80',             // Floating panels (SearchPanel, LayersPanel)
} as const;

/**
 * Heights
 * Standard heights for horizontal bars
 */
export const HEIGHT = {
  topbar: 'h-16',            // OperationalContextBar
  filterBar: 'h-12',         // FilterBar
  playback: 'h-16',          // PlaybackBar
} as const;

/**
 * Map Control Button Classes
 * Pre-composed class strings for map control buttons
 */
export const MAP_BUTTON = {
  base: `${BUTTON_SIZE.icon} rounded-full flex items-center justify-center ${TRANSITION.fast}`,
  glass: `${BUTTON_SIZE.icon} rounded-full ${GLASS.card} flex items-center justify-center ${SHADOW.soft} ${TRANSITION.fast}`,
  active: 'bg-primary text-primary-foreground',
  inactive: 'hover:bg-muted/50',
} as const;

/**
 * Control Surface Tokens
 * Guaranteed contrast containers for map controls
 *
 * GOVERNANCE RULE:
 * - ALL map controls MUST sit on a solid surface
 * - Controls NEVER float directly over geospatial data
 * - Surfaces provide guaranteed contrast regardless of basemap
 */
export const CONTROL_SURFACE = {
  // Guaranteed contrast regardless of basemap
  solid: 'bg-background border border-border shadow-lg',
  glass: 'bg-background/95 backdrop-blur-md border border-border shadow-lg',

  // Semantic variants
  navigation: 'bg-card border border-border shadow-lg',
  tools: 'bg-card border border-border shadow-md',
  playback: 'bg-card/95 backdrop-blur-sm border border-border shadow-xl',
  kpi: 'bg-card/90 backdrop-blur-md border border-border shadow-soft',

  // Common properties
  padding: 'p-2',
  radius: 'rounded-xl',
  gap: 'gap-1',  // Between buttons
} as const;

/**
 * Icon State Tokens
 * Consistent state feedback for all interactive icons
 *
 * GOVERNANCE RULE:
 * - Default state: visible but not prominent
 * - Hover state: immediate visual feedback
 * - Active state: clearly distinct from default
 * - Disabled state: obviously non-interactive
 */
export const ICON_STATE = {
  default: 'text-foreground hover:text-primary hover:bg-accent/50 transition-colors',
  active: 'text-primary bg-primary/10 hover:bg-primary/20',
  disabled: 'text-muted-foreground opacity-50 cursor-not-allowed',
  alert: 'text-destructive bg-destructive/10',
} as const;

/**
 * Control Position Presets
 * Consistent absolute positioning for map controls
 */
export const CONTROL_POSITIONS = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-16 left-1/2 -translate-x-1/2',
} as const;

/**
 * Floating Panel Classes
 * Pre-composed class strings for floating panels
 */
export const FLOATING_PANEL = {
  base: `${GLASS.medium} ${SHADOW.floating} rounded-xl`,
  kpi: `${GLASS.light} ${SHADOW.soft} rounded-xl`,
  toolbar: `${GLASS.card} ${SHADOW.soft} rounded-lg`,
} as const;

/**
 * ------------------------------------------------------------------
 * MAPLIBRE MAP SYSTEM - DESIGN TOKENS
 * ------------------------------------------------------------------
 * Added for the RouteServe Map System Re-Foundation (Phase 1)
 * Following the product handover document specifications
 * ------------------------------------------------------------------
 */

/**
 * Zoom Level Breakpoints
 * Controls visibility of icons, labels, and clusters
 *
 * IMPORTANT: These breakpoints are STRICTLY enforced
 */
export const ZOOM_BREAKPOINTS = {
  /** Minimum zoom to show icons (< Z1 = clusters only) */
  Z1: 6,
  /** Minimum zoom to show labels (>= Z2 = marker + icon + label) */
  Z2: 12,
  /** Maximum zoom level */
  MAX: 19,
} as const;

/**
 * State Color Mappings
 * Colors encode STATE, never entity type
 *
 * GOVERNANCE RULE:
 * - Icons identify ENTITY CLASS (facility, vehicle, etc.)
 * - Colors encode STATE (risk, status, priority)
 * - These are SEPARATE concerns
 */
export const STATE_COLORS = {
  /** Risk Levels (for vehicles, batches, capacity) */
  risk: {
    low: '#10b981',      // < 60% capacity, on-time (green-500)
    medium: '#f59e0b',   // 60-90% capacity, minor delays (amber-500)
    high: '#ef4444',     // > 90% capacity, critical delays (red-500)
    critical: '#b91c1c', // Over capacity, SLA breach (red-700)
  },

  /** Status (for drivers, deliveries) */
  status: {
    available: '#10b981',  // green-500
    busy: '#f59e0b',       // amber-500
    offline: '#6b7280',    // gray-500
    completed: '#3b82f6',  // blue-500
  },

  /** Priority (for batches, alerts) */
  priority: {
    low: '#9ca3af',     // gray-400
    medium: '#3b82f6',  // blue-500
    high: '#f97316',    // orange-500
    urgent: '#dc2626',  // red-600
  },

  /** Batch Execution Status */
  batch: {
    planned: '#9ca3af',    // gray-400
    assigned: '#3b82f6',   // blue-500
    in_progress: '#f59e0b', // amber-500
    completed: '#10b981',  // green-500
    cancelled: '#f87171',  // red-400
  },

  /** Facility Types (healthcare-specific) */
  facility: {
    hospital: '#ef4444',   // red-500
    clinic: '#3b82f6',     // blue-500
    pharmacy: '#10b981',   // green-500
    health_center: '#a855f7', // purple-500
    lab: '#06b6d4',        // cyan-500
    other: '#6b7280',      // gray-500
  },
} as const;

/**
 * Operational Map Color Palette
 *
 * Dark mode palette for operational map (Black Emerald + Pumpkin accent)
 * Matches PRD requirements for vehicle-centric fleet management UI
 *
 * Usage: Reference these constants in MapLibre paint expressions and React components
 */
export const OPERATIONAL_COLORS = {
  // Surfaces
  bgPrimary: '#122220',      // Black Emerald
  bgSecondary: '#233d4d',    // Charcoal
  bgTertiary: '#313841',     // Panel/Card background

  // Accents
  accentPrimary: '#fe7f2d',  // Pumpkin (primary action color)
  accentSecondary: '#ea9216', // Yam (secondary action color)

  // Text
  textPrimary: '#eeeeee',    // Pebble (high contrast)
  textSecondary: 'rgba(238, 238, 238, 0.7)', // Medium emphasis
  textMuted: 'rgba(238, 238, 238, 0.5)',     // Low emphasis

  // Entity colors (operational context)
  vehicleActive: '#fe7f2d',   // Pumpkin - active moving vehicles
  routeActive: '#fe7f2d',     // Pumpkin - active routes
  warehouse: '#00ff9d',       // Teal - origin points
  facility: '#ea9216',        // Amber - destination points
  alertCritical: '#ff4d4f',   // Red - critical alerts

  // State-specific colors (MapLibre paint expressions)
  vehicle: {
    available: '#10b981',     // Green
    enRoute: '#fe7f2d',       // Pumpkin
    delayed: '#ff4d4f',       // Red
    delivering: '#3b82f6',    // Blue
    offline: '#6b7280',       // Gray
  },

  route: {
    active: '#fe7f2d',        // Pumpkin
    planned: '#6b7280',       // Gray
    completed: '#10b981',     // Green
  },
} as const;

/**
 * Marker Composition Patterns
 * Icons MUST be placed inside marker containers
 *
 * GOVERNANCE RULE:
 * - Marker container = state encoding (color, fill, badge)
 * - Icon = entity identification (monochrome, semantic)
 * - Never use icons standalone on map
 */
export const MARKER = {
  /** Base marker container (entity-rich representation) */
  container: 'rounded-full shadow-lg ring-2 ring-white/50',

  /** Marker sizes */
  size: {
    small: 'w-8 h-8',      // < 1rem - for high-density views
    medium: 'w-10 h-10',   // Default - most common
    large: 'w-12 h-12',    // Emphasized entities
    xlarge: 'w-16 h-16',   // Selected/focused entities
  },

  /** Icon inside marker (always monochrome) */
  icon: {
    container: 'flex items-center justify-center',
    color: 'text-white',   // Icons are always white for contrast
    size: {
      small: 'w-4 h-4',    // Inside small marker
      medium: 'w-5 h-5',   // Inside medium marker
      large: 'w-6 h-6',    // Inside large marker
      xlarge: 'w-8 h-8',   // Inside xlarge marker
    },
  },

  /** Padding between marker edge and icon */
  padding: {
    small: 'p-1',
    medium: 'p-1.5',
    large: 'p-2',
    xlarge: 'p-3',
  },

  /** Badge (secondary indicator, corner-positioned) */
  badge: {
    container: 'absolute -top-1 -right-1 rounded-full bg-white shadow-md',
    size: 'w-4 h-4',
    icon: 'w-3 h-3',
  },

  /** Animation states */
  animation: {
    pulse: 'animate-pulse',
    ping: 'animate-ping',
    bounce: 'animate-bounce',
  },

  /** Interaction states */
  state: {
    default: 'cursor-pointer hover:scale-110 transition-transform',
    selected: 'ring-4 ring-primary scale-110',
    disabled: 'opacity-50 cursor-not-allowed',
  },
} as const;

/**
 * Cluster Styles
 * Used when multiple markers are grouped together
 *
 * GOVERNANCE RULE:
 * - Show count prominently
 * - Color by dominant state
 * - Optional: small icon badge for dominant entity type
 * - Never show full icons inside clusters
 */
export const CLUSTER = {
  /** Cluster container */
  container: 'rounded-full shadow-xl ring-2 ring-white/50 flex items-center justify-center font-semibold',

  /** Cluster sizes (based on marker count) */
  size: {
    small: 'w-10 h-10 text-xs',    // 2-9 markers
    medium: 'w-12 h-12 text-sm',   // 10-99 markers
    large: 'w-16 h-16 text-base',  // 100+ markers
  },

  /** Cluster colors (same as state colors) */
  color: STATE_COLORS,

  /** Count display */
  count: {
    color: 'text-white',
    font: 'font-bold',
  },
} as const;

/**
 * Representation Modes
 * Toggle between minimal (geometric) and entity-rich (icons)
 *
 * GOVERNANCE RULE:
 * - Both modes show SAME data
 * - Only encoding changes (geometric vs semantic)
 * - Default depends on map mode:
 *   - Planning → Entity-Rich
 *   - Operational → Entity-Rich
 *   - Forensic → Minimal
 */
export const REPRESENTATION = {
  /** Minimal/Overview mode - geometric markers only */
  minimal: {
    marker: 'rounded-full',  // Simple circle
    noIcon: true,            // No icon inside
    strongCluster: true,     // Aggressive clustering
  },

  /** Entity-Rich/Operational mode - icons + orientation */
  entityRich: {
    marker: MARKER.container, // Full marker composition
    showIcon: true,           // Icon inside marker
    showLabel: true,          // Labels at high zoom
    showOrientation: true,    // Vehicle bearing rotation
  },
} as const;

/**
 * Map Layer Opacity
 * Controls visual hierarchy between layers
 */
export const LAYER_OPACITY = {
  basemap: 1.0,
  zones: 0.2,             // Very subtle background
  routes: 0.8,            // Visible but not dominant
  markers: 1.0,           // Fully opaque
  heatmap: 0.6,           // Transparent overlay
  selected: 1.0,          // Fully opaque when selected
} as const;

/**
 * Pre-composed Marker Classes
 * Ready-to-use marker compositions for common scenarios
 */
export const MARKER_PRESETS = {
  /** Standard entity marker (medium, entity-rich) */
  entity: `${MARKER.container} ${MARKER.size.medium} ${MARKER.padding.medium} ${MARKER.state.default}`,

  /** Selected entity marker */
  entitySelected: `${MARKER.container} ${MARKER.size.large} ${MARKER.padding.large} ${MARKER.state.selected}`,

  /** Small cluster marker */
  clusterSmall: `${CLUSTER.container} ${CLUSTER.size.small}`,

  /** Medium cluster marker */
  clusterMedium: `${CLUSTER.container} ${CLUSTER.size.medium}`,

  /** Large cluster marker */
  clusterLarge: `${CLUSTER.container} ${CLUSTER.size.large}`,

  /** Minimal geometric marker (no icon) */
  minimal: `rounded-full shadow-md ${MARKER.size.small} ${MARKER.state.default}`,
} as const;

/**
 * MapLibre-Specific Configuration
 * Settings for MapLibre GL JS layers
 */
export const MAPLIBRE_CONFIG = {
  /** Tile source configuration */
  tiles: {
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    maxZoom: ZOOM_BREAKPOINTS.MAX,
    antialias: true,
    preserveDrawingBuffer: true, // Required for map exports
  },

  /** Symbol layer defaults (for icons via sprites) */
  symbolLayer: {
    iconSize: 0.75,
    iconAllowOverlap: false,
    iconIgnorePlacement: false,
    textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
    textSize: 12,
    textOffset: [0, 1.5],
    textAnchor: 'top' as const,
  },

  /** Line layer defaults (for routes) */
  lineLayer: {
    lineWidth: 3,
    lineOpacity: LAYER_OPACITY.routes,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },

  /** Fill layer defaults (for zones) */
  fillLayer: {
    fillOpacity: LAYER_OPACITY.zones,
  },

  /** Circle layer defaults (for minimal representation) */
  circleLayer: {
    circleRadius: 6,
    circleOpacity: 1,
    circleStrokeWidth: 2,
    circleStrokeColor: '#ffffff',
  },
} as const;

/**
 * ------------------------------------------------------------------
 * PWA & OFFLINE FUNCTIONALITY - DESIGN TOKENS
 * ------------------------------------------------------------------
 * Added for Phase 3: PWA Infrastructure
 * Controls offline indicators, sync status, and connectivity UI
 * ------------------------------------------------------------------
 */

/**
 * Offline Indicator Styles
 * Visual feedback for network connectivity status
 */
export const OFFLINE_INDICATOR = {
  /** Container positioning */
  position: 'fixed top-4 left-1/2 -translate-x-1/2 z-toast',

  /** Online state */
  online: {
    container: 'bg-green-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2',
    icon: 'text-white',
    text: 'font-medium text-sm',
  },

  /** Offline state */
  offline: {
    container: 'bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2',
    icon: 'text-white',
    text: 'font-medium text-sm',
  },

  /** Syncing state */
  syncing: {
    container: 'bg-amber-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2',
    icon: 'text-white animate-spin',
    text: 'font-medium text-sm',
  },
} as const;

/**
 * Sync Queue Badge
 * Shows count of unsynced actions
 */
export const SYNC_BADGE = {
  container: 'absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center',
  pulse: 'animate-pulse',
  hidden: 'hidden',
} as const;

/**
 * Cache Status Indicators
 * Visual feedback for tile and data caching
 */
export const CACHE_STATUS = {
  /** Cached tile indicator (subtle green border) */
  cached: 'ring-2 ring-green-500/30',

  /** Loading tile indicator (pulsing animation) */
  loading: 'animate-pulse opacity-50',

  /** Failed tile indicator (red tint) */
  failed: 'opacity-30 grayscale',

  /** Cache storage gauge */
  gauge: {
    container: 'w-full h-2 bg-gray-200 rounded-full overflow-hidden',
    fill: {
      low: 'bg-green-500 h-full transition-all duration-300',      // < 50%
      medium: 'bg-amber-500 h-full transition-all duration-300',   // 50-80%
      high: 'bg-red-500 h-full transition-all duration-300',       // > 80%
    },
  },
} as const;

/**
 * PWA Install Prompt
 * Styling for install app banner
 */
export const INSTALL_PROMPT = {
  container: `${GLASS.card} border rounded-lg ${SHADOW.floating} p-4 max-w-md`,
  position: 'fixed bottom-4 right-4 z-floating',
  button: 'bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium',
  dismiss: 'text-muted-foreground hover:text-foreground',
} as const;

/**
 * Map State Indicators
 * Visual feedback for MapEngine state machine
 */
export const MAP_STATE = {
  /** INITIALIZING state */
  initializing: {
    overlay: 'absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-modal',
    spinner: 'animate-spin text-primary w-12 h-12',
    text: 'text-muted-foreground text-sm mt-4',
  },

  /** READY state (no indicator) */
  ready: {
    hidden: true,
  },

  /** DEGRADED state (subtle warning) */
  degraded: {
    indicator: 'absolute top-4 left-4 bg-amber-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-2',
    icon: 'w-4 h-4',
  },

  /** OFFLINE state (prominent warning) */
  offline: {
    indicator: 'absolute top-4 left-4 bg-red-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-2',
    icon: 'w-4 h-4',
  },

  /** ERROR state (critical warning) */
  error: {
    overlay: 'absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-modal',
    container: 'bg-card border border-destructive rounded-lg p-6 max-w-md shadow-xl',
    icon: 'text-destructive w-12 h-12 mb-4',
    title: 'text-lg font-semibold text-foreground mb-2',
    message: 'text-sm text-muted-foreground mb-4',
    button: 'bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium',
  },
} as const;

/**
 * Background Sync Progress
 * Visual feedback for action queue syncing
 */
export const SYNC_PROGRESS = {
  container: `${GLASS.card} border rounded-lg ${SHADOW.soft} p-3 min-w-[200px]`,
  position: 'fixed bottom-4 left-4 z-floating',

  /** Progress bar */
  bar: {
    container: 'w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-2',
    fill: 'bg-primary h-full transition-all duration-300',
  },

  /** Status text */
  text: {
    syncing: 'text-sm text-muted-foreground',
    success: 'text-sm text-green-600 font-medium',
    error: 'text-sm text-red-600 font-medium',
  },

  /** Icon states */
  icon: {
    syncing: 'text-primary animate-spin',
    success: 'text-green-600',
    error: 'text-red-600',
  },
} as const;

/**
 * Offline Action Badge
 * Shows pending action count on buttons
 */
export const OFFLINE_ACTION_BADGE = {
  container: 'absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-md',
  pulse: 'animate-pulse',
  success: 'bg-green-500',
  error: 'bg-red-500',
} as const;

/**
 * Legacy Design System (for backward compatibility)
 * TODO: Migrate all legacy usage to new V3 tokens
 */
export const MAP_DESIGN_SYSTEM = {
  layout: {
    fullscreen: 'h-screen w-full',
    embedded: 'h-[600px] w-full rounded-lg overflow-hidden',
    dashboard: 'h-[800px] w-full',

    toolbar: {
      position: 'absolute top-24 left-4 z-floating',
      buttonSize: BUTTON_SIZE.icon,
      gap: 'gap-2',
      container: `flex flex-col ${GLASS.card} rounded-lg ${SHADOW.soft} p-2`,
    },

    bottomPanel: {
      height: 'h-60',
      position: 'absolute bottom-0 left-0 right-0 z-floating',
      container: `${GLASS.dark} border-t ${SHADOW.soft}`,
    },

    sidePanel: {
      width: 'w-80 max-w-[90vw]',
      position: 'absolute right-4 top-4 bottom-4 z-floating',
      container: `${GLASS.medium} border rounded-lg ${SHADOW.floating}`,
    },

    overlay: {
      topRight: 'absolute top-4 right-4 z-floating',
      topLeft: 'absolute top-4 left-20 z-floating',
      bottomRight: 'absolute bottom-4 right-4 z-floating',
      bottomLeft: 'absolute bottom-4 left-4 z-floating',
      container: `${GLASS.card} border rounded-lg ${SHADOW.floating}`,
    },
  },

  styling: {
    controlButton: `rounded-lg ${GLASS.card} hover:bg-accent hover:text-accent-foreground ${TRANSITION.fast} ${SHADOW.subtle} border`,
    panel: `${GLASS.card} border rounded-lg ${SHADOW.floating}`,
    selectedMarker: 'ring-2 ring-primary ring-offset-2',
    floatingCard: `${GLASS.card} border rounded-lg ${SHADOW.floating}`,
  },

  interactions: {
    markerClick: 'click' as const,
    zoomOnSelect: true,
    autoFitBounds: true,
    doubleClickZoom: true,
    scrollWheelZoom: true,
  },

  widths: {
    sm: CONTAINER.panel,
    md: 'w-96',
    lg: 'w-[500px]',
    xl: 'w-[600px]',
  },

  components: {
    core: 'LeafletMapCore',
    toolbar: 'MapToolbarClusters',
    bottomPanel: 'PlaybackBar',
    searchPanel: 'SearchPanel',
    layersPanel: 'LayersPanel',
    legend: 'MapLegend',
    drawControls: 'DrawControls',
  },
} as const;

export type MapMode = 'fullscreen' | 'embedded' | 'dashboard';
export type OverlayPosition = 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';
