import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, UserMinus, Shield, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ZoneManagerAssignmentProps {
  zoneId: string;
  zoneName: string;
  currentManagerId?: string | null;
  currentManagerName?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export function ZoneManagerAssignment({
  zoneId,
  zoneName,
  currentManagerId,
  currentManagerName,
  isOpen,
  onClose
}: ZoneManagerAssignmentProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'assign' | 'unassign'>('assign');

  // Fetch eligible users (those with zone_manager role)
  const { data: eligibleUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['zone-manager-users'],
    queryFn: async () => {
      // Get eligible role IDs from the roles table (RBAC v2 codes)
      const { data: roleRows, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .in('code', ['admin', 'fleet_manager', 'ops_manager']);

      if (roleError) throw roleError;
      const roleIds = (roleRows || []).map(r => r.id);
      if (roleIds.length === 0) return [];

      // Get user IDs with those roles
      const { data: userRoleRows, error: urError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role_id', roleIds);

      if (urError) throw urError;
      const userIds = [...new Set((userRoleRows || []).map(r => r.user_id))];
      if (userIds.length === 0) return [];

      // Fetch profiles for those users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profileError) throw profileError;
      return (profiles || []).filter((p): p is Profile => p !== null);
    },
    enabled: isOpen
  });

  // Mutation to assign zone manager
  const assignMutation = useMutation({
    mutationFn: async ({
      userId,
      notes: assignNotes
    }: {
      userId: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('assign_zone_manager', {
        p_zone_id: zoneId,
        p_user_id: userId,
        p_notes: assignNotes || null
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      queryClient.invalidateQueries({ queryKey: ['zone-assignments'] });
      toast.success('Zone Manager Assigned', {
        description: `Successfully assigned zone manager to ${zoneName}`
      });
      handleClose();
    },
    onError: (error) => {
      console.error('Assign error:', error);
      toast.error('Assignment Failed', {
        description: error instanceof Error ? error.message : 'Failed to assign zone manager'
      });
    }
  });

  // Mutation to unassign zone manager
  const unassignMutation = useMutation({
    mutationFn: async (unassignNotes?: string) => {
      const { data, error } = await supabase.rpc('unassign_zone_manager', {
        p_zone_id: zoneId,
        p_notes: unassignNotes || null
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      queryClient.invalidateQueries({ queryKey: ['zone-assignments'] });
      toast.success('Zone Manager Removed', {
        description: `Successfully removed zone manager from ${zoneName}`
      });
      handleClose();
    },
    onError: (error) => {
      console.error('Unassign error:', error);
      toast.error('Removal Failed', {
        description: error instanceof Error ? error.message : 'Failed to remove zone manager'
      });
    }
  });

  const handleAssign = () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    assignMutation.mutate({
      userId: selectedUserId,
      notes: notes || undefined
    });
  };

  const handleUnassign = () => {
    unassignMutation.mutate(notes || undefined);
  };

  const handleClose = () => {
    setSelectedUserId('');
    setNotes('');
    setMode('assign');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Zone Manager Assignment
          </DialogTitle>
          <DialogDescription>
            Manage zone manager for <span className="font-semibold">{zoneName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Manager Info */}
          {currentManagerId && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <Label className="text-sm font-medium">Current Manager</Label>
                  <p className="text-base font-semibold mt-1">
                    {currentManagerName || 'Unknown'}
                  </p>
                </div>
                <Badge variant="default" className="gap-1">
                  <Shield className="h-3 w-3" />
                  Active
                </Badge>
              </div>
            </div>
          )}

          {!currentManagerId && (
            <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/10 p-4">
              <p className="text-sm text-muted-foreground text-center">
                No zone manager currently assigned
              </p>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'assign' ? 'default' : 'outline'}
              onClick={() => setMode('assign')}
              className="flex-1 gap-2"
              size="sm"
            >
              <UserPlus className="h-4 w-4" />
              Assign Manager
            </Button>
            <Button
              variant={mode === 'unassign' ? 'default' : 'outline'}
              onClick={() => setMode('unassign')}
              className="flex-1 gap-2"
              size="sm"
              disabled={!currentManagerId}
            >
              <UserMinus className="h-4 w-4" />
              Remove Manager
            </Button>
          </div>

          {/* Assign Mode */}
          {mode === 'assign' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="zone-manager">Select Zone Manager *</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={loadingUsers}
                >
                  <SelectTrigger id="zone-manager">
                    <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleUsers.map((user) => (
                      <SelectItem
                        key={user.id}
                        value={user.id}
                        disabled={user.id === currentManagerId}
                      >
                        <div className="flex flex-col">
                          <span>{user.full_name || 'Unnamed User'}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    {eligibleUsers.length === 0 && !loadingUsers && (
                      <SelectItem value="none" disabled>
                        No eligible users found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only users with zone_manager or admin role are shown
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assign-notes">Notes (Optional)</Label>
                <Textarea
                  id="assign-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this assignment..."
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Unassign Mode */}
          {mode === 'unassign' && (
            <>
              <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
                <div className="flex gap-3">
                  <UserMinus className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-warning">
                      Remove Zone Manager
                    </h4>
                    <p className="text-sm text-warning mt-1">
                      This will remove <span className="font-semibold">{currentManagerName}</span> as
                      the zone manager for {zoneName}. The zone will have no assigned manager until
                      a new one is assigned.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unassign-notes">Reason for Removal (Optional)</Label>
                <Textarea
                  id="unassign-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Provide a reason for removing the zone manager..."
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={assignMutation.isPending || unassignMutation.isPending}
          >
            Cancel
          </Button>

          {mode === 'assign' ? (
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign Manager'}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleUnassign}
              disabled={unassignMutation.isPending}
            >
              {unassignMutation.isPending ? 'Removing...' : 'Remove Manager'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
