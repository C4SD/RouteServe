/**
 * Invite User Dialog
 *
 * Modal dialog for inviting new users to a workspace.
 * Allows setting email, app role, and workspace role.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInviteUser, buildInvitationUrl } from '@/hooks/useInvitations';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WorkspaceRole } from '@/types/onboarding';
import { WORKSPACE_ROLES } from '@/types/onboarding';
interface InviteUserDialogProps {
  workspaceId: string;
  workspaceName?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const APP_ROLES: { value: string; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Full system access across all features' },
  { value: 'ops_manager', label: 'Ops Manager', description: 'Storefront, inventory, and reporting access' },
  { value: 'fleet_manager', label: 'Fleet Manager', description: 'Batch management, fleet operations, and basic reporting' },
  { value: 'driver', label: 'Driver', description: 'Driver-specific delivery operations via Mod4' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to inventory and reports' },
];

export function InviteUserDialog({ workspaceId, workspaceName, trigger, onSuccess }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [appRole, setAppRole] = useState('');
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>('member');
  const [personalMessage, setPersonalMessage] = useState('');

  const inviteUser = useInviteUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !appRole) return;

    try {
      // 1. Create invitation record in DB
      const invitationId = await inviteUser.mutateAsync({
        email,
        workspace_id: workspaceId,
        role_code: appRole,
        workspace_role: workspaceRole,
        personal_message: personalMessage || undefined,
      });

      // 2. Fetch the invitation token directly by ID (avoids JOIN-based RLS issues on the view)
      const { data: invitation } = await supabase
        .from('user_invitations')
        .select('invitation_token')
        .eq('id', invitationId)
        .single();

      if (invitation?.invitation_token) {
        // 3. Send invitation email via Edge Function
        const { error: emailError } = await supabase.functions.invoke('invite-user', {
          body: {
            email,
            invitation_token: invitation.invitation_token,
            workspace_name: workspaceName,
          },
        });

        if (emailError) {
          // Email failed but invitation was created - show link for manual sharing
          const inviteUrl = buildInvitationUrl(invitation.invitation_token);
          toast.warning('Invitation created but email could not be sent', {
            description: 'Copy the invitation link to share manually.',
            action: {
              label: 'Copy Link',
              onClick: () => {
                navigator.clipboard.writeText(inviteUrl);
                toast.success('Link copied to clipboard');
              },
            },
            duration: 10000,
          });
        }
      } else {
        // Token fetch failed — invitation exists in DB but email couldn't be sent
        toast.warning('Invitation created but email could not be sent', {
          description: 'Use Resend from the Invitations list to try again.',
          duration: 10000,
        });
      }

      // Reset form and close dialog
      setEmail('');
      setAppRole('');
      setWorkspaceRole('member');
      setPersonalMessage('');
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setEmail('');
      setAppRole('');
      setWorkspaceRole('member');
      setPersonalMessage('');
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new team member to your workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* App Role */}
            <div className="space-y-2">
              <Label htmlFor="app-role">Application Role *</Label>
              <Select value={appRole} onValueChange={setAppRole}>
                <SelectTrigger id="app-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines what features and actions the user can access.
              </p>
            </div>

            {/* Workspace Role */}
            <div className="space-y-2">
              <Label htmlFor="workspace-role">Workspace Role</Label>
              <Select value={workspaceRole} onValueChange={(v) => setWorkspaceRole(v as WorkspaceRole)}>
                <SelectTrigger id="workspace-role">
                  <SelectValue placeholder="Select workspace access" />
                </SelectTrigger>
                <SelectContent>
                  {WORKSPACE_ROLES.filter((r) => r.value !== 'owner').map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls workspace-level permissions like user management.
              </p>
            </div>

            {/* Personal Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Personal Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal note to your invitation..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email || !appRole || inviteUser.isPending}>
              {inviteUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
