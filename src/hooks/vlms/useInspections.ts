/**
 * VLMS Inspections Hooks
 * React Query hooks for inspection operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInspectionsStore } from '@/stores/vlms/inspectionsStore';
import { toast } from 'sonner';

interface CreateInspectionData {
  vehicle_id: string;
  inspection_date: string;
  inspection_type: string;
  inspector_name: string;
  overall_status: string;
  roadworthy: boolean;
  meets_safety_standards: boolean;
  odometer_reading: number | null;
  notes: string | null;
  next_inspection_date: string | null;
}

export const inspectionKeys = {
  all: ['vlms', 'inspections'] as const,
  lists: () => [...inspectionKeys.all, 'list'] as const,
  list: (filters?: object) => [...inspectionKeys.lists(), filters ?? {}] as const,
  vehicle: (vehicleId: string) => [...inspectionKeys.all, 'vehicle', vehicleId] as const,
};

export function useInspections(filters?: object) {
  const fetchInspections = useInspectionsStore((state) => state.fetchInspections);
  const inspections = useInspectionsStore((state) => state.inspections);

  return useQuery({
    queryKey: inspectionKeys.list(filters),
    queryFn: async () => {
      await fetchInspections();
      return inspections;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useVehicleInspections(vehicleId: string) {
  const fetchInspections = useInspectionsStore((state) => state.fetchInspections);
  const inspections = useInspectionsStore((state) => state.inspections);

  return useQuery({
    queryKey: inspectionKeys.vehicle(vehicleId),
    queryFn: async () => {
      await fetchInspections(vehicleId);
      return inspections;
    },
    enabled: !!vehicleId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateInspection() {
  const queryClient = useQueryClient();
  const createInspection = useInspectionsStore((state) => state.createInspection);

  return useMutation({
    mutationFn: (data: CreateInspectionData) => createInspection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.all });
    },
    onError: (error: any) => {
      toast.error(`Failed: ${error.message}`);
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();
  const deleteInspection = useInspectionsStore((state) => state.deleteInspection);

  return useMutation({
    mutationFn: (id: string) => deleteInspection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inspectionKeys.all });
    },
  });
}
