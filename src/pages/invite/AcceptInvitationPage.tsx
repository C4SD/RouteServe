/**
 * Accept Invitation Page
 *
 * Landing page for invitation links. Handles:
 * - Displaying invitation details
 * - Redirecting to signup if user doesn't exist
 * - Accepting invitation if user is logged in
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInvitationByToken, useAcceptInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Building2,
  Shield,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: invitation, isLoading, error } = useInvitationByToken(token);
  const acceptInvitation = useAcceptInvitation();
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!token) return;

    try {
      const result = await acceptInvitation.mutateAsync(token);
      setAccepted(true);

      setTimeout(() => {
        navigate('/onboarding/profile', {
          replace: true,
          state: {
            fromInvitation: true,
            workspaceName: result.workspace_name,
            appRole: result.role_code,
            workspaceRole: result.workspace_role,
          },
        });
      }, 2000);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSignUp = () => {
    // Pass invitation token to signup page
    navigate(`/auth?invite=${token}`);
  };

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired invitation
  if (!invitation || !invitation.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Invitation Not Found</AlertTitle>
              <AlertDescription>
                {invitation?.error || 'The invitation may have been revoked or already used.'}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link to="/">Go to Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Successfully accepted
  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <CardTitle>Welcome to {invitation.workspace_name}!</CardTitle>
            <CardDescription>
              Your invitation has been accepted successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Redirecting you to complete your profile...
            </p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto mt-4 text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show invitation details
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a workspace
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Workspace Info */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Workspace</p>
                <p className="font-medium">{invitation.workspace_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Your Role</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">{invitation.role_code.replace('_', ' ')}</Badge>
                  <Badge variant="secondary">{invitation.workspace_role}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Invited By</p>
                <p className="font-medium">{invitation.invited_by_name || 'Workspace Admin'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Expires</p>
                <p className="font-medium">{format(new Date(invitation.expires_at), 'PPp')}</p>
              </div>
            </div>
          </div>

          {/* Personal Message */}
          {invitation.personal_message && (
            <Alert>
              <AlertDescription>
                <p className="text-sm italic">&quot;{invitation.personal_message}&quot;</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Email Notice */}
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              This invitation was sent to <strong>{invitation.email}</strong>
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {user ? (
            // User is logged in - show accept button
            <Button
              onClick={handleAccept}
              disabled={acceptInvitation.isPending}
              className="w-full"
            >
              {acceptInvitation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
          ) : (
            // User is not logged in - show signup/login options
            <>
              <Button onClick={handleSignUp} className="w-full">
                Create Account & Accept
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{' '}
                <Link to={`/auth?invite=${token}`} className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
