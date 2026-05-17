/**
 * useAbility Hook
 *
 * Core RBAC hook that provides the current user's role and permissions
 * for the active workspace. Uses a 5-minute cache to avoid excessive RPCs.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { RbacRole, Permission, AbilityState } from './types';

interface UseAbilityOptions {
  workspaceId: string | null;
}

export function useAbility({ workspaceId }: UseAbilityOptions): AbilityState {
  const { user } = useAuth();

  const { data: role, isLoading: roleLoading, isError: roleError } = useQuery({
    queryKey: ['workspace-role', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase.rpc('get_workspace_role', {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return (data as RbacRole) || null;
    },
    enabled: !!user && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const { data: permissions = [], isLoading: permissionsLoading, isError: permissionsError } = useQuery({
    queryKey: ['workspace-permissions', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase.rpc('get_workspace_permissions', {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return ((data as { permission_code: string }[]) || []).map(
        (row) => row.permission_code as Permission
      );
    },
    enabled: !!user && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const permissionSet = new Set(permissions);

  // Treat 'admin' and 'owner' as full-access roles
  // (handles both old text-column RPCs returning 'owner' and new role_id-based RPCs returning 'admin')
  const isAdmin = role === 'admin' || role === 'owner';

  // Separate error from loading so RPC failures don't permanently hide UI.
  // On error: stop "loading", deny by default (admin role still grants all if resolved).
  const hasError = Boolean(roleError || permissionsError);
  const isLoading = (roleLoading || permissionsLoading) && !hasError;

  const can = (permission: Permission): boolean => {
    if (isLoading) return false; // callers should check isLoading first
    if (hasError) return false;
    if (isAdmin) return true;
    return permissionSet.has(permission);
  };

  const canAny = (...perms: Permission[]): boolean => {
    if (isLoading) return false;
    if (hasError) return false;
    if (isAdmin) return true;
    return perms.some((p) => permissionSet.has(p));
  };

  const canAll = (...perms: Permission[]): boolean => {
    if (isLoading) return false;
    if (hasError) return false;
    if (isAdmin) return true;
    return perms.every((p) => permissionSet.has(p));
  };

  return {
    role: role ?? null,
    permissions,
    isLoading,
    hasError,
    can,
    canAny,
    canAll,
  };
}
