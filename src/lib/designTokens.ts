/**
 * RouteServe Design System - Color Token Mapping Utility
 *
 * This utility provides semantic color mappings to replace hardcoded Tailwind colors
 * throughout the application. All status, priority, and state-based colors should
 * use these token mappings for consistent theming and dark mode support.
 *
 * Usage:
 * ```tsx
 * import { getStatusColors, getPriorityColors } from '@/lib/designTokens';
 *
 * const colors = getStatusColors('urgent');
 * <div className={colors.bg}>
 *   <span className={colors.text}>Urgent</span>
 * </div>
 * ```
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type StatusType =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'in_progress'
  | 'error'
  | 'warning'
  | 'success'
  | 'info';

export type PriorityType =
  | 'urgent'
  | 'high'
  | 'medium'
  | 'low';

export type VehicleStateType =
  | 'available'
  | 'in_use'
  | 'in-use'
  | 'maintenance'
  | 'out_of_service'
  | 'disposed';

export type DeliveryStatusType =
  | 'scheduled'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'returned';

export interface ColorClasses {
  bg: string;
  text: string;
  border: string;
  hover?: string;
}

// ============================================================================
// Status Color Mappings
// ============================================================================

const statusColorMap: Record<StatusType, ColorClasses> = {
  active: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    hover: 'hover:bg-success/20',
  },
  inactive: {
    bg: 'bg-muted/30',
    text: 'text-muted-foreground',
    border: 'border-muted/50',
    hover: 'hover:bg-muted/50',
  },
  pending: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    hover: 'hover:bg-warning/20',
  },
  completed: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    hover: 'hover:bg-success/20',
  },
  cancelled: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    hover: 'hover:bg-destructive/20',
  },
  in_progress: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    hover: 'hover:bg-primary/20',
  },
  error: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    hover: 'hover:bg-destructive/20',
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    hover: 'hover:bg-warning/20',
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    hover: 'hover:bg-success/20',
  },
  info: {
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/20',
    hover: 'hover:bg-info/20',
  },
};

// ============================================================================
// Priority Color Mappings
// ============================================================================

const priorityColorMap: Record<PriorityType, ColorClasses> = {
  urgent: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    hover: 'hover:bg-destructive/20',
  },
  high: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    hover: 'hover:bg-warning/20',
  },
  medium: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    hover: 'hover:bg-primary/20',
  },
  low: {
    bg: 'bg-muted/30',
    text: 'text-muted-foreground',
    border: 'border-muted/50',
    hover: 'hover:bg-muted/50',
  },
};

// ============================================================================
// Vehicle State Color Mappings
// ============================================================================

const vehicleStateColorMap: Record<VehicleStateType, ColorClasses> = {
  available: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    hover: 'hover:bg-success/20',
  },
  in_use: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    hover: 'hover:bg-primary/20',
  },
  'in-use': {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    hover: 'hover:bg-primary/20',
  },
  maintenance: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    hover: 'hover:bg-warning/20',
  },
  out_of_service: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    hover: 'hover:bg-destructive/20',
  },
  disposed: {
    bg: 'bg-muted/30',
    text: 'text-muted-foreground',
    border: 'border-muted/50',
    hover: 'hover:bg-muted/50',
  },
};

// ============================================================================
// Delivery Status Color Mappings
// ============================================================================

const deliveryStatusColorMap: Record<DeliveryStatusType, ColorClasses> = {
  scheduled: {
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/20',
    hover: 'hover:bg-info/20',
  },
  in_transit: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    hover: 'hover:bg-primary/20',
  },
  delivered: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    hover: 'hover:bg-success/20',
  },
  failed: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    hover: 'hover:bg-destructive/20',
  },
  returned: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    hover: 'hover:bg-warning/20',
  },
};

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Get semantic color classes for a given status
 * @param status - The status type
 * @returns ColorClasses object with bg, text, border, and hover classes
 */
export function getStatusColors(status: StatusType): ColorClasses {
  return statusColorMap[status] || statusColorMap.inactive;
}

/**
 * Get semantic color classes for a given priority level
 * @param priority - The priority type
 * @returns ColorClasses object with bg, text, border, and hover classes
 */
export function getPriorityColors(priority: PriorityType): ColorClasses {
  return priorityColorMap[priority] || priorityColorMap.low;
}

/**
 * Get semantic color classes for a given vehicle state
 * @param state - The vehicle state type
 * @returns ColorClasses object with bg, text, border, and hover classes
 */
export function getVehicleStateColors(state: VehicleStateType): ColorClasses {
  return vehicleStateColorMap[state] || vehicleStateColorMap.available;
}

/**
 * Get semantic color classes for a given delivery status
 * @param status - The delivery status type
 * @returns ColorClasses object with bg, text, border, and hover classes
 */
export function getDeliveryStatusColors(status: DeliveryStatusType): ColorClasses {
  return deliveryStatusColorMap[status] || deliveryStatusColorMap.scheduled;
}

/**
 * Utility function to combine color classes into a single className string
 * @param colors - ColorClasses object
 * @param includeHover - Whether to include hover classes (default: true)
 * @returns Combined className string
 */
export function combineColorClasses(colors: ColorClasses, includeHover = true): string {
  const classes = [colors.bg, colors.text, colors.border];
  if (includeHover && colors.hover) {
    classes.push(colors.hover);
  }
  return classes.join(' ');
}

/**
 * Get Badge variant name from status type
 * Maps status types to Badge component variant prop
 */
export function getBadgeVariant(status: StatusType): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'active':
    case 'completed':
    case 'success':
      return 'success';
    case 'error':
    case 'cancelled':
      return 'destructive';
    case 'warning':
    case 'pending':
      return 'warning';
    case 'info':
    case 'in_progress':
      return 'info';
    case 'inactive':
      return 'secondary';
    default:
      return 'default';
  }
}

/**
 * Get Alert variant name from status type
 * Maps status types to Alert component variant prop
 */
export function getAlertVariant(status: StatusType): 'default' | 'destructive' | 'success' | 'warning' | 'info' {
  switch (status) {
    case 'error':
    case 'cancelled':
      return 'destructive';
    case 'success':
    case 'active':
    case 'completed':
      return 'success';
    case 'warning':
    case 'pending':
      return 'warning';
    case 'info':
    case 'in_progress':
      return 'info';
    default:
      return 'default';
  }
}

// ============================================================================
// Legacy Color Migration Helpers
// ============================================================================

/**
 * Map legacy hardcoded colors to semantic tokens
 * Use this to identify and replace hardcoded Tailwind colors
 */
export const legacyColorMigrationMap = {
  // Green (success)
  'bg-green-100': 'bg-success/10',
  'bg-green-500': 'bg-success',
  'text-green-600': 'text-success',
  'text-green-700': 'text-success',
  'border-green-200': 'border-success/20',

  // Red (destructive)
  'bg-red-100': 'bg-destructive/10',
  'bg-red-500': 'bg-destructive',
  'text-red-500': 'text-destructive',
  'text-red-600': 'text-destructive',
  'border-red-200': 'border-destructive/20',

  // Yellow/Amber (warning)
  'bg-yellow-100': 'bg-warning/10',
  'bg-amber-500': 'bg-warning',
  'text-yellow-600': 'text-warning',
  'text-amber-600': 'text-warning',
  'border-yellow-200': 'border-warning/20',

  // Blue (primary/info)
  'bg-blue-100': 'bg-primary/10',
  'bg-blue-500': 'bg-primary',
  'text-blue-600': 'text-primary',
  'border-blue-200': 'border-primary/20',

  // Gray (muted)
  'bg-gray-100': 'bg-muted/30',
  'bg-gray-500': 'bg-muted',
  'text-gray-400': 'text-muted-foreground/60',
  'text-gray-500': 'text-muted-foreground',
  'text-gray-600': 'text-muted-foreground',
  'border-gray-200': 'border-muted/50',
} as const;

/**
 * Get the semantic token replacement for a legacy color class
 * @param legacyColor - The legacy Tailwind color class (e.g., 'bg-green-100')
 * @returns The semantic token replacement or the original if no mapping exists
 */
export function migrateLegacyColor(legacyColor: string): string {
  return legacyColorMigrationMap[legacyColor as keyof typeof legacyColorMigrationMap] || legacyColor;
}
