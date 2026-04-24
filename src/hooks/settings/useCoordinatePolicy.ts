import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSettings, CoordinatePolicy } from './useWorkspaceSettings';
import { detectCoordinateIssues, CoordinateIssue } from '@/lib/geo-bounds';

/**
 * Hook to read and update the workspace coordinate policy,
 * and to validate coordinates against it.
 */
export function useCoordinatePolicy(workspaceId: string | null) {
  const queryClient = useQueryClient();
  const { data: wsData, isLoading } = useWorkspaceSettings(workspaceId);

  const policy = wsData?.settings?.coordinate_policy ?? null;

  /**
   * Validate a lat/lng pair against the current workspace coordinate policy.
   * Falls back to Nigeria-only check when no state policy is configured.
   */
  function validateCoordinates(lat: number, lng: number, stateNameOrCode?: string): CoordinateIssue[] {
    const stateToCheck = stateNameOrCode ?? policy?.state_codes?.[0];
    return detectCoordinateIssues(lat, lng, stateToCheck);
  }

  const savePolicyMutation = useMutation({
    mutationFn: async (newPolicy: CoordinatePolicy) => {
      if (!workspaceId || !wsData) throw new Error('No workspace');
      const updatedSettings = {
        ...wsData.settings,
        coordinate_policy: newPolicy,
      };
      const { error } = await supabase
        .from('workspaces')
        .update({ settings: updatedSettings })
        .eq('id', workspaceId);
      if (error) throw error;
      return newPolicy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings', workspaceId] });
    },
  });

  return {
    policy,
    isLoading,
    validateCoordinates,
    savePolicy: savePolicyMutation.mutate,
    isSaving: savePolicyMutation.isPending,
  };
}
