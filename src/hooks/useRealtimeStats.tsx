import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeStats {
  activeVehicles: number;
  inProgressDeliveries: number;
  completedDeliveries: number;
  activeAlerts: number;
}

export function useRealtimeStats() {
  return useQuery({
    queryKey: ['realtime-stats'],
    queryFn: async (): Promise<RealtimeStats> => {
      // Run all 4 counts in parallel — one round trip instead of four sequential
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [vehicles, inProgress, completed, alerts] = await Promise.all([
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'in-use'),
        supabase.from('route_history').select('*', { count: 'exact', head: true }).eq('status', 'in-progress'),
        supabase.from('route_history').select('*', { count: 'exact', head: true }).eq('status', 'delivered').gte('actual_arrival', today.toISOString()),
        supabase.from('zone_alerts').select('*', { count: 'exact', head: true }).eq('acknowledged', false),
      ]);

      return {
        activeVehicles: vehicles.count ?? 0,
        inProgressDeliveries: inProgress.count ?? 0,
        completedDeliveries: completed.count ?? 0,
        activeAlerts: alerts.count ?? 0,
      };
    },
    refetchInterval: 60000, // Reduced from 10s to 60s — stats don't need second-by-second precision
    staleTime: 30000,
  });
}
