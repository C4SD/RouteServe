/**
 * =====================================================
 * Scheduler Utility Functions
 * =====================================================
 */

import type {
  SchedulerBatch,
  SchedulerBatchStatus,
  Zone,
  TimeWindow,
  Priority,
} from '@/types/scheduler';

// =====================================================
// STATUS HELPERS
// =====================================================

export function getStatusColor(status: SchedulerBatchStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700 border-gray-300';
    case 'ready':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'scheduled':
      return 'bg-indigo-100 text-indigo-700 border-indigo-300';
    case 'published':
      return 'bg-green-100 text-green-700 border-green-300';
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

export function getStatusLabel(status: SchedulerBatchStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'ready':
      return 'Ready for Dispatch';
    case 'scheduled':
      return 'Scheduled';
    case 'published':
      return 'Published';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

// =====================================================
// ZONE HELPERS
// =====================================================

export function getZoneColor(zone: Zone): string {
  switch (zone) {
    case 'North':
      return 'bg-blue-500';
    case 'South':
      return 'bg-green-500';
    case 'East':
      return 'bg-orange-500';
    case 'West':
      return 'bg-purple-500';
    case 'Central':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export function getZoneBorderColor(zone: Zone): string {
  switch (zone) {
    case 'North':
      return 'border-blue-500';
    case 'South':
      return 'border-green-500';
    case 'East':
      return 'border-orange-500';
    case 'West':
      return 'border-purple-500';
    case 'Central':
      return 'border-red-500';
    default:
      return 'border-gray-500';
  }
}

// =====================================================
// PRIORITY HELPERS
// =====================================================

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'low':
      return 'bg-gray-100 text-gray-700';
    case 'medium':
      return 'bg-blue-100 text-blue-700';
    case 'high':
      return 'bg-orange-100 text-orange-700';
    case 'urgent':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function getPriorityLabel(priority: Priority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

// =====================================================
// TIME WINDOW HELPERS
// =====================================================

export function getTimeWindowLabel(timeWindow: TimeWindow): string {
  switch (timeWindow) {
    case 'morning':
      return 'Morning (6am - 12pm)';
    case 'afternoon':
      return 'Afternoon (12pm - 6pm)';
    case 'evening':
      return 'Evening (6pm - 10pm)';
    case 'all_day':
      return 'All Day';
    default:
      return timeWindow;
  }
}

export function getTimeWindowShortLabel(timeWindow: TimeWindow): string {
  switch (timeWindow) {
    case 'morning':
      return 'AM';
    case 'afternoon':
      return 'PM';
    case 'evening':
      return 'EVE';
    case 'all_day':
      return 'All Day';
    default:
      return timeWindow;
  }
}

// =====================================================
// FORMATTING HELPERS
// =====================================================

/**
 * Format distance in kilometers
 */
export function formatDistance(km: number | null | undefined): string {
  if (!km) return '--';
  return `${km.toFixed(1)} km`;
}

/**
 * Format duration in minutes
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '--';

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Format capacity utilization percentage
 */
export function formatCapacity(pct: number | null | undefined): string {
  if (!pct) return '--';
  return `${Math.round(pct)}%`;
}

/**
 * Get capacity color based on utilization
 */
export function getCapacityColor(pct: number | null | undefined): string {
  if (!pct) return 'text-gray-500';

  if (pct < 50) return 'text-yellow-600'; // Under-utilized
  if (pct >= 50 && pct <= 90) return 'text-green-600'; // Optimal
  if (pct > 90 && pct <= 100) return 'text-orange-600'; // Near capacity
  return 'text-red-600'; // Over capacity
}

/**
 * Format date to human-readable string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date to long format
 */
export function formatDateLong(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Check if date is today
 */
export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in the past
 */
export function isPast(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
}

// =====================================================
// GEO HELPERS
// =====================================================

/**
 * Calculate distance between two lat/lng points using Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Average driving speed assumption in km/h for duration estimates */
const AVG_SPEED_KMH = 40;
/** Default service time per stop in minutes — overridden by workspace Waiting Time SLA when available */
export const DEFAULT_SERVICE_TIME_MIN = 15;

export interface RouteStopInfo {
  facility_id: string;
  facility_name: string;
  lga?: string;
  lat: number;
  lng: number;
  sequence: number;
  distance_from_prev_km: number;
  cumulative_distance_km: number;
  eta_minutes: number; // minutes from departure
}

/**
 * Compute route metrics from an ordered list of facility IDs.
 * Returns per-stop info plus totals.
 */
export function computeRouteMetrics(
  facilityIds: string[],
  facilityMap: Record<string, { name: string; lat: number; lng: number; lga?: string }>,
  startLocation?: { lat: number; lng: number } | null,
  waitingTimeMin: number = DEFAULT_SERVICE_TIME_MIN
): {
  stops: RouteStopInfo[];
  totalDistanceKm: number;
  estimatedDurationMin: number;
} {
  const stops: RouteStopInfo[] = [];
  let cumulativeDist = 0;
  let cumulativeTime = 0;

  for (let i = 0; i < facilityIds.length; i++) {
    const fid = facilityIds[i];
    const facility = facilityMap[fid];
    if (!facility || !facility.lat || !facility.lng) {
      stops.push({
        facility_id: fid,
        facility_name: facility?.name || 'Unknown',
        lga: facility?.lga,
        lat: facility?.lat || 0,
        lng: facility?.lng || 0,
        sequence: i + 1,
        distance_from_prev_km: 0,
        cumulative_distance_km: cumulativeDist,
        eta_minutes: cumulativeTime,
      });
      cumulativeTime += waitingTimeMin;
      continue;
    }

    let segmentDist = 0;
    if (i === 0 && startLocation?.lat && startLocation?.lng) {
      segmentDist = haversineDistance(startLocation.lat, startLocation.lng, facility.lat, facility.lng);
    } else if (i > 0) {
      const prev = facilityMap[facilityIds[i - 1]];
      if (prev?.lat && prev?.lng) {
        segmentDist = haversineDistance(prev.lat, prev.lng, facility.lat, facility.lng);
      }
    }

    // Road distance is typically ~1.3x straight-line distance
    segmentDist *= 1.3;
    cumulativeDist += segmentDist;
    const driveTime = (segmentDist / AVG_SPEED_KMH) * 60;
    cumulativeTime += driveTime;

    stops.push({
      facility_id: fid,
      facility_name: facility.name,
      lga: facility.lga,
      lat: facility.lat,
      lng: facility.lng,
      sequence: i + 1,
      distance_from_prev_km: segmentDist,
      cumulative_distance_km: cumulativeDist,
      eta_minutes: cumulativeTime,
    });

    cumulativeTime += SERVICE_TIME_MIN;
  }

  return {
    stops,
    totalDistanceKm: cumulativeDist,
    estimatedDurationMin: Math.round(cumulativeTime),
  };
}

// =====================================================
// BATCH HELPERS
// =====================================================

/**
 * Calculate total statistics for multiple batches
 */
export function calculateBatchTotals(batches: SchedulerBatch[]) {
  return batches.reduce(
    (acc, batch) => ({
      totalFacilities: acc.totalFacilities + (batch.facility_ids?.length || 0),
      totalConsignments: acc.totalConsignments + (batch.total_consignments || 0),
      totalDistance: acc.totalDistance + (batch.total_distance_km || 0),
      totalDuration: acc.totalDuration + (batch.estimated_duration_min || 0),
      avgCapacity:
        acc.avgCapacity + (batch.capacity_utilization_pct || 0) / batches.length,
    }),
    {
      totalFacilities: 0,
      totalConsignments: 0,
      totalDistance: 0,
      totalDuration: 0,
      avgCapacity: 0,
    }
  );
}

/**
 * Check if batch can be published
 */
export function canPublishBatch(batch: SchedulerBatch): boolean {
  return (
    batch.status === 'scheduled' &&
    !!batch.driver_id &&
    !!batch.vehicle_id &&
    batch.facility_ids.length > 0
  );
}

/**
 * Check if batch can be edited
 */
export function canEditBatch(batch: SchedulerBatch): boolean {
  return batch.status !== 'published' && batch.status !== 'cancelled';
}

/**
 * Check if batch can be cancelled
 */
export function canCancelBatch(batch: SchedulerBatch): boolean {
  return batch.status !== 'published' && batch.status !== 'cancelled';
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Validate batch has required fields for publishing
 */
export function validateBatchForPublish(batch: SchedulerBatch): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!batch.warehouse_id) {
    errors.push('Warehouse is required');
  }

  if (!batch.facility_ids || batch.facility_ids.length === 0) {
    errors.push('At least one facility is required');
  }

  if (!batch.driver_id) {
    errors.push('Driver is required');
  }

  if (!batch.vehicle_id) {
    errors.push('Vehicle is required');
  }

  if (!batch.planned_date) {
    errors.push('Planned date is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =====================================================
// SORTING & FILTERING
// =====================================================

/**
 * Sort batches by date (newest first)
 */
export function sortBatchesByDate(batches: SchedulerBatch[]): SchedulerBatch[] {
  return [...batches].sort((a, b) => {
    return new Date(b.planned_date).getTime() - new Date(a.planned_date).getTime();
  });
}

/**
 * Sort batches by priority
 */
export function sortBatchesByPriority(batches: SchedulerBatch[]): SchedulerBatch[] {
  const priorityOrder: Record<Priority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...batches].sort((a, b) => {
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Group batches by status
 */
export function groupBatchesByStatus(batches: SchedulerBatch[]): Record<SchedulerBatchStatus, SchedulerBatch[]> {
  return batches.reduce((acc, batch) => {
    if (!acc[batch.status]) {
      acc[batch.status] = [];
    }
    acc[batch.status].push(batch);
    return acc;
  }, {} as Record<SchedulerBatchStatus, SchedulerBatch[]>);
}

/**
 * Group batches by zone
 */
export function groupBatchesByZone(batches: SchedulerBatch[]): Record<string, SchedulerBatch[]> {
  return batches.reduce((acc, batch) => {
    const zone = batch.zone || 'Unassigned';
    if (!acc[zone]) {
      acc[zone] = [];
    }
    acc[zone].push(batch);
    return acc;
  }, {} as Record<string, SchedulerBatch[]>);
}

// =====================================================
// EXPORT HELPERS
// =====================================================

/**
 * Generate CSV data from batches
 */
export function generateBatchCSV(batches: SchedulerBatch[]): string {
  const headers = [
    'Batch Code',
    'Name',
    'Status',
    'Warehouse',
    'Facilities',
    'Driver',
    'Vehicle',
    'Planned Date',
    'Time Window',
    'Distance (km)',
    'Duration (min)',
    'Capacity (%)',
    'Priority',
    'Zone',
  ].join(',');

  const rows = batches.map((batch) =>
    [
      batch.batch_code,
      batch.name || '',
      batch.status,
      batch.warehouse_id,
      batch.facility_ids.length,
      batch.driver_id || '',
      batch.vehicle_id || '',
      batch.planned_date,
      batch.time_window || '',
      batch.total_distance_km || '',
      batch.estimated_duration_min || '',
      batch.capacity_utilization_pct || '',
      batch.priority,
      batch.zone || '',
    ].join(',')
  );

  return [headers, ...rows].join('\n');
}
