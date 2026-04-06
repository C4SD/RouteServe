import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── RBAC v2 Role Constants ──────────────────────────────────────────────────

export const RBAC_ROLES = ['admin', 'ops_manager', 'fleet_manager', 'driver', 'viewer'] as const;
export type RbacRoleCode = (typeof RBAC_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  ops_manager: 'Ops Manager',
  fleet_manager: 'Fleet Manager',
  driver: 'Driver',
  viewer: 'Viewer',
};

export const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  admin: 'bg-red-500/10 text-red-600 dark:text-red-400',
  ops_manager: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  fleet_manager: 'bg-green-500/10 text-green-600 dark:text-green-400',
  driver: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  viewer: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorkspaceMemberV2 {
  id: string; // workspace_members.id
  user_id: string;
  workspace_id: string;
  role_code: string;
  role_name: string;
  status: 'active' | 'inactive';
  created_at: string;
  profile: {
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useWorkspaceMembersV2(workspaceId: string | null) {
  return useQuery({
    queryKey: ['workspace-members-v2', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      // Fetch members with role_id and status
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('id, user_id, workspace_id, role_id, status, created_at')
        .eq('workspace_id', workspaceId);

      if (membersError) {
        console.error('[useWorkspaceMembersV2] Failed to fetch members:', membersError);
        throw membersError;
      }
      if (!members || members.length === 0) {
        console.warn('[useWorkspaceMembersV2] No members found for workspace:', workspaceId);
        return [];
      }

      // Fetch roles
      const roleIds = [...new Set(members.map((m: any) => m.role_id).filter(Boolean))];
      let rolesMap: Record<string, { code: string; name: string }> = {};
      if (roleIds.length > 0) {
        const { data: roles } = await supabase
          .from('roles')
          .select('id, code, name')
          .in('id', roleIds);

        rolesMap = (roles || []).reduce((acc: any, r: any) => {
          acc[r.id] = { code: r.code, name: r.name };
          return acc;
        }, {});
      }

      // Fetch profiles
      const userIds = members.map((m: any) => m.user_id);
      let profilesMap: Record<string, { full_name: string; phone: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone, avatar_url')
          .in('id', userIds);

        profilesMap = (profiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = { full_name: p.full_name, phone: p.phone, avatar_url: p.avatar_url };
          return acc;
        }, {});
      }

      // Fetch emails from auth via RPC
      let emailsMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase.rpc('get_user_emails', {
          p_user_ids: userIds,
        });

        emailsMap = ((usersData as any[]) || []).reduce((acc: any, u: any) => {
          acc[u.id] = u.email;
          return acc;
        }, {});
      }

      return members.map((m: any): WorkspaceMemberV2 => {
        const role = m.role_id ? rolesMap[m.role_id] : null;
        const profile = profilesMap[m.user_id];
        return {
          id: m.id,
          user_id: m.user_id,
          workspace_id: m.workspace_id,
          role_code: role?.code || 'viewer',
          role_name: role?.name || 'Viewer',
          status: m.status || 'active',
          created_at: m.created_at,
          profile: {
            full_name: profile?.full_name || 'Unknown',
            phone: profile?.phone || null,
            avatar_url: profile?.avatar_url || null,
            email: emailsMap[m.user_id] || null,
          },
        };
      });
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });
}

export function useUpdateMemberRoleV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      userId,
      roleCode,
    }: {
      workspaceId: string;
      userId: string;
      roleCode: string;
    }) => {
      const { error } = await supabase.rpc('update_member_role_v2', {
        p_workspace_id: workspaceId,
        p_member_user_id: userId,
        p_role_code: roleCode,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('Member role updated');
      queryClient.invalidateQueries({ queryKey: ['workspace-members-v2', variables.workspaceId] });
    },
    onError: (error) => {
      console.error('Failed to update role:', error);
      toast.error('Failed to update member role');
    },
  });
}

export function useToggleMemberStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      userId,
      status,
    }: {
      workspaceId: string;
      userId: string;
      status: 'active' | 'inactive';
    }) => {
      const { error } = await supabase.rpc('toggle_member_status', {
        p_workspace_id: workspaceId,
        p_member_user_id: userId,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const action = variables.status === 'active' ? 'activated' : 'deactivated';
      toast.success(`Member ${action} successfully`);
      queryClient.invalidateQueries({ queryKey: ['workspace-members-v2', variables.workspaceId] });
    },
    onError: (error: any) => {
      console.error('Failed to toggle member status:', error);
      toast.error(error.message || 'Failed to update member status');
    },
  });
}

export function useSearchUsersForWorkspace(workspaceId: string | null, search: string) {
  return useQuery({
    queryKey: ['workspace-invite-search', workspaceId, search],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase.rpc('search_users_for_workspace_invite', {
        p_workspace_id: workspaceId,
        p_search: search || null,
      });
      if (error) throw error;
      return (data as { id: string; email: string; full_name: string; phone: string | null }[]) || [];
    },
    enabled: !!workspaceId && search.length >= 2,
    staleTime: 10000,
  });
}

export function useAddWorkspaceMemberV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      userId,
      roleCode,
    }: {
      workspaceId: string;
      userId: string;
      roleCode: string;
    }) => {
      // Lookup role_id from code
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('code', roleCode)
        .single();

      if (roleError || !role) throw new Error(`Role '${roleCode}' not found`);

      // Map to legacy role
      const legacyRole = roleCode === 'admin' ? 'admin' : roleCode === 'viewer' ? 'viewer' : 'member';

      const { error } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: legacyRole,
          role_id: role.id,
          status: 'active',
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('Member added successfully');
      queryClient.invalidateQueries({ queryKey: ['workspace-members-v2', variables.workspaceId] });
    },
    onError: (error) => {
      console.error('Failed to add member:', error);
      toast.error('Failed to add member');
    },
  });
}

export function useRemoveWorkspaceMemberV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      userId,
    }: {
      workspaceId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['workspace-members-v2', variables.workspaceId] });
    },
    onError: (error) => {
      console.error('Failed to remove member:', error);
      toast.error('Failed to remove member');
    },
  });
}
