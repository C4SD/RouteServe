import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VehicleFormData {
  type: string;
  model: string;
  plate_number: string;
  capacity: number;
  max_weight: number;
  fuel_type: 'diesel' | 'petrol' | 'electric';
  fuel_efficiency: number;
  avg_speed: number;
  photo_url?: string;
  thumbnail_url?: string;
  ai_generated?: boolean;
  category_id?: string;
  subcategory?: string;
  has_tiers?: boolean;
  zone_id?: string;
  warehouse_id?: string;
  max_daily_distance?: number;
  maintenance_frequency_km?: number;
}

export function useVehicleManagement() {
  const queryClient = useQueryClient();

  const createVehicle = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const workspaceId = localStorage.getItem('biko_active_workspace_id');
      if (!workspaceId) throw new Error('No active workspace selected');

      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .insert({ ...data, workspace_id: workspaceId })
        .select()
        .single();

      if (error) throw error;
      return vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicle added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add vehicle', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VehicleFormData> }) => {
      const { error } = await supabase
        .from('vehicles')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicle updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update vehicle', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from('vehicles')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) throw error;
      if (count === 0) throw new Error('Vehicle not found or you do not have permission to delete it');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicle deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete vehicle', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return {
    createVehicle: createVehicle.mutate,
    createVehicleAsync: createVehicle.mutateAsync,
    updateVehicle: updateVehicle.mutate,
    deleteVehicle: deleteVehicle.mutate,
    isCreating: createVehicle.isPending,
    isUpdating: updateVehicle.isPending,
    isDeleting: deleteVehicle.isPending,
  };
}
