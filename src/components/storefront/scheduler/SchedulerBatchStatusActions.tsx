import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Calendar,
  FileEdit,
} from 'lucide-react';
import {
  useTransitionSchedulerBatchStatus,
  SCHEDULER_STATUS_META,
} from '@/hooks/useWorkflowTransitions';
import { usePublishPreBatchToFleetOps } from '@/hooks/usePublishToFleetOps';

interface SchedulerBatchStatusActionsProps {
  batchId: string;
  currentStatus: string;
  batchName: string;
}

export function SchedulerBatchStatusActions({
  batchId,
  currentStatus,
  batchName,
}: SchedulerBatchStatusActionsProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  const transitionStatus = useTransitionSchedulerBatchStatus();
  const publishPreBatch = usePublishPreBatchToFleetOps();

  // Define available transitions based on current status
  const getAvailableStates = (status: string): string[] => {
    switch (status) {
      case 'draft':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['scheduled', 'draft', 'cancelled'];
      case 'scheduled':
        return ['published', 'ready', 'cancelled'];
      default:
        return []; // Terminal states (published, cancelled) or unknown
    }
  };

  const availableStates = getAvailableStates(currentStatus);

  const handleSelectStatus = (status: string) => {
    setSelectedStatus(status);
    setShowDialog(true);
  };

  const handleConfirmTransition = async () => {
    if (!selectedStatus) return;

    if (selectedStatus === 'published') {
      await publishPreBatch.mutateAsync([batchId]);
    } else {
      await transitionStatus.mutateAsync({
        batchId,
        newStatus: selectedStatus,
        notes: notes || undefined,
      });
    }

    setShowDialog(false);
    setSelectedStatus(null);
    setNotes('');
  };

  const handleCancelDialog = () => {
    setShowDialog(false);
    setSelectedStatus(null);
    setNotes('');
  };

  const currentMeta = SCHEDULER_STATUS_META[currentStatus as keyof typeof SCHEDULER_STATUS_META];
  const selectedMeta = selectedStatus
    ? SCHEDULER_STATUS_META[selectedStatus as keyof typeof SCHEDULER_STATUS_META]
    : null;

  // Check if this is a rollback transition
  const isRollback =
    (currentStatus === 'ready' && selectedStatus === 'draft') ||
    (currentStatus === 'scheduled' && selectedStatus === 'ready');

  // If no available states, user can't transition
  if (availableStates.length === 0) {
    return (
      <Badge variant="outline" className="font-normal">
        {currentMeta?.label || currentStatus}
      </Badge>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <span className="mr-2">{currentMeta?.label || currentStatus}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Change Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableStates.map((status) => {
            const meta = SCHEDULER_STATUS_META[status as keyof typeof SCHEDULER_STATUS_META];
            const Icon = getStatusIcon(status);

            return (
              <DropdownMenuItem key={status} onClick={() => handleSelectStatus(status)}>
                <Icon className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="font-medium">{meta?.label || status}</div>
                  <div className="text-xs text-muted-foreground">{meta?.description}</div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              You are about to change the status of batch {batchName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status Transition Visual */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Badge variant="outline">{currentMeta?.label}</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant={selectedStatus?.includes('cancelled') ? 'destructive' : 'default'}>
                {selectedMeta?.label}
              </Badge>
            </div>

            {/* Notes Field */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this status change..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Warning for terminal states */}
            {selectedStatus && ['published', 'cancelled'].includes(selectedStatus) && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Warning</p>
                  <p className="text-muted-foreground">
                    This is a terminal state and cannot be reversed without admin permissions.
                  </p>
                </div>
              </div>
            )}

            {/* Info for rollback states */}
            {isRollback && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Rollback</p>
                  <p className="text-blue-700">
                    This will rollback the batch to {selectedMeta?.label} status for further editing.
                  </p>
                </div>
              </div>
            )}

            {/* Info for publish action */}
            {selectedStatus === 'published' && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Send className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-900">Publish to FleetOps</p>
                  <p className="text-green-700">
                    This will publish the batch to FleetOps for driver assignment and dispatch.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDialog} disabled={transitionStatus.isPending || publishPreBatch.isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTransition} disabled={transitionStatus.isPending || publishPreBatch.isPending}>
              {transitionStatus.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getStatusIcon(status: string) {
  if (status === 'draft') {
    return FileEdit;
  }
  if (status === 'ready') {
    return CheckCircle2;
  }
  if (status === 'scheduled') {
    return Calendar;
  }
  if (status === 'published') {
    return Send;
  }
  if (status === 'cancelled') {
    return XCircle;
  }
  return AlertCircle;
}
