/**
 * useDriverGPS - Real-time GPS position tracking hook
 * Subscribes to driver_gps_events for high-frequency position updates
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GPSEvent } from '@/types/live-map';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Generate a stable unique suffix per hook instance to avoid channel name
// conflicts in React StrictMode (which double-mounts in development)
let gpsChannelCounter = 0;

interface UseDriverGPSOptions {
  driverIds?: string[];
  enabled?: boolean;
  refetchInterval?: number;
}

interface DriverGPSData {
  [driverId: string]: GPSEvent;
}

// Transform database row to GPSEvent
function transformGPSEvent(row: Record<string, unknown>): GPSEvent {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    sessionId: row.session_id as string | null,
    deviceId: row.device_id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    altitude: row.altitude_m as number | undefined,
    accuracy: row.accuracy_m as number,
    heading: row.heading as number | undefined,
    speed: row.speed_mps as number | undefined,
    capturedAt: new Date(row.captured_at as string),
    receivedAt: new Date(row.received_at as string),
    batchId: row.batch_id as string | undefined,
    tripId: row.trip_id as string | undefined,
    batteryLevel: row.battery_level as number | undefined,
    networkType: row.network_type as string | undefined,
    isBackground: row.is_background as boolean | undefined,
  };
}

export function useDriverGPS(options: UseDriverGPSOptions = {}) {
  const { driverIds, enabled = true, refetchInterval = 5000 } = options;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelNameRef = useRef<string>(`driver-gps-live-${++gpsChannelCounter}`);

  // Fetch latest GPS positions for all drivers
  const fetchLatestPositions = useCallback(async (): Promise<DriverGPSData> => {
    try {
      // Only fetch recent GPS events (last 30 minutes) with a safety limit
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      let query = supabase
        .from('driver_gps_events')
        .select('*')
        .gte('captured_at', thirtyMinAgo)
        .order('captured_at', { ascending: false })
        .limit(200);

      // Filter by specific driver IDs if provided
      if (driverIds && driverIds.length > 0) {
        query = query.in('driver_id', driverIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by driver_id, keeping only the latest entry per driver
      const latestByDriver: DriverGPSData = {};
      for (const row of data || []) {
        const driverId = row.driver_id as string;
        if (!latestByDriver[driverId]) {
          latestByDriver[driverId] = transformGPSEvent(row);
        }
      }

      return latestByDriver;
    } catch (err) {
      console.error('Error fetching GPS positions:', err);
      return {};
    }
  }, [driverIds]);

  // React Query for initial data and fallback polling
  const query = useQuery({
    queryKey: ['driver-gps', driverIds?.join(',') || 'all'],
    queryFn: fetchLatestPositions,
    enabled,
    refetchInterval,
    staleTime: 2000,
  });

  // Real-time subscription for GPS updates
  useEffect(() => {
    if (!enabled) return;

    // Build filter for specific drivers if provided
    const filter = driverIds?.length
      ? `driver_id=in.(${driverIds.join(',')})`
      : undefined;

    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_gps_events',
          filter,
        },
        (payload) => {
          const newEvent = transformGPSEvent(payload.new);

          // Update the query cache with the new position
          queryClient.setQueryData<DriverGPSData>(
            ['driver-gps', driverIds?.join(',') || 'all'],
            (old) => ({
              ...old,
              [newEvent.driverId]: newEvent,
            })
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useDriverGPS] Subscribed to real-time GPS updates');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useDriverGPS] Channel error - falling back to polling only');
          // Don't throw error, just continue with polling fallback
        }
        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[useDriverGPS] Channel disconnected - will retry on next effect');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, driverIds, queryClient]);

  // Get position for a specific driver
  const getDriverPosition = useCallback(
    (driverId: string): GPSEvent | null => {
      return query.data?.[driverId] || null;
    },
    [query.data]
  );

  // Get all driver positions as array
  const getAllPositions = useCallback((): GPSEvent[] => {
    return Object.values(query.data || {});
  }, [query.data]);

  return {
    ...query,
    positions: query.data || {},
    getDriverPosition,
    getAllPositions,
  };
}

// Hook to get GPS position for a single driver
export function useSingleDriverGPS(driverId: string | null, enabled = true) {
  return useDriverGPS({
    driverIds: driverId ? [driverId] : undefined,
    enabled: enabled && !!driverId,
  });
}
