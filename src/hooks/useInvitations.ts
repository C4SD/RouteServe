/**
 * Invitations Hook
 *
 * Manages user invitations for workspace onboarding.
 * Supports inviting users, accepting invitations, and viewing pending invitations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encodeInviteToken } from '@/lib/inviteToken';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  UserInvitation,
  PendingInvitation,
  InvitationDetails,
  InviteUserParams,
  AcceptInvitationResult,
  WorkspaceRole,
} from '@/types/onboarding';

// =====================================================
// Query Keys
// =====================================================

export const invitationKeys = {
  all: ['invitations'] as const,
  workspace: (workspaceId: string) =>
    [...invitationKeys.all, 'workspace', workspaceId] as const,
  pending: (workspaceId: string) =>
    [...invitationKeys.workspace(workspaceId), 'pending'] as const,
  byToken: (token: string) =>
    [...invitationKeys.all, 'token', token] as const,
  myInvitations: () => [...invitationKeys.all, 'my'] as const,
};

// =====================================================
// Query Hooks
// =====================================================

/**
 * Get all pending invitations for a workspace
 */
export function usePendingInvitations(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: invitationKeys.pending(workspaceId ?? ''),
    queryFn: async (): Promise<PendingInvitation[]> => {
      if (!workspaceId) return [];

      const { data, error } = await supabase
        .from('pending_invitations_view')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('invited_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending invitations:', error);
        throw error;
      }

      return (data ?? []) as PendingInvitation[];
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });
}

/**
 * Get all invitations for a workspace (including accepted, expired, revoked)
 */
export function useWorkspaceInvitations(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: invitationKeys.workspace(workspaceId ?? ''),
    queryFn: async (): Promise<UserInvitation[]> => {
      if (!workspaceId) return [];

      const { data, error } = await supabase
        .from('all_invitations_view')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('invited_at', { ascending: false });

      if (error) {
        console.error('Error fetching workspace invitations:', error);
        throw error;
      }

      return (data ?? []) as UserInvitation[];
    },
    enabled: !!workspaceId,
    staleTime: 30000,
  });
}

/**
 * Get invitation details by token (for signup/acceptance page)
 * This is a public query that doesn't require authentication
 */
export function useInvitationByToken(token: string | null | undefined) {
  return useQuery({
    queryKey: invitationKeys.byToken(token ?? ''),
    queryFn: async (): Promise<InvitationDetails | null> => {
      if (!token) return null;

      const { data, error } = await supabase.rpc('get_invitation_by_token', {
        p_token: token,
      });

      if (error) {
        console.error('Error fetching invitation by token:', error);
        throw error;
      }

      return data as InvitationDetails;
    },
    enabled: !!token,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Get invitations sent to current user's email
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: invitationKeys.myInvitations(),
    queryFn: async (): Promise<UserInvitation[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return [];

      const { data, error } = await supabase
        .from('user_invitations') // isolation-ok — intentionally cross-workspace: fetches invites sent to this email before workspace membership exists
        .select('*')
        .eq('email', user.email)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (error) {
        console.error('Error fetching my invitations:', error);
        throw error;
      }

      return (data ?? []) as UserInvitation[];
    },
    staleTime: 30000,
  });
}

// =====================================================
// Mutation Hooks
// =====================================================

/**
 * Send a new invitation
 */
export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: InviteUserParams): Promise<string> => {
      const { data, error } = await supabase.rpc('invite_user', {
        p_email: params.email,
        p_workspace_id: params.workspace_id,
        p_role_code: params.role_code ?? params.app_role ?? 'viewer',
        p_workspace_role: params.workspace_role ?? 'member',
        p_personal_message: params.personal_message ?? null,
      });

      if (error) {
        console.error('Error sending invitation:', error);
        throw error;
      }

      return data as string;
    },
    onSuccess: (_, params) => {
      toast.success('Invitation Sent', {
        description: `An invitation has been sent to ${params.email}`,
      });

      // Invalidate invitation queries
      queryClient.invalidateQueries({
        queryKey: invitationKeys.workspace(params.workspace_id),
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to Send Invitation', {
        description: error.message,
      });
    },
  });
}

/**
 * Revoke an invitation
 */
export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invitationId,
      workspaceId,
    }: {
      invitationId: string;
      workspaceId: string;
    }): Promise<boolean> => {
      const { data, error } = await supabase.rpc('revoke_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) {
        console.error('Error revoking invitation:', error);
        throw error;
      }

      return data as boolean;
    },
    onSuccess: (_, { workspaceId }) => {
      toast.success('Invitation Revoked', {
        description: 'The invitation has been revoked',
      });

      // Invalidate invitation queries
      queryClient.invalidateQueries({
        queryKey: invitationKeys.workspace(workspaceId),
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to Revoke Invitation', {
        description: error.message,
      });
    },
  });
}

/**
 * Accept an invitation
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string): Promise<AcceptInvitationResult> => {
      const { data, error } = await supabase.rpc('accept_invitation', {
        p_token: token,
      });

      if (error) {
        console.error('Error accepting invitation:', error);
        throw error;
      }

      return data as AcceptInvitationResult;
    },
    onSuccess: (result) => {
      toast.success('Invitation Accepted', {
        description: `You have joined ${result.workspace_name}`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: invitationKeys.myInvitations(),
      });
      queryClient.invalidateQueries({
        queryKey: ['user-roles'],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspace-members'],
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to Accept Invitation', {
        description: error.message,
      });
    },
  });
}

/**
 * Resend an invitation (revoke old, create new, send email)
 */
export function useResendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invitationId,
      workspaceId,
      email,
      appRole,
      workspaceRole,
      workspaceName,
    }: {
      invitationId: string;
      workspaceId: string;
      email: string;
      appRole: string;
      workspaceRole: WorkspaceRole;
      workspaceName?: string;
    }): Promise<string> => {
      // Revoke the old invitation only if it's still pending; skip silently otherwise
      // (expired/revoked invitations can't be revoked again, but we still want to resend)
      const { error: revokeError } = await supabase.rpc('revoke_invitation', {
        p_invitation_id: invitationId,
      });
      if (revokeError && !revokeError.message?.includes('not pending')) throw revokeError;

      // Create a fresh invitation
      const { data, error } = await supabase.rpc('invite_user', {
        p_email: email,
        p_workspace_id: workspaceId,
        p_role_code: appRole,
        p_workspace_role: workspaceRole,
        p_personal_message: null,
      });

      if (error) throw error;

      // Fetch the new token so we can send the email
      const { data: invitation } = await supabase
        .from('pending_invitations_view')
        .select('invitation_token')
        .eq('workspace_id', workspaceId)
        .eq('email', email.toLowerCase())
        .order('invited_at', { ascending: false })
        .limit(1)
        .single();

      if (invitation?.invitation_token) {
        await supabase.functions.invoke('invite-user', {
          body: {
            email,
            invitation_token: invitation.invitation_token,
            workspace_name: workspaceName,
          },
        });
      }

      return data as string;
    },
    onSuccess: (_, { email, workspaceId }) => {
      toast.success('Invitation Resent', {
        description: `A new invitation has been sent to ${email}`,
      });

      queryClient.invalidateQueries({
        queryKey: invitationKeys.workspace(workspaceId),
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to Resend Invitation', {
        description: error.message,
      });
    },
  });
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Check if an invitation is expired
 */
export function isInvitationExpired(invitation: UserInvitation | PendingInvitation): boolean {
  return new Date(invitation.expires_at) < new Date();
}

/**
 * Get time remaining until invitation expires
 */
export function getTimeUntilExpiry(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  }

  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
}

/**
 * Build invitation URL (main RouteServe app)
 */
export function buildInvitationUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/invite/${encodeInviteToken(token)}`;
}

/**
 * Build invitation URL for the MOD4 driver app
 */
export function buildMod4InvitationUrl(token: string): string {
  return `https://driverbiko.netlify.app/invite/${encodeInviteToken(token)}`;
}
