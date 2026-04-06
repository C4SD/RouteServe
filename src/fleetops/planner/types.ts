/**
 * =====================================================
 * FLEETOPS PLANNER TYPES
 * =====================================================
 *
 * Types for route and vehicle planning.
 */

import type { BatchHandoffContract } from '@/storefront/batch';

/**
 * Route point in optimized route.
 */
export interface RoutePoint {
  lat: number;
  lng: number;
  facility_id: string;
  sequence: number;
  eta?: string;
  distance_from_previous_km?: number;
}

/**
 * Optimized route output.
 */
export interface OptimizedRoute {
  route_id: string;
  batch_id: string;
  points: RoutePoint[];
  total_distance_km: number;
  estimated_duration_min: number;
  optimization_method: 'nearest-neighbor' | 'genetic' | 'manual';
  created_at: string;
}

/**
 * Vehicle assignment.
 */
export interface VehicleAssignment {
  batch_id: string;
  vehicle_id: string;
  driver_id?: string;
  assigned_at: string;
  assigned_by?: string;
  slot_utilization_pct: number;
  weight_utilization_pct: number;
  volume_utilization_pct: number;
}

/**
 * Executable plan - final output of FleetOps planner.
 */
export interface ExecutablePlan {
  plan_id: string;
  batch_id: string;
  route: OptimizedRoute;
  vehicle_assignment: VehicleAssignment;
  slot_snapshot: BatchHandoffContract['slot_snapshot'];
  facilities: string[];
  created_at: string;
  status: 'ready' | 'dispatched' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Route optimization request.
 */
export interface RouteOptimizationRequest {
  batch_id: string;
  facility_locations: Array<{
    facility_id: string;
    lat: number;
    lng: number;
  }>;
  warehouse_location: {
    lat: number;
    lng: number;
  };
  optimization_method?: 'nearest-neighbor' | 'genetic' | 'manual';
}

/**
 * Vehicle assignment request.
 */
export interface VehicleAssignmentRequest {
  batch_id: string;
  vehicle_id: string;
  driver_id?: string;
  slot_demand: number;
  total_weight_kg?: number;
  total_volume_m3?: number;
}

// =====================================================
// VEHICLE PLAN (single vs multi-vehicle recommendation)
// =====================================================

/**
 * Recommendation to cover the entire batch with one vehicle.
 * score: 0–100, where 100 = perfect 80% utilization across all dimensions.
 */
export interface SingleVehiclePlan {
  type: 'single';
  vehicle_id: string;
  score: number;
  slot_utilization_pct: number;
  weight_utilization_pct: number;
  volume_utilization_pct: number;
  reason: string;
}

/**
 * One vehicle's share in a multi-vehicle plan.
 */
export interface MultiVehicleSegment {
  vehicle_id: string;
  facility_ids: string[];
  slot_utilization_pct: number;
  score: number;
}

/**
 * Recommendation to split the batch across multiple vehicles.
 * total_score: average segment score.
 */
export interface MultiVehiclePlan {
  type: 'multi';
  segments: MultiVehicleSegment[];
  vehicles_needed: number;
  total_score: number;
  reason: string;
}

export type VehiclePlan = SingleVehiclePlan | MultiVehiclePlan;
