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
import { Loader2, ChevronDown, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  useTransitionInvoiceStatus,
  INVOICE_STATUS_META,
} from '@/hooks/useWorkflowTransitions';

interface InvoiceStatusActionsProps {
  invoiceId: string;
  currentStatus: string;
  invoiceNumber: string;
  onStatusChanged?: (newStatus: string) => void;
}

export function InvoiceStatusActions({
  invoiceId,
  currentStatus,
  invoiceNumber,
  onStatusChanged,
}: InvoiceStatusActionsProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  const transitionStatus = useTransitionInvoiceStatus();

  // Define available transitions based on current status
  const getAvailableStates = (status: string): string[] => {
    switch (status) {
      case 'draft':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['packaging_pending', 'packaged', 'cancelled'];
      case 'packaging_pending':
        return ['packaged', 'cancelled'];
      case 'packaged':
        return ['dispatched', 'cancelled'];
      case 'dispatched':
        return ['completed', 'cancelled'];
      default:
        return []; // Terminal states (completed, cancelled) or unknown
    }
  };

  const availableStates = getAvailableStates(currentStatus);

  const handleSelectStatus = (status: string) => {
    setSelectedStatus(status);
    setShowDialog(true);
  };

  const handleConfirmTransition = async () => {
    if (!selectedStatus) return;

    await transitionStatus.mutateAsync({
      invoiceId,
      newStatus: selectedStatus,
      notes: notes || undefined,
    });

    const transitioned = selectedStatus;
    setShowDialog(false);
    setSelectedStatus(null);
    setNotes('');
    onStatusChanged?.(transitioned);
  };

  const handleCancelDialog = () => {
    setShowDialog(false);
    setSelectedStatus(null);
    setNotes('');
  };

  const currentMeta = INVOICE_STATUS_META[currentStatus as keyof typeof INVOICE_STATUS_META];
  const selectedMeta = selectedStatus
    ? INVOICE_STATUS_META[selectedStatus as keyof typeof INVOICE_STATUS_META]
    : null;

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
            const meta = INVOICE_STATUS_META[status as keyof typeof INVOICE_STATUS_META];
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
              You are about to change the status of invoice {invoiceNumber}
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
            {selectedStatus && ['completed', 'cancelled'].includes(selectedStatus) && (
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDialog} disabled={transitionStatus.isPending}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTransition} disabled={transitionStatus.isPending}>
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
  if (status.includes('completed') || status.includes('packaged') || status.includes('ready')) {
    return CheckCircle2;
  }
  if (status.includes('cancelled')) {
    return XCircle;
  }
  return AlertCircle;
}
