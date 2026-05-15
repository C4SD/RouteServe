import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  analyticsAPI,
  type DeliveryKPIs,
  type TopVehiclePerformance,
  type DriverKPIs,
  type TopDriverPerformance,
  type VehicleKPIs,
  type VehicleMaintenanceNeeded,
  type CostKPIs,
  type VehicleCostBreakdown,
  type DriverCostBreakdown,
  type DashboardSummary,
} from '@/integrations/supabase/analytics';

export const analyticsKeys = {
  all: ['analytics'] as const,
  delivery: (workspaceId: string) => [...analyticsKeys.all, workspaceId, 'delivery'] as const,
  deliveryKPIs: (workspaceId: string, startDate?: string | null, endDate?: string | null) =>
    [...analyticsKeys.delivery(workspaceId), 'kpis', { startDate, endDate }] as const,
  topVehicles: (workspaceId: string, limit: number) =>
    [...analyticsKeys.delivery(workspaceId), 'top-vehicles', limit] as const,

  drivers: (workspaceId: string) => [...analyticsKeys.all, workspaceId, 'drivers'] as const,
  driverKPIs: (workspaceId: string) => [...analyticsKeys.drivers(workspaceId), 'kpis'] as const,
  topDrivers: (workspaceId: string, metric: string, limit: number) =>
    [...analyticsKeys.drivers(workspaceId), 'top', metric, limit] as const,

  vehicles: (workspaceId: string) => [...analyticsKeys.all, workspaceId, 'vehicles'] as const,
  vehicleKPIs: (workspaceId: string) => [...analyticsKeys.vehicles(workspaceId), 'kpis'] as const,
  vehicleMaintenance: (workspaceId: string) => [...analyticsKeys.vehicles(workspaceId), 'maintenance'] as const,

  costs: (workspaceId: string) => [...analyticsKeys.all, workspaceId, 'costs'] as const,
  costKPIs: (workspaceId: string) => [...analyticsKeys.costs(workspaceId), 'kpis'] as const,
  vehicleCosts: (workspaceId: string, limit: number) => [...analyticsKeys.costs(workspaceId), 'vehicles', limit] as const,
  driverCosts: (workspaceId: string, limit: number) => [...analyticsKeys.costs(workspaceId), 'drivers', limit] as const,

  dashboard: (workspaceId: string, startDate?: string | null, endDate?: string | null) =>
    [...analyticsKeys.all, workspaceId, 'dashboard', { startDate, endDate }] as const,
};

const DEFAULT_STALE_TIME = 5 * 60 * 1000;
const DEFAULT_CACHE_TIME = 10 * 60 * 1000;

export function useDeliveryKPIs(
  startDate?: string | null,
  endDate?: string | null,
  options?: Omit<UseQueryOptions<DeliveryKPIs>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.deliveryKPIs(workspaceId ?? '', startDate, endDate),
    queryFn: () => analyticsAPI.getDeliveryKPIs(workspaceId!, startDate, endDate),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useTopVehiclesByOnTime(
  limit: number = 10,
  options?: Omit<UseQueryOptions<TopVehiclePerformance[]>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.topVehicles(workspaceId ?? '', limit),
    queryFn: () => analyticsAPI.getTopVehiclesByOnTime(workspaceId!, limit),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useDriverKPIs(
  options?: Omit<UseQueryOptions<DriverKPIs>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.driverKPIs(workspaceId ?? ''),
    queryFn: () => analyticsAPI.getDriverKPIs(workspaceId!),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useTopDrivers(
  metric: 'on_time_rate' | 'fuel_efficiency' | 'deliveries' = 'on_time_rate',
  limit: number = 10,
  options?: Omit<UseQueryOptions<TopDriverPerformance[]>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.topDrivers(workspaceId ?? '', metric, limit),
    queryFn: () => analyticsAPI.getTopDrivers(workspaceId!, metric, limit),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useVehicleKPIs(
  options?: Omit<UseQueryOptions<VehicleKPIs>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.vehicleKPIs(workspaceId ?? ''),
    queryFn: () => analyticsAPI.getVehicleKPIs(workspaceId!),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useVehiclesNeedingMaintenance(
  options?: Omit<UseQueryOptions<VehicleMaintenanceNeeded[]>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.vehicleMaintenance(workspaceId ?? ''),
    queryFn: () => analyticsAPI.getVehiclesNeedingMaintenance(workspaceId!),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useCostKPIs(
  options?: Omit<UseQueryOptions<CostKPIs>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.costKPIs(workspaceId ?? ''),
    queryFn: () => analyticsAPI.getCostKPIs(workspaceId!),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useVehicleCosts(
  limit: number = 10,
  options?: Omit<UseQueryOptions<VehicleCostBreakdown[]>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.vehicleCosts(workspaceId ?? '', limit),
    queryFn: () => analyticsAPI.getVehicleCosts(workspaceId!, limit),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useDriverCosts(
  limit: number = 10,
  options?: Omit<UseQueryOptions<DriverCostBreakdown[]>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.driverCosts(workspaceId ?? '', limit),
    queryFn: () => analyticsAPI.getDriverCosts(workspaceId!, limit),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useDashboardSummary(
  startDate?: string | null,
  endDate?: string | null,
  options?: Omit<UseQueryOptions<DashboardSummary>, 'queryKey' | 'queryFn'>
) {
  const { workspaceId, isLoadingWorkspaces } = useWorkspace();
  return useQuery({
    queryKey: analyticsKeys.dashboard(workspaceId ?? '', startDate, endDate),
    queryFn: () => analyticsAPI.getDashboardSummary(workspaceId!, startDate, endDate),
    enabled: !!workspaceId && !isLoadingWorkspaces,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: false,
    ...options,
  });
}

export function useAllAnalytics(
  startDate?: string | null,
  endDate?: string | null
) {
  const deliveryKPIs = useDeliveryKPIs(startDate, endDate);
  const driverKPIs = useDriverKPIs();
  const vehicleKPIs = useVehicleKPIs();
  const costKPIs = useCostKPIs();

  return {
    delivery: deliveryKPIs,
    drivers: driverKPIs,
    vehicles: vehicleKPIs,
    costs: costKPIs,
    isLoading:
      deliveryKPIs.isLoading ||
      driverKPIs.isLoading ||
      vehicleKPIs.isLoading ||
      costKPIs.isLoading,
    isError:
      deliveryKPIs.isError ||
      driverKPIs.isError ||
      vehicleKPIs.isError ||
      costKPIs.isError,
    error:
      deliveryKPIs.error ||
      driverKPIs.error ||
      vehicleKPIs.error ||
      costKPIs.error,
  };
}
