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
import { Loader2, ChevronDown, MoreHorizontal, Trash2, UserPlus, Search, ShieldOff, ShieldCheck, Crown } from 'lucide-react';

export default function SettingsMembersPage() {
  const { workspaceId, role } = useWorkspace();
  const ability = useAbility({ workspaceId });
  const { data: members = [], isLoading } = useWorkspaceMembersV2(workspaceId);
  const updateRole = useUpdateMemberRoleV2();
  const removeMember = useRemoveWorkspaceMemberV2();
  const toggleStatus = useToggleMemberStatus();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberV2 | null>(null);
  const [memberToToggle, setMemberToToggle] = useState<WorkspaceMemberV2 | null>(null);

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
          existingMemberIds={members.map((m) => m.user_id)}
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
        />
      )}
    </div>
  );
}

// ── Add Member Dialog (RBAC v2 roles) ──────────────────────────────────────

function AddMemberDialogV2({
  workspaceId,
  existingMemberIds,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  existingMemberIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const { data: users = [], isLoading } = useSearchUsersForWorkspace(workspaceId, search);
  const addMember = useAddWorkspaceMemberV2();

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleAdd = async () => {
    if (!selectedUserId) return;

    try {
      await addMember.mutateAsync({
        workspaceId,
        userId: selectedUserId,
        roleCode: selectedRole,
      });

      setSelectedUserId(null);
      setSearch('');
      setSelectedRole('viewer');
      onOpenChange(false);
    } catch {
      // Error toast handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="add-member-description">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription id="add-member-description">
            Search for a user and add them to this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {search.length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Type at least 2 characters to search
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No users found
            </p>
          ) : (
            <div className="max-h-48 overflow-auto border rounded-lg divide-y">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 ${
                    selectedUserId === user.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              ))}
            </div>
          )}

          {selectedUser && (
            <div className="space-y-2">
              <Label>Role</Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedUserId || addMember.isPending}>
            {addMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
