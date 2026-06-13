import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAbilityContext } from '@/rbac/AbilityProvider';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { encodeInviteToken } from '@/lib/inviteToken';
import type { Permission } from '@/rbac/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Permission required to access this route */
  permission?: Permission;
  /** @deprecated Legacy role check — ignored during v2 transition */
  requiredRole?: string;
}

export function ProtectedRoute({
  children,
  permission,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isLoadingWorkspaces } = useWorkspace();
  const { can, isLoading: abilityLoading } = useAbilityContext();
  const location = useLocation();

  // Check if user has a workspace (for onboarding redirect)
  const isOnboardingRoute = location.pathname.startsWith('/onboarding');
  const isProfileCompletionRoute = location.pathname === '/onboarding/profile';
  const isInviteRoute = location.pathname.startsWith('/invite');
  const { data: onboardingStatus, isLoading: onboardingLoading } = useQuery({
    queryKey: ['onboarding-guard-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_onboarding_status');
      if (error) throw error;
      return data as {
        user_id: string;
        onboarding_completed: boolean;
        has_workspace: boolean;
        has_role: boolean;
      };
    },
    enabled: !!user && !isOnboardingRoute && !isProfileCompletionRoute && !isInviteRoute,
    staleTime: 5 * 60 * 1000, // Onboarding status rarely changes — 5 min is safe
  });

  // Check for pending invitations when the user has no workspace.
  // Invited members should be redirected to accept their invitation, not to org onboarding.
  const needsInvitationCheck =
    !!user &&
    !isOnboardingRoute &&
    !isInviteRoute &&
    onboardingStatus &&
    !onboardingStatus.has_workspace &&
    !onboardingStatus.has_role &&
    !onboardingStatus.onboarding_completed;

  const { data: pendingInvitation, isLoading: invitationLoading } = useQuery({
    queryKey: ['pending-invitation-redirect'],
    queryFn: async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) return null;

      const { data, error } = await supabase
        .from('user_invitations')
        .select('invitation_token')
        .eq('email', currentUser.email)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data.invitation_token as string;
    },
    enabled: !!needsInvitationCheck,
    staleTime: 5 * 60 * 1000,
  });

  // Combined loading state
  const isLoading =
    loading ||
    // Only block on workspace loading if we need permission checks (avoids waterfall for regular routes)
    (!!permission && isLoadingWorkspaces) ||
    (!isOnboardingRoute && !isProfileCompletionRoute && !isInviteRoute && onboardingLoading) ||
    (!!needsInvitationCheck && invitationLoading) ||
    (!!permission && abilityLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication
  if (!user) {
    const redirectTo = location.pathname.startsWith('/mod4') ? '/login' : '/auth';
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if user needs onboarding (no workspace yet).
  // Invited members get redirected to accept their invitation instead of org onboarding.
  if (needsInvitationCheck) {
    if (pendingInvitation) {
      return <Navigate to={`/invite/${encodeInviteToken(pendingInvitation)}`} replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  // Permission check via RBAC v2
  if (permission && !can(permission)) {
    return <Navigate to="/fleetops" replace />;
  }

  return <>{children}</>;
}
