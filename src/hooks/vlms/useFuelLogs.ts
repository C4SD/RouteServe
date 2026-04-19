/**
 * VLMS Fuel Logs Hooks
 * React Query hooks for fuel log operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFuelLogsStore } from '@/stores/vlms/fuelLogsStore';
import { FuelLogFormData } from '@/types/vlms';
import { toast } from 'sonner';

export const fuelKeys = {
  all: ['vlms', 'fuel'] as const,
  lists: () => [...fuelKeys.all, 'list'] as const,
  list: (filters?: object) => [...fuelKeys.lists(), filters ?? {}] as const,
  vehicle: (vehicleId: string) => [...fuelKeys.all, 'vehicle', vehicleId] as const,
};

export function useFuelLogs(filters?: object) {
  const fetchLogs = useFuelLogsStore((state) => state.fetchLogs);
  const logs = useFuelLogsStore((state) => state.logs);

  return useQuery({
    queryKey: fuelKeys.list(filters),
    queryFn: async () => {
      await fetchLogs();
      return logs;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useVehicleFuelLogs(vehicleId: string) {
  const fetchLogs = useFuelLogsStore((state) => state.fetchLogs);
  const logs = useFuelLogsStore((state) => state.logs);

  return useQuery({
    queryKey: fuelKeys.vehicle(vehicleId),
    queryFn: async () => {
      await fetchLogs(vehicleId);
      return logs;
    },
    enabled: !!vehicleId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateFuelLog() {
  const queryClient = useQueryClient();
  const createLog = useFuelLogsStore((state) => state.createLog);

  return useMutation({
    mutationFn: (data: FuelLogFormData) => createLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fuelKeys.all });
      toast.success('Fuel log created');
    },
    onError: (error: any) => {
      toast.error(`Failed: ${error.message}`);
    },
  });
}

export function useDeleteFuelLog() {
  const queryClient = useQueryClient();
  const deleteLog = useFuelLogsStore((state) => state.deleteLog);

  return useMutation({
    mutationFn: (id: string) => deleteLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fuelKeys.all });
      toast.success('Fuel log deleted');
    },
  });
}
