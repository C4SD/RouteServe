import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ZoneAlert {
  id: string;
  zone_id: string;
  driver_id: string;
  event_type: string;
  location_lat: number;
  location_lng: number;
  timestamp: string;
  acknowledged: boolean;
  notes: string | null;
}

/**
 * Hook for fetching and subscribing to zone alerts
 * Shows toast notifications for new alerts
 */
export function useZoneAlerts() {
  const queryClient = useQueryClient();

  const { data: alerts = [], ...queryState } = useQuery({
    queryKey: ['zone-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zone_alerts')
        .select(`
          *,
          service_zones(name, color),
          drivers(name)
        `)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as (ZoneAlert & {
        service_zones: { name: string; color: string } | null;
        drivers: { name: string } | null;
      })[];
    },
    refetchInterval: 60000, // Realtime subscription handles new alerts; this is a safety net only
  });

  // Real-time subscription for new alerts
  useEffect(() => {
    const channel = supabase
      .channel('zone-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zone_alerts',
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['zone-alerts'] });

          // Show toast notification
          const alert = payload.new as ZoneAlert;
          const eventLabel = alert.event_type === 'entry' ? 'entered' : 'exited';
          
          toast.warning(`Zone ${eventLabel}`, {
            description: `A driver has ${eventLabel} a service zone.`,
            action: {
              label: 'View',
              onClick: () => {
                // Navigate to map or alert details
              },
            },
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'zone_alerts',
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['zone-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    alerts,
    ...queryState,
  };
}

/**
 * Hook for acknowledging zone alerts
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  const acknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('zone_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId);

    if (error) {
      toast.error('Failed to acknowledge alert', {
        description: error.message,
      });
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['zone-alerts'] });
    toast.success('Alert acknowledged');
  };

  return { acknowledgeAlert };
}
