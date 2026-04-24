/**
 * VLMS Incidents Hooks
 * React Query hooks for incident operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIncidentsStore } from '@/stores/vlms/incidentsStore';
import { IncidentFormData } from '@/types/vlms';
import { toast } from 'sonner';

export const incidentKeys = {
  all: ['vlms', 'incidents'] as const,
  lists: () => [...incidentKeys.all, 'list'] as const,
  list: (filters?: object) => [...incidentKeys.lists(), filters ?? {}] as const,
  vehicle: (vehicleId: string) => [...incidentKeys.all, 'vehicle', vehicleId] as const,
};

export function useIncidents(filters?: object) {
  const fetchIncidents = useIncidentsStore((state) => state.fetchIncidents);
  const incidents = useIncidentsStore((state) => state.incidents);

  return useQuery({
    queryKey: incidentKeys.list(filters),
    queryFn: async () => {
      await fetchIncidents();
      return incidents;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useVehicleIncidents(vehicleId: string) {
  const fetchIncidents = useIncidentsStore((state) => state.fetchIncidents);
  const incidents = useIncidentsStore((state) => state.incidents);

  return useQuery({
    queryKey: incidentKeys.vehicle(vehicleId),
    queryFn: async () => {
      await fetchIncidents(vehicleId);
      return incidents;
    },
    enabled: !!vehicleId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  const createIncident = useIncidentsStore((state) => state.createIncident);

  return useMutation({
    mutationFn: (data: IncidentFormData) => createIncident(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidentKeys.all });
    },
    onError: (error: any) => {
      toast.error(`Failed: ${error.message}`);
    },
  });
}

export function useUpdateIncident() {
  const queryClient = useQueryClient();
  const updateIncident = useIncidentsStore((state) => state.updateIncident);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IncidentFormData> }) =>
      updateIncident(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidentKeys.all });
    },
  });
}

export function useDeleteIncident() {
  const queryClient = useQueryClient();
  const deleteIncident = useIncidentsStore((state) => state.deleteIncident);

  return useMutation({
    mutationFn: (id: string) => deleteIncident(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidentKeys.all });
    },
  });
}
