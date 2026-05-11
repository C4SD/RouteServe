import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  getVehiclePayloadUtilization,
  getProgramPerformance,
  getDriverUtilization,
  getRouteEfficiency,
  getFacilityCoverage,
  getCostByProgram,
} from '@/integrations/supabase/analytics';
import type {
  VehiclePayloadUtilization,
  ProgramPerformance,
  DriverUtilization,
  RouteEfficiency,
  FacilityCoverage,
  CostByProgram,
} from '@/types';

export function useVehiclePayloadUtilization(
  startDate?: string | null,
  endDate?: string | null,
  vehicleId?: string | null
): UseQueryResult<VehiclePayloadUtilization[], Error> {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['vehicle-payload-utilization', workspaceId, startDate, endDate, vehicleId],
    queryFn: () => getVehiclePayloadUtilization(workspaceId!, startDate, endDate, vehicleId),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useProgramPerformance(
  startDate?: string | null,
  endDate?: string | null
): UseQueryResult<ProgramPerformance[], Error> {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['program-performance', workspaceId, startDate, endDate],
    queryFn: () => getProgramPerformance(workspaceId!, startDate, endDate),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDriverUtilization(
  startDate?: string | null,
  endDate?: string | null
): UseQueryResult<DriverUtilization[], Error> {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['driver-utilization', workspaceId, startDate, endDate],
    queryFn: () => getDriverUtilization(workspaceId!, startDate, endDate),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRouteEfficiency(
  startDate?: string | null,
  endDate?: string | null
): UseQueryResult<RouteEfficiency[], Error> {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['route-efficiency', workspaceId, startDate, endDate],
    queryFn: () => getRouteEfficiency(workspaceId!, startDate, endDate),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useFacilityCoverage(
  startDate?: string | null,
  endDate?: string | null,
  programme?: string | null
): UseQueryResult<FacilityCoverage[], Error> {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['facility-coverage', workspaceId, startDate, endDate, programme],
    queryFn: () => getFacilityCoverage(workspaceId!, startDate, endDate, programme),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCostByProgram(
  startDate?: string | null,
  endDate?: string | null
): UseQueryResult<CostByProgram[], Error> {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: ['cost-by-program', workspaceId, startDate, endDate],
    queryFn: () => getCostByProgram(workspaceId!, startDate, endDate),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000,
  });
}
