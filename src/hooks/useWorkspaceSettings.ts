/**
 * Workspace Settings Hook
 *
 * Fetches tenant-configurable settings (currency, locale, map center, etc.)
 * for the current user's workspace. Falls back to sensible defaults.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WorkspaceSettings {
  id: string;
  workspace_id: string;
  currency: string;
  currency_symbol: string;
  locale: string;
  country: string;
  default_state: string | null;
  map_center_lat: number;
  map_center_lng: number;
  map_default_zoom: number;
  timezone: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Defaults used when no workspace settings exist yet
const DEFAULTS: Omit<WorkspaceSettings, 'id' | 'workspace_id' | 'created_at' | 'updated_at'> = {
  currency: 'NGN',
  currency_symbol: '₦',
  locale: 'en-NG',
  country: 'Nigeria',
  default_state: 'kano',
  map_center_lat: 12.0,
  map_center_lng: 8.5167,
  map_default_zoom: 11,
  timezone: 'Africa/Lagos',
  metadata: {
    // Map display preferences — used by useMapSettings and Map Settings page
    basemap_style: 'auto',       // 'auto' | 'light' | 'dark'
    show_zones: true,
    show_facilities: true,
    show_routes: true,
    enable_clustering: true,
    realtime_refresh_interval: 30, // seconds
  },
};

/**
 * Fetch workspace settings for the current user's workspace.
 * Auto-creates defaults if none exist.
 */
export function useWorkspaceSettings() {
  return useQuery({
    queryKey: ['workspace-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's workspace
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) {
        // Return defaults if no workspace membership
        return { ...DEFAULTS } as WorkspaceSettings;
      }

      // Fetch settings for workspace
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .maybeSingle();

      if (error) throw error;

      if (data) return data as WorkspaceSettings;

      // No settings yet — return defaults (with workspace_id for potential creation)
      return { ...DEFAULTS, workspace_id: membership.workspace_id } as WorkspaceSettings;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes — settings change rarely
  });
}

/**
 * Update workspace settings.
 */
export function useUpdateWorkspaceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<WorkspaceSettings, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) throw new Error('No workspace membership found');

      const { data, error } = await supabase
        .from('workspace_settings')
        .upsert({
          workspace_id: membership.workspace_id,
          ...updates,
        }, { onConflict: 'workspace_id' })
        .select()
        .single();

      if (error) throw error;
      return data as WorkspaceSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings'] });
      toast.success('Workspace settings updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update workspace settings', { description: error.message });
    },
  });
}

/**
 * Helper: get map center as [lng, lat] tuple (MapLibre format).
 */
export function getMapCenter(settings: WorkspaceSettings | undefined): [number, number] {
  if (!settings) return [DEFAULTS.map_center_lng, DEFAULTS.map_center_lat];
  return [settings.map_center_lng, settings.map_center_lat];
}
