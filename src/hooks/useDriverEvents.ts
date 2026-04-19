/**
 * useDriverEvents - Real-time driver state machine events
 * Subscribes to driver_events for state transitions (ROUTE_STARTED, AT_STOP, etc.)
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DriverEvent, DriverStatus, EventType } from '@/types/live-map';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Generate a stable unique suffix per hook instance to avoid channel name
// conflicts in React StrictMode (which double-mounts in development)
let eventsChannelCounter = 0;

interface UseDriverEventsOptions {
  driverIds?: string[];
  batchIds?: string[];
  enabled?: boolean;
  limit?: number;
}

interface DriverEventsData {
  events: DriverEvent[];
  latestByDriver: { [driverId: string]: DriverEvent };
  latestByBatch: { [batchId: string]: DriverEvent };
}

// Transform database row to DriverEvent
function transformDriverEvent(row: Record<string, unknown>): DriverEvent {
  const locationData = row.location as { coordinates?: [number, number] } | null;

  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    batchId: row.batch_id as string,
    sessionId: row.session_id as string | null,
    eventType: row.event_type as EventType,
    driverStatus: row.driver_status as DriverStatus,
    location: locationData?.coordinates
      ? [locationData.coordinates[0], locationData.coordinates[1]]
      : null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    recordedAt: new Date(row.recorded_at as string),
    syncedAt: new Date(row.synced_at as string),
    flaggedForReview: row.flagged_for_review as boolean,
    reviewStatus: row.review_status as 'pending' | 'approved' | 'rejected' | undefined,
  };
}

export function useDriverEvents(options: UseDriverEventsOptions = {}) {
  const { driverIds, batchIds, enabled = true, limit = 100 } = options;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelNameRef = useRef<string>(`driver-events-live-${++eventsChannelCounter}`);

  // Fetch recent driver events
  const fetchDriverEvents = useCallback(async (): Promise<DriverEventsData> => {
    try {
      let query = supabase
        .from('driver_events')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(limit);

      // Filter by driver IDs if provided
      if (driverIds && driverIds.length > 0) {
        query = query.in('driver_id', driverIds);
      }

      // Filter by batch IDs if provided
      if (batchIds && batchIds.length > 0) {
        query = query.in('batch_id', batchIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      const events = (data || []).map(transformDriverEvent);

      // Build latest event per driver
      const latestByDriver: { [driverId: string]: DriverEvent } = {};
      for (const event of events) {
        if (!latestByDriver[event.driverId]) {
          latestByDriver[event.driverId] = event;
        }
      }

      // Build latest event per batch
      const latestByBatch: { [batchId: string]: DriverEvent } = {};
      for (const event of events) {
        if (!latestByBatch[event.batchId]) {
          latestByBatch[event.batchId] = event;
        }
      }

      return { events, latestByDriver, latestByBatch };
    } catch (err) {
      console.error('Error fetching driver events:', err);
      return { events: [], latestByDriver: {}, latestByBatch: {} };
    }
  }, [driverIds, batchIds, limit]);

  // React Query for data fetching
  const query = useQuery({
    queryKey: ['driver-events', driverIds?.join(',') || 'all', batchIds?.join(',') || 'all'],
    queryFn: fetchDriverEvents,
    enabled,
    refetchInterval: 10000, // Polling fallback every 10s
    staleTime: 5000,
  });

  // Real-time subscription for new events
  useEffect(() => {
    if (!enabled) return;

    // Build filter
    let filter: string | undefined;
    if (driverIds?.length) {
      filter = `driver_id=in.(${driverIds.join(',')})`;
    } else if (batchIds?.length) {
      filter = `batch_id=in.(${batchIds.join(',')})`;
    }

    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_events',
          filter,
        },
        (payload) => {
          const newEvent = transformDriverEvent(payload.new);

          // Update query cache
          queryClient.setQueryData<DriverEventsData>(
            ['driver-events', driverIds?.join(',') || 'all', batchIds?.join(',') || 'all'],
            (old) => {
              if (!old) {
                return {
                  events: [newEvent],
                  latestByDriver: { [newEvent.driverId]: newEvent },
                  latestByBatch: { [newEvent.batchId]: newEvent },
                };
              }

              return {
                events: [newEvent, ...old.events].slice(0, limit),
                latestByDriver: {
                  ...old.latestByDriver,
                  [newEvent.driverId]: newEvent,
                },
                latestByBatch: {
                  ...old.latestByBatch,
                  [newEvent.batchId]: newEvent,
                },
              };
            }
          );

          // Also invalidate delivery batches to update driver_status
          queryClient.invalidateQueries({ queryKey: ['delivery-batches'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useDriverEvents] Subscribed to real-time driver events');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useDriverEvents] Channel error - falling back to polling only');
          // Don't throw error, just continue with polling fallback
        }
        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[useDriverEvents] Channel disconnected - will retry on next effect');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, driverIds, batchIds, limit, queryClient]);

  // Get latest event for a specific driver
  const getDriverStatus = useCallback(
    (driverId: string): DriverStatus | null => {
      return query.data?.latestByDriver[driverId]?.driverStatus || null;
    },
    [query.data]
  );

  // Get latest event for a specific batch
  const getBatchStatus = useCallback(
    (batchId: string): DriverStatus | null => {
      return query.data?.latestByBatch[batchId]?.driverStatus || null;
    },
    [query.data]
  );

  // Get all events as array
  const getEvents = useCallback((): DriverEvent[] => {
    return query.data?.events || [];
  }, [query.data]);

  return {
    ...query,
    events: query.data?.events || [],
    latestByDriver: query.data?.latestByDriver || {},
    latestByBatch: query.data?.latestByBatch || {},
    getDriverStatus,
    getBatchStatus,
    getEvents,
  };
}

// Hook to get events for a single batch
export function useBatchDriverEvents(batchId: string | null, enabled = true) {
  return useDriverEvents({
    batchIds: batchId ? [batchId] : undefined,
    enabled: enabled && !!batchId,
  });
}
