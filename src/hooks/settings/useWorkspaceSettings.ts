import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CoordinatePolicy {
  /** ISO 3166-1 alpha-2 country code. Only 'NG' (Nigeria) supported for now. */
  country: 'NG';
  /** Nigerian state abbreviations to validate against, e.g. ['KD'] for Kaduna. */
  state_codes: string[];
  /** When true, out-of-state coordinates are treated as errors (block import). When false, warnings only. */
  strict_mode: boolean;
}

export interface WorkspaceSettings {
  default_zone_id?: string;
  default_warehouse_id?: string;
  auto_assign_driver?: boolean;
  active_program_ids?: string[];
  start_of_week?: string;
  working_days?: string[];
  dispatch_cutoff?: string;
  sla_hours?: number;
  waiting_time_sla_minutes?: number;
  date_format?: string;
  coordinate_policy?: CoordinatePolicy;
}

export interface WorkspaceSettingsResult {
  id: string;
  name: string;
  slug: string;
  org_type: string | null;
  settings: WorkspaceSettings;
}

/**
 * Fetch workspace settings by ID.
 * This is the data contract used by batch creation and other operational features.
 * Do NOT hardcode defaults — always read from this function.
 */
export async function getWorkspaceSettings(
  workspaceId: string
): Promise<WorkspaceSettingsResult> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, slug, org_type, settings')
    .eq('id', workspaceId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    org_type: data.org_type,
    settings: (data.settings as WorkspaceSettings) || {},
  };
}

/**
 * React Query hook for workspace settings.
 * Use this in components; use getWorkspaceSettings() directly in mutations/actions.
 */
export function useWorkspaceSettings(workspaceId: string | null) {
  return useQuery({
    queryKey: ['workspace-settings', workspaceId],
    queryFn: () => getWorkspaceSettings(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
  });
}
