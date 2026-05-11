/**
 * Phase 2: Analytics Backend - Ticket A6
 * Supabase RPC Wrappers for Analytics Functions
 *
 * Purpose: Type-safe API layer for querying analytics materialized views
 * Performance: All queries target < 100ms (server-side pre-aggregated data)
 *
 * IMPORTANT: This file contains READ-ONLY functions.
 * All analytics logic resides in the database (A5 functions).
 * NO client-side aggregation allowed.
 */

import { supabase } from './client';
import type {
  StockStatus,
  StockBalance,
  StockPerformance,
  StockByZone,
  LowStockAlert,
  VehiclePayloadUtilization,
  ProgramPerformance,
  DriverUtilization,
  RouteEfficiency,
  FacilityCoverage,
  CostByProgram,
} from '@/types';

// ============================================================================
// TYPES - Analytics Function Response Types
// ============================================================================

export interface DeliveryKPIs {
  total_batches: number;
  completed_batches: number;
  on_time_batches: number;
  late_batches: number;
  on_time_rate: number;
  avg_completion_time_hours: number;
  total_items_delivered: number;
  total_distance_km: number;
}

export interface TopVehiclePerformance {
  vehicle_id: string;
  vehicle_number: string;
  vehicle_type: string;
  on_time_batches: number;
  total_batches: number;
  on_time_rate: number;
}

export interface DriverKPIs {
  total_drivers: number;
  active_drivers: number;
  avg_on_time_rate: number;
  avg_fuel_efficiency: number;
  total_incidents: number;
}

export interface TopDriverPerformance {
  driver_id: string;
  driver_name: string;
  on_time_rate: number;
  completed_batches: number;
  total_items_delivered: number;
  fuel_efficiency_km_per_liter: number;
  total_incidents: number;
}

export interface VehicleKPIs {
  total_vehicles: number;
  active_vehicles: number;
  in_maintenance: number;
  avg_utilization_rate: number;
  avg_fuel_efficiency: number;
  total_maintenance_cost: number;
}

export interface VehicleMaintenanceNeeded {
  vehicle_id: string;
  plate_number: string;
  vehicle_type: string;
  total_distance_km: number;
  last_maintenance_date: string | null;
  maintenance_in_progress: number;
  total_maintenance_cost: number;
}

export interface CostKPIs {
  total_system_cost: number;
  total_maintenance_cost: number;
  total_fuel_cost: number;
  avg_cost_per_item: number;
  avg_cost_per_km: number;
  active_vehicles: number;
  active_drivers: number;
  total_items_delivered: number;
}

export interface VehicleCostBreakdown {
  vehicle_id: string;
  total_cost: number;
  maintenance_cost: number;
  fuel_cost: number;
  fuel_consumed_liters: number;
  maintenance_events: number;
}

export interface DriverCostBreakdown {
  driver_id: string;
  total_cost: number;
  fuel_cost: number;
  operational_cost: number;
  items_delivered: number;
  distance_covered: number;
  cost_per_item: number;
}

export interface DashboardSummary {
  total_deliveries: number;
  on_time_rate: number;
  avg_completion_hours: number;
  total_items: number;
  active_vehicles: number;
  vehicle_utilization_rate: number;
  vehicles_in_maintenance: number;
  active_drivers: number;
  driver_on_time_rate: number;
  total_incidents: number;
  total_cost: number;
  cost_per_item: number;
  cost_per_km: number;
}

// ============================================================================
// API ERROR HANDLING
// ============================================================================

export class AnalyticsAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AnalyticsAPIError';
  }
}

function handleSupabaseError(error: unknown, functionName: string): never {
  if (error && typeof error === 'object' && 'message' in error) {
    throw new AnalyticsAPIError(
      `Analytics API error in ${functionName}: ${error.message}`,
      'code' in error ? String(error.code) : undefined,
      error
    );
  }
  throw new AnalyticsAPIError(`Unknown error in ${functionName}`, undefined, error);
}

// ============================================================================
// 1. DELIVERY PERFORMANCE API
// ============================================================================

/**
 * Get delivery performance KPIs for a date range
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @returns Delivery performance metrics
 */
export async function getDeliveryKPIs(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<DeliveryKPIs> {
  const { data, error } = await supabase.rpc('get_delivery_kpis', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getDeliveryKPIs');
  if (!data || data.length === 0) {
    throw new AnalyticsAPIError('No delivery KPIs data returned');
  }

  return data[0] as DeliveryKPIs;
}

/**
 * Get top performing vehicles by on-time delivery rate
 * @param workspaceId - Workspace to filter by
 * @param limit - Number of results to return (default: 10)
 * @returns Array of top vehicles sorted by on-time rate
 */
export async function getTopVehiclesByOnTime(
  workspaceId: string,
  limit: number = 10
): Promise<TopVehiclePerformance[]> {
  const { data, error } = await supabase.rpc('get_top_vehicles_by_ontime', {
    workspace_id: workspaceId,
    limit_count: limit,
  });

  if (error) handleSupabaseError(error, 'getTopVehiclesByOnTime');
  return (data || []) as TopVehiclePerformance[];
}

// ============================================================================
// 2. DRIVER EFFICIENCY API
// ============================================================================

/**
 * Get overall driver efficiency KPIs
 * @param workspaceId - Workspace to filter by
 * @returns Driver efficiency metrics
 */
export async function getDriverKPIs(workspaceId: string): Promise<DriverKPIs> {
  const { data, error } = await supabase.rpc('get_driver_kpis', {
    workspace_id: workspaceId,
  });

  if (error) handleSupabaseError(error, 'getDriverKPIs');
  if (!data || data.length === 0) {
    throw new AnalyticsAPIError('No driver KPIs data returned');
  }

  return data[0] as DriverKPIs;
}

/**
 * Get top performing drivers by specified metric
 * @param metric - Metric to sort by: 'on_time_rate', 'fuel_efficiency', or 'deliveries'
 * @param limit - Number of results to return (default: 10)
 * @returns Array of top drivers sorted by metric
 */
export async function getTopDrivers(
  workspaceId: string,
  metric: 'on_time_rate' | 'fuel_efficiency' | 'deliveries' = 'on_time_rate',
  limit: number = 10
): Promise<TopDriverPerformance[]> {
  const { data, error } = await supabase.rpc('get_top_drivers', {
    workspace_id: workspaceId,
    metric,
    limit_count: limit,
  });

  if (error) handleSupabaseError(error, 'getTopDrivers');
  return (data || []) as TopDriverPerformance[];
}

// ============================================================================
// 3. VEHICLE UTILIZATION API
// ============================================================================

export async function getVehicleKPIs(workspaceId: string): Promise<VehicleKPIs> {
  const { data, error } = await supabase.rpc('get_vehicle_kpis', {
    workspace_id: workspaceId,
  });

  if (error) handleSupabaseError(error, 'getVehicleKPIs');
  if (!data || data.length === 0) {
    throw new AnalyticsAPIError('No vehicle KPIs data returned');
  }

  return data[0] as VehicleKPIs;
}

export async function getVehiclesNeedingMaintenance(workspaceId: string): Promise<VehicleMaintenanceNeeded[]> {
  const { data, error } = await supabase.rpc('get_vehicles_needing_maintenance', {
    workspace_id: workspaceId,
  });

  if (error) handleSupabaseError(error, 'getVehiclesNeedingMaintenance');
  return (data || []) as VehicleMaintenanceNeeded[];
}

// ============================================================================
// 4. COST ANALYSIS API
// ============================================================================

export async function getCostKPIs(workspaceId: string): Promise<CostKPIs> {
  const { data, error } = await supabase.rpc('get_cost_kpis', {
    workspace_id: workspaceId,
  });

  if (error) handleSupabaseError(error, 'getCostKPIs');
  if (!data || data.length === 0) {
    throw new AnalyticsAPIError('No cost KPIs data returned');
  }

  return data[0] as CostKPIs;
}

export async function getVehicleCosts(workspaceId: string, limit: number = 10): Promise<VehicleCostBreakdown[]> {
  const { data, error } = await supabase.rpc('get_vehicle_costs', {
    workspace_id: workspaceId,
    limit_count: limit,
  });

  if (error) handleSupabaseError(error, 'getVehicleCosts');
  return (data || []) as VehicleCostBreakdown[];
}

export async function getDriverCosts(workspaceId: string, limit: number = 10): Promise<DriverCostBreakdown[]> {
  const { data, error } = await supabase.rpc('get_driver_costs', {
    workspace_id: workspaceId,
    limit_count: limit,
  });

  if (error) handleSupabaseError(error, 'getDriverCosts');
  return (data || []) as DriverCostBreakdown[];
}

// ============================================================================
// 5. DASHBOARD SUMMARY API
// ============================================================================

/**
 * Get complete dashboard summary (all KPIs in one call)
 * @param startDate - Optional start date for delivery metrics (YYYY-MM-DD)
 * @param endDate - Optional end date for delivery metrics (YYYY-MM-DD)
 * @returns Complete dashboard summary
 */
export async function getDashboardSummary(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getDashboardSummary');
  if (!data || data.length === 0) {
    throw new AnalyticsAPIError('No dashboard summary data returned');
  }

  const result = data[0];
  
  // Convert BIGINT and NUMERIC values to proper JavaScript numbers
  return {
    total_deliveries: Number(result.total_deliveries) || 0,
    on_time_rate: Number(result.on_time_rate) || 0,
    avg_completion_hours: Number(result.avg_completion_hours) || 0,
    total_items: Number(result.total_items) || 0,
    active_vehicles: Number(result.active_vehicles) || 0,
    vehicle_utilization_rate: Number(result.vehicle_utilization_rate) || 0,
    vehicles_in_maintenance: Number(result.vehicles_in_maintenance) || 0,
    active_drivers: Number(result.active_drivers) || 0,
    driver_on_time_rate: Number(result.driver_on_time_rate) || 0,
    total_incidents: Number(result.total_incidents) || 0,
    total_cost: Number(result.total_cost) || 0,
    cost_per_item: Number(result.cost_per_item) || 0,
    cost_per_km: Number(result.cost_per_km) || 0,
  };
}

// ============================================================================
// 6. STOCK ANALYTICS API
// ============================================================================

/**
 * Get overall stock status metrics
 * @returns Stock status including total products, facilities, items, and alerts
 */
export async function getStockStatus(workspaceId: string): Promise<StockStatus> {
  const { data, error } = await supabase.rpc('get_stock_status', { workspace_id: workspaceId });

  if (error) handleSupabaseError(error, 'getStockStatus');
  if (!data || data.length === 0) {
    throw new AnalyticsAPIError('No stock status data returned');
  }

  return data[0] as StockStatus;
}

/**
 * Get stock balance (allocated vs available) by product
 * @param productName - Optional product name to filter by
 * @returns Array of stock balance per product
 */
export async function getStockBalance(
  workspaceId: string,
  productName?: string | null
): Promise<StockBalance[]> {
  const { data, error } = await supabase.rpc('get_stock_balance', {
    workspace_id: workspaceId,
    p_product_name: productName || null,
  });

  if (error) handleSupabaseError(error, 'getStockBalance');
  return (data || []) as StockBalance[];
}

/**
 * Get stock performance metrics including turnover rate and days of supply
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @returns Array of stock performance per product
 */
export async function getStockPerformance(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<StockPerformance[]> {
  const { data, error } = await supabase.rpc('get_stock_performance', {
    workspace_id: workspaceId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getStockPerformance');
  return (data || []) as StockPerformance[];
}

/**
 * Get stock distribution by service zone
 * @returns Array of stock metrics per zone
 */
export async function getStockByZone(workspaceId: string): Promise<StockByZone[]> {
  const { data, error } = await supabase.rpc('get_stock_by_zone', { workspace_id: workspaceId });

  if (error) handleSupabaseError(error, 'getStockByZone');
  return (data || []) as StockByZone[];
}

/**
 * Get low stock alerts for facilities needing restocking
 * @param thresholdDays - Days of supply threshold (default: 7)
 * @returns Array of facilities with low stock
 */
export async function getLowStockAlerts(
  workspaceId: string,
  thresholdDays: number = 7
): Promise<LowStockAlert[]> {
  const { data, error } = await supabase.rpc('get_low_stock_alerts', {
    workspace_id: workspaceId,
    p_threshold_days: thresholdDays,
  });

  if (error) handleSupabaseError(error, 'getLowStockAlerts');
  return (data || []) as LowStockAlert[];
}

// ============================================================================
// 7. RESOURCE UTILIZATION API
// ============================================================================

/**
 * Get vehicle payload utilization metrics
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @param vehicleId - Optional vehicle ID to filter by
 * @returns Array of vehicle payload and weight utilization metrics
 */
export async function getVehiclePayloadUtilization(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null,
  vehicleId?: string | null
): Promise<VehiclePayloadUtilization[]> {
  const { data, error } = await supabase.rpc('get_vehicle_payload_utilization', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
    p_vehicle_id: vehicleId || null,
  });

  if (error) handleSupabaseError(error, 'getVehiclePayloadUtilization');
  return (data || []) as VehiclePayloadUtilization[];
}

/**
 * Get delivery performance by health program
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @returns Array of program performance metrics
 */
export async function getProgramPerformance(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<ProgramPerformance[]> {
  const { data, error } = await supabase.rpc('get_program_performance', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getProgramPerformance');
  return (data || []) as ProgramPerformance[];
}

/**
 * Get driver utilization metrics (deliveries per week)
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @returns Array of driver utilization metrics with status
 */
export async function getDriverUtilization(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<DriverUtilization[]> {
  const { data, error } = await supabase.rpc('get_driver_utilization', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getDriverUtilization');
  return (data || []) as DriverUtilization[];
}

/**
 * Get route efficiency analysis (actual vs estimated metrics)
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @returns Array of route efficiency metrics with ratings
 */
export async function getRouteEfficiency(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<RouteEfficiency[]> {
  const { data, error } = await supabase.rpc('get_route_efficiency', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getRouteEfficiency');
  return (data || []) as RouteEfficiency[];
}

/**
 * Get facility delivery coverage metrics
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @param programme - Optional program to filter by
 * @returns Array of facility coverage metrics
 */
export async function getFacilityCoverage(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null,
  programme?: string | null
): Promise<FacilityCoverage[]> {
  const { data, error } = await supabase.rpc('get_facility_coverage', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
    p_programme: programme || null,
  });

  if (error) handleSupabaseError(error, 'getFacilityCoverage');
  return (data || []) as FacilityCoverage[];
}

/**
 * Get cost analysis by health program
 * @param startDate - Optional start date (YYYY-MM-DD)
 * @param endDate - Optional end date (YYYY-MM-DD)
 * @returns Array of cost metrics per program
 */
export async function getCostByProgram(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<CostByProgram[]> {
  const { data, error } = await supabase.rpc('get_cost_by_program', {
    workspace_id: workspaceId,
    start_date: startDate || null,
    end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getCostByProgram');
  return (data || []) as CostByProgram[];
}

// ============================================================================
// RFC-012 Phase 6: Requisition Workflow Analytics
// ============================================================================

export interface StorefrontRequisitionAnalytics {
  approval_turnaround: {
    avg_hours: number;
    median_hours: number;
    p95_hours: number;
    count: number;
  };
  packaging_efficiency: {
    avg_minutes: number;
    median_minutes: number;
    total_packaged: number;
  };
  ready_for_dispatch_queue: {
    avg_wait_hours: number;
    current_queue_depth: number;
    total_processed: number;
  };
  slot_demand: {
    avg_slot_demand: number;
    total_slot_demand: number;
    avg_rounded_slots: number;
    total_requisitions: number;
  };
  fulfillment_rate: {
    total_requisitions: number;
    fulfilled: number;
    failed: number;
    in_progress: number;
    fulfillment_percentage: number;
  };
}

export interface FleetOpsDispatchAnalytics {
  batch_assembly: {
    avg_hours: number;
    median_hours: number;
    total_batches_assembled: number;
  };
  dispatch_efficiency: {
    avg_dispatch_hours: number;
    median_dispatch_hours: number;
    total_dispatches_completed: number;
  };
  snapshot_lock_duration: {
    avg_hours: number;
    median_hours: number;
    currently_locked: number;
  };
  batch_status_distribution: {
    planned: number;
    assigned: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  slot_demand_per_batch: {
    avg_slot_demand: number;
    avg_requisitions_per_batch: number;
  };
}

export interface PackagingTypeDistribution {
  packaging_type: string;
  item_count: number;
  total_quantity: number;
  total_slot_cost: number;
  avg_slot_cost_per_item: number;
  total_package_count: number;
  requisition_count: number;
  avg_slot_demand_per_requisition: number;
}

/**
 * RFC-012 Phase 6: Get Storefront requisition workflow analytics
 * @param startDate - Optional start date (ISO string)
 * @param endDate - Optional end date (ISO string)
 * @returns Storefront requisition analytics metrics
 */
export async function getStorefrontRequisitionAnalytics(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<StorefrontRequisitionAnalytics> {
  const { data, error } = await supabase.rpc('get_storefront_requisition_analytics', {
    p_workspace_id: workspaceId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getStorefrontRequisitionAnalytics');
  return (data || {}) as StorefrontRequisitionAnalytics;
}

/**
 * RFC-012 Phase 6: Get FleetOps dispatch workflow analytics
 * @param startDate - Optional start date (ISO string)
 * @param endDate - Optional end date (ISO string)
 * @returns FleetOps dispatch analytics metrics
 */
export async function getFleetOpsDispatchAnalytics(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<FleetOpsDispatchAnalytics> {
  const { data, error } = await supabase.rpc('get_fleetops_dispatch_analytics', {
    p_workspace_id: workspaceId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getFleetOpsDispatchAnalytics');
  return (data || {}) as FleetOpsDispatchAnalytics;
}

/**
 * RFC-012 Phase 6: Get packaging type distribution and slot cost analysis
 * @param startDate - Optional start date (ISO string)
 * @param endDate - Optional end date (ISO string)
 * @returns Array of packaging type distribution metrics
 */
export async function getPackagingTypeDistribution(
  workspaceId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<PackagingTypeDistribution[]> {
  const { data, error } = await supabase.rpc('get_packaging_type_distribution', {
    p_workspace_id: workspaceId,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) handleSupabaseError(error, 'getPackagingTypeDistribution');
  return (data || []) as PackagingTypeDistribution[];
}

// ============================================================================
// EXPORTS
// ============================================================================

export const analyticsAPI = {
  // Delivery performance
  getDeliveryKPIs,
  getTopVehiclesByOnTime,

  // Driver efficiency
  getDriverKPIs,
  getTopDrivers,

  // Vehicle utilization
  getVehicleKPIs,
  getVehiclesNeedingMaintenance,

  // Cost analysis
  getCostKPIs,
  getVehicleCosts,
  getDriverCosts,

  // Dashboard summary
  getDashboardSummary,

  // Stock analytics
  getStockStatus,
  getStockBalance,
  getStockPerformance,
  getStockByZone,
  getLowStockAlerts,

  // Resource utilization
  getVehiclePayloadUtilization,
  getProgramPerformance,
  getDriverUtilization,
  getRouteEfficiency,
  getFacilityCoverage,
  getCostByProgram,

  // RFC-012 Phase 6: Requisition workflow analytics
  getStorefrontRequisitionAnalytics,
  getFleetOpsDispatchAnalytics,
  getPackagingTypeDistribution,
};
