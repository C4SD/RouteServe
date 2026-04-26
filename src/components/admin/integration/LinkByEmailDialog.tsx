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
import { Mail, Loader2, Link2 } from 'lucide-react';
import { useInviteUser, buildMod4InvitationUrl } from '@/hooks/useInvitations';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

interface LinkByEmailDialogProps {
  workspaceId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function LinkByEmailDialog({ workspaceId, trigger, onSuccess }: LinkByEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { workspaceName } = useWorkspace();

  const inviteUser = useInviteUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      await inviteUser.mutateAsync({
        email,
        workspace_id: workspaceId,
        app_role: 'driver',
        workspace_role: 'member',
      });

      // Fetch the invitation token to send the email
      const { data: invitation } = await supabase
        .from('pending_invitations_view')
        .select('invitation_token')
        .eq('workspace_id', workspaceId)
        .eq('email', email.toLowerCase())
        .order('invited_at', { ascending: false })
        .limit(1)
        .single();

      if (invitation?.invitation_token) {
        const { error: emailError } = await supabase.functions.invoke('invite-user', {
          body: {
            email,
            invitation_token: invitation.invitation_token,
            workspace_name: workspaceName,
            target_app: 'mod4',
          },
        });

        if (emailError) {
          const inviteUrl = buildMod4InvitationUrl(invitation.invitation_token);
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
      }

      setEmail('');
      setOpen(false);
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) setEmail('');
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Mail className="h-4 w-4 mr-2" />
            Link by Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Link User by Email</DialogTitle>
            <DialogDescription>
              Send an invitation to link a user to the Mod4 driver system.
              They will be assigned the driver role automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="link-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="link-email"
                  type="email"
                  placeholder="driver@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The user will receive an email invitation to join as a Mod4 driver.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email || inviteUser.isPending}>
              {inviteUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
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
