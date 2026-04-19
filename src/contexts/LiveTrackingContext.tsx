/**
 * LiveTrackingContext - Singleton provider for useLiveTracking
 *
 * Ensures only one set of Supabase realtime subscriptions (useDriverGPS +
 * useDriverEvents) is created per page, regardless of how many components
 * consume the data.
 *
 * Usage:
 *   1. Wrap the page with <LiveTrackingProvider>
 *   2. Replace useLiveTracking() calls inside that tree with useLiveTrackingCtx()
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useLiveTracking } from '@/hooks/useLiveTracking';

type LiveTrackingValue = ReturnType<typeof useLiveTracking>;

const LiveTrackingContext = createContext<LiveTrackingValue | null>(null);

interface LiveTrackingProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export function LiveTrackingProvider({ children, enabled = true }: LiveTrackingProviderProps) {
  const value = useLiveTracking({ enabled });
  return (
    <LiveTrackingContext.Provider value={value}>
      {children}
    </LiveTrackingContext.Provider>
  );
}

export function useLiveTrackingCtx(): LiveTrackingValue {
  const ctx = useContext(LiveTrackingContext);
  if (!ctx) throw new Error('useLiveTrackingCtx must be used within <LiveTrackingProvider>');
  return ctx;
}
