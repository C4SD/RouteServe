export type RouteCreationMode = 'facility_list' | 'upload' | 'sandbox' | 'service_policy';
export type RouteStatus = 'draft' | 'active' | 'locked' | 'archived';
export type OptimizationAlgorithm = 'NEAREST_NEIGHBOR' | 'TWO_OPT' | 'OSRM';

export interface RoutePolicyMetadata {
  service_policy_id: string;
  service_policy_name: string;
  cluster_id: string;
  cluster_code: string;
}

export interface Route {
  id: string;
  name: string;
  zone_id: string;
  service_area_id: string;
  warehouse_id: string;
  creation_mode: RouteCreationMode;
  status: RouteStatus;
  total_distance_km: number | null;
  estimated_duration_min: number | null;
  optimized_geometry: any | null;
  algorithm_used: string | null;
  is_sandbox: boolean;
  locked_at: string | null;
  locked_by: string | null;
  metadata: Record<string, any>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  zones?: { id: string; name: string } | null;
  service_areas?: { id: string; name: string } | null;
  warehouses?: { id: string; name: string; lat: number | null; lng: number | null } | null;
  facility_count?: number;
  // Computed from metadata for service_policy routes
  policy_metadata?: RoutePolicyMetadata | null;
}

export interface RouteFacility {
  id: string;
  route_id: string;
  facility_id: string;
  sequence_order: number;
  distance_from_previous_km: number | null;
  estimated_arrival_min: number | null;
  metadata: Record<string, any>;
  // Joined
  facilities?: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: string;
    level_of_care: string | null;
    lga: string | null;
  } | null;
}

// ─── Multi-Route Comparison Types ───

export interface ComparisonRoute {
  id: string;
  routeType: 'balanced' | 'short' | 'less_maneuvers';
  routeTypeLabel: string;
  algorithmLabel: string;
  color: string;
  distanceKm: number;
  timeMinutes: number;
  geometry: Array<[number, number]>;
  snappedWaypoints: Array<[number, number]>;
  facilityOrder: string[];
}

export interface CreateRouteInput {
  name: string;
  zone_id: string;
  service_area_id: string;
  warehouse_id: string;
  creation_mode: RouteCreationMode;
  facility_ids: string[];
  facility_distances?: (number | null)[];
  is_sandbox?: boolean;
  algorithm_used?: string;
  total_distance_km?: number;
  estimated_duration_min?: number;
  optimized_geometry?: any;
  metadata?: Record<string, any>;
}
