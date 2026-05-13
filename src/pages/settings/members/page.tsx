import { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAbility } from '@/rbac/useAbility';
import {
  useWorkspaceMembersV2,
  useUpdateMemberRoleV2,
  useRemoveWorkspaceMemberV2,
  useAddWorkspaceMemberV2,
  useToggleMemberStatus,
  useSearchUsersForWorkspace,
  RBAC_ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  type WorkspaceMemberV2,
} from '@/hooks/settings/useWorkspaceMembers';
import { useInviteUser, useWorkspaceInvitations, useRevokeInvitation } from '@/hooks/useInvitations';
import { supabase } from '@/integrations/supabase/client';
import type { UserInvitation, WorkspaceRole } from '@/types/onboarding';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, ChevronDown, MoreHorizontal, Trash2, UserPlus, Search, ShieldOff, ShieldCheck, Crown, Mail, CheckCircle2, Clock, XCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsMembersPage() {
  const { workspaceId, workspaceName, role } = useWorkspace();
  const ability = useAbility({ workspaceId });
  const { data: members = [], isLoading } = useWorkspaceMembersV2(workspaceId);
  const { data: invitations = [], isLoading: invitationsLoading } = useWorkspaceInvitations(workspaceId);
  const updateRole = useUpdateMemberRoleV2();
  const removeMember = useRemoveWorkspaceMemberV2();
  const toggleStatus = useToggleMemberStatus();
  const revokeInvitation = useRevokeInvitation();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberV2 | null>(null);
  const [memberToToggle, setMemberToToggle] = useState<WorkspaceMemberV2 | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<UserInvitation | null>(null);
  const inviteUser = useInviteUser();

  const canManageMembers = ability.can('workspace.manage');
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const isOwner = (member: WorkspaceMemberV2) => member.role_code === 'owner';

  const handleRoleChange = (userId: string, roleCode: string) => {
    if (!workspaceId) return;
    updateRole.mutate({ workspaceId, userId, roleCode });
  };

  const handleRemove = () => {
    if (!memberToRemove || !workspaceId) return;
    removeMember.mutate({ workspaceId, userId: memberToRemove.user_id });
    setMemberToRemove(null);
  };

  const handleToggleStatus = () => {
    if (!memberToToggle || !workspaceId) return;
    const newStatus = memberToToggle.status === 'active' ? 'inactive' : 'active';
    toggleStatus.mutate({ workspaceId, userId: memberToToggle.user_id, status: newStatus });
    setMemberToToggle(null);
  };

  const handleRevokeInvitation = () => {
    if (!invitationToRevoke || !workspaceId) return;
    revokeInvitation.mutate({ invitationId: invitationToRevoke.id, workspaceId });
    setInvitationToRevoke(null);
  };

  const handleReinvite = async (inv: UserInvitation) => {
    if (!workspaceId) return;
    try {
      await inviteUser.mutateAsync({
        email: inv.email,
        workspace_id: workspaceId,
        role_code: inv.role_code,
        workspace_role: inv.workspace_role as WorkspaceRole,
      });
      // Fetch the new token and send the email
      const { data: pending } = await supabase
        .from('pending_invitations_view')
        .select('invitation_token')
        .eq('workspace_id', workspaceId)
        .eq('email', inv.email.toLowerCase())
        .order('invited_at', { ascending: false })
        .limit(1)
        .single();

      if (pending?.invitation_token) {
        await supabase.functions.invoke('invite-user', {
          body: {
            email: inv.email,
            invitation_token: pending.invitation_token,
            workspace_name: workspaceName,
          },
        });
      }
    } catch {
      // Error toast handled by mutation
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-muted-foreground">
            Manage workspace members and their roles.
          </p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">No members in this workspace</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                {canManageMembers && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const memberIsOwner = isOwner(member);
                return (
                  <TableRow key={member.user_id} className={member.status === 'inactive' ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {memberIsOwner && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        {member.profile.full_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.profile.email || member.profile.phone || '—'}
                    </TableCell>
                    <TableCell>
                      {canManageMembers && !memberIsOwner ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1">
                              <Badge className={ROLE_COLORS[member.role_code] || ROLE_COLORS.viewer} variant="secondary">
                                {ROLE_LABELS[member.role_code] || member.role_code}
                              </Badge>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {RBAC_ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r}
                                onClick={() => handleRoleChange(member.user_id, r)}
                                disabled={r === member.role_code}
                              >
                                <Badge className={ROLE_COLORS[r]} variant="secondary">
                                  {ROLE_LABELS[r]}
                                </Badge>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge className={ROLE_COLORS[member.role_code] || ROLE_COLORS.viewer} variant="secondary">
                          {ROLE_LABELS[member.role_code] || member.role_code}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.status === 'active' ? 'default' : 'outline'}
                        className={
                          member.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-gray-500/10 text-gray-500'
                        }
                      >
                        {member.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    {canManageMembers && (
                      <TableCell>
                        {!memberIsOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setMemberToToggle(member)}>
                                {member.status === 'active' ? (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setMemberToRemove(member)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invitations Section */}
      {canManageMembers && (
        <div className="mt-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Invitations</h2>
            <p className="text-sm text-muted-foreground">Track pending and past invitations sent to this workspace.</p>
          </div>

          {invitationsLoading ? (
            <div className="flex items-center justify-center h-24 border rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-10 border rounded-lg">
              <Mail className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No invitations sent yet</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <InvitationRow
                      key={inv.id}
                      invitation={inv}
                      onRevoke={() => setInvitationToRevoke(inv)}
                      onReinvite={canManageMembers ? () => handleReinvite(inv) : undefined}
                      isReinviting={inviteUser.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Revoke Invitation Confirmation */}
      <AlertDialog open={!!invitationToRevoke} onOpenChange={() => setInvitationToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke the invitation sent to <strong>{invitationToRevoke?.email}</strong>?
              The invite link will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeInvitation}
              className="bg-destructive text-destructive-foreground"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle Status Confirmation */}
      <AlertDialog open={!!memberToToggle} onOpenChange={() => setMemberToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberToToggle?.status === 'active' ? 'Deactivate' : 'Activate'} Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberToToggle?.status === 'active' ? (
                <>
                  Are you sure you want to deactivate <strong>{memberToToggle?.profile.full_name}</strong>?
                  They will immediately lose all access to this workspace and its data.
                </>
              ) : (
                <>
                  Reactivate <strong>{memberToToggle?.profile.full_name}</strong>?
                  They will regain access to this workspace with their current role.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              className={
                memberToToggle?.status === 'active'
                  ? 'bg-destructive text-destructive-foreground'
                  : ''
              }
            >
              {memberToToggle?.status === 'active' ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.profile.full_name}</strong> from this
              workspace? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog */}
      {workspaceId && (
        <AddMemberDialogV2
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
        />
      )}
    </div>
  );
}

// ── Invitation Row ──────────────────────────────────────────────────────────

const INVITATION_STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pending',  className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',   icon: <Clock className="h-3 w-3" /> },
  accepted: { label: 'Accepted', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  expired:  { label: 'Expired',  className: 'bg-gray-500/10 text-gray-500',                          icon: <XCircle className="h-3 w-3" /> },
  revoked:  { label: 'Revoked',  className: 'bg-red-500/10 text-red-600 dark:text-red-400',          icon: <XCircle className="h-3 w-3" /> },
};

function InvitationRow({
  invitation,
  onRevoke,
  onReinvite,
  isReinviting,
}: {
  invitation: UserInvitation;
  onRevoke: () => void;
  onReinvite?: () => void;
  isReinviting?: boolean;
}) {
  const cfg = INVITATION_STATUS_CONFIG[invitation.status] ?? INVITATION_STATUS_CONFIG.pending;
  const isPending = invitation.status === 'pending';
  const isExpired = isPending && new Date(invitation.expires_at) < new Date();
  const canReinvite = !isPending || isExpired; // expired or revoked

  return (
    <TableRow className={!isPending || isExpired ? 'opacity-60' : ''}>
      <TableCell className="font-medium">{invitation.email}</TableCell>
      <TableCell>
        <Badge variant="secondary" className={ROLE_COLORS[invitation.role_code] || ROLE_COLORS.viewer}>
          {ROLE_LABELS[invitation.role_code] || invitation.role_code}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={`flex w-fit items-center gap-1 ${isExpired ? INVITATION_STATUS_CONFIG.expired.className : cfg.className}`}>
          {isExpired ? INVITATION_STATUS_CONFIG.expired.icon : cfg.icon}
          {isExpired ? 'Expired' : cfg.label}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(invitation.invited_at), { addSuffix: true })}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {isPending && !isExpired
          ? formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })
          : '—'}
      </TableCell>
      <TableCell>
        {(isPending && !isExpired) || (canReinvite && onReinvite) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canReinvite && onReinvite && (
                <DropdownMenuItem onClick={onReinvite} disabled={isReinviting}>
                  {isReinviting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Re-invite
                </DropdownMenuItem>
              )}
              {isPending && !isExpired && (
                <DropdownMenuItem className="text-destructive" onClick={onRevoke}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Revoke
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

// ── Add Member Dialog (RBAC v2 roles) ──────────────────────────────────────

function AddMemberDialogV2({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  workspaceName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<'find' | 'invite'>('find');

  // Find User state
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const { data: users = [], isLoading } = useSearchUsersForWorkspace(workspaceId, search);
  const addMember = useAddWorkspaceMemberV2();

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteSent, setInviteSent] = useState(false);
  const inviteUser = useInviteUser();

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const resetAndClose = () => {
    setSearch('');
    setSelectedUserId(null);
    setSelectedRole('viewer');
    setInviteEmail('');
    setInviteRole('viewer');
    setInviteSent(false);
    setTab('find');
    onOpenChange(false);
  };

  const handleAdd = async () => {
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync({ workspaceId, userId: selectedUserId, roleCode: selectedRole });
      resetAndClose();
    } catch {
      // Error toast handled by mutation
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      const invitationId = await inviteUser.mutateAsync({
        email: inviteEmail,
        workspace_id: workspaceId,
        role_code: inviteRole,
        workspace_role: 'member',
      });

      // Fetch token and send email
      const { data: invitation } = await supabase
        .from('pending_invitations_view')
        .select('invitation_token')
        .eq('workspace_id', workspaceId)
        .eq('email', inviteEmail.toLowerCase())
        .order('invited_at', { ascending: false })
        .limit(1)
        .single();

      if (invitation?.invitation_token) {
        await supabase.functions.invoke('invite-user', {
          body: {
            email: inviteEmail,
            invitation_token: invitation.invitation_token,
            workspace_name: workspaceName,
          },
        });
      }

      setInviteSent(true);
    } catch {
      // Error toast handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Find an existing user or invite someone new by email.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'find' | 'invite')} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="find">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Find User
            </TabsTrigger>
            <TabsTrigger value="invite">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Invite by Email
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Find User ── */}
          <TabsContent value="find" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label>Search by name or email</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Amina Hassan"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedUserId(null); }}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            {search.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                Type at least 2 characters to search
              </p>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-muted-foreground">No users found for &quot;{search}&quot;</p>
                <p className="text-xs text-muted-foreground">
                  Not registered yet?{' '}
                  <button
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => { setInviteEmail(search.includes('@') ? search : ''); setTab('invite'); }}
                  >
                    Send an invitation
                  </button>
                </p>
              </div>
            ) : (
              <div className="max-h-48 overflow-auto border rounded-lg divide-y">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedUserId === user.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedUserId(selectedUserId === user.id ? null : user.id)}
                  >
                    <div>
                      <p className="font-medium text-sm">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    {selectedUserId === user.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="space-y-2">
                <Label>Assign Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RBAC_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!selectedUserId || addMember.isPending}>
                {addMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Member
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ── Tab: Invite by Email ── */}
          <TabsContent value="invite" className="space-y-4 pt-3">
            {inviteSent ? (
              <div className="text-center py-6 space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Invitation sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    An invitation email was sent to <strong>{inviteEmail}</strong>.
                    They&apos;ll be added to this workspace after signing up.
                  </p>
                </div>
                <Button onClick={resetAndClose} className="mt-2">Done</Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-9"
                      autoFocus={tab === 'invite'}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RBAC_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The invitee will receive an email with a link to set up their account and join this workspace.
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
                  <Button
                    onClick={handleInvite}
                    disabled={!inviteEmail || inviteUser.isPending}
                  >
                    {inviteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Invitation
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
