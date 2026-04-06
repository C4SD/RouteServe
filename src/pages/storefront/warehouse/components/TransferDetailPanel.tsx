import { useState } from 'react';
import { format } from 'date-fns';
import { X, ArrowRight, Send, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { InventoryTransfer, TransferStatus } from '@/types/warehouse';
import { useInventoryTransfer, useDispatchTransfer, useCancelTransfer } from '@/hooks/useInventoryTransfers';
import { ReceiveTransferDialog } from './ReceiveTransferDialog';

interface TransferDetailPanelProps {
  transferId: string;
  onClose: () => void;
}

const STATUS_CONFIG: Record<TransferStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  partial: { label: 'Partial Receipt', color: 'bg-amber-100 text-amber-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

export function TransferDetailPanel({ transferId, onClose }: TransferDetailPanelProps) {
  const { data: transfer, isLoading } = useInventoryTransfer(transferId);
  const dispatchTransfer = useDispatchTransfer();
  const cancelTransfer = useCancelTransfer();
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm');
    } catch {
      return '-';
    }
  };

  const handleDispatch = async () => {
    if (!transfer) return;
    if (!confirm('Dispatch this transfer? Stock will be deducted from the source node.')) return;
    await dispatchTransfer.mutateAsync(transfer.id);
  };

  const handleCancel = async () => {
    if (!transfer) return;
    if (!confirm('Cancel this transfer?')) return;
    await cancelTransfer.mutateAsync(transfer.id);
  };

  if (isLoading || !transfer) {
    return (
      <div className="w-[380px] shrink-0 border-l bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[transfer.status];

  return (
    <>
      <div className="w-[380px] shrink-0 border-l bg-background flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm text-muted-foreground">{transfer.transfer_number}</p>
              <Badge className={cn('mt-1 font-normal', statusCfg.color)}>
                {statusCfg.label}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Route */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Route</h3>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0 text-center">
                  <p className="text-sm font-medium">{transfer.from_warehouse?.name || 'Unknown'}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{transfer.from_warehouse?.code}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 text-center">
                  <p className="text-sm font-medium">{transfer.to_warehouse?.name || 'Unknown'}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{transfer.to_warehouse?.code}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Timeline */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Timeline</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(transfer.created_at)}</span>
                </div>
                {transfer.dispatched_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dispatched</span>
                    <span>{formatDate(transfer.dispatched_at)}</span>
                  </div>
                )}
                {transfer.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span>{formatDate(transfer.completed_at)}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Items ({transfer.items?.length || 0})
              </h3>
              <div className="space-y-2">
                {(transfer.items || []).map(item => {
                  const isFullyReceived = item.quantity_received >= item.quantity_sent;
                  const isPartial = item.quantity_received > 0 && !isFullyReceived;

                  return (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.item?.description || 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{item.item?.serial_number}</p>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Sent</p>
                          <p className="font-semibold tabular-nums">{item.quantity_sent}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Received</p>
                          <p className={cn(
                            'font-semibold tabular-nums',
                            isFullyReceived && 'text-green-600',
                            isPartial && 'text-amber-600',
                          )}>
                            {item.quantity_received}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Variance</p>
                          <p className={cn(
                            'font-semibold tabular-nums',
                            (item.quantity_sent - item.quantity_received) > 0 && 'text-red-600',
                          )}>
                            {item.quantity_sent - item.quantity_received === 0
                              ? '-'
                              : `${item.quantity_sent - item.quantity_received}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            {transfer.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Notes</h3>
                  <p className="text-sm">{transfer.notes}</p>
                </div>
              </>
            )}

            {/* Correlation ID */}
            {transfer.correlation_id && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Correlation ID</p>
                  <p className="text-xs font-mono text-muted-foreground">{transfer.correlation_id}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex-shrink-0 p-4 border-t space-y-2">
          {transfer.status === 'draft' && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={handleCancel}
                disabled={cancelTransfer.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleDispatch}
                disabled={dispatchTransfer.isPending}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {dispatchTransfer.isPending ? 'Dispatching...' : 'Dispatch'}
              </Button>
            </div>
          )}
          {(transfer.status === 'in_transit' || transfer.status === 'partial') && (
            <Button className="w-full" onClick={() => setIsReceiveOpen(true)}>
              <PackageCheck className="h-4 w-4 mr-1.5" />
              Receive Items
            </Button>
          )}
        </div>
      </div>

      {/* Receive Dialog */}
      {isReceiveOpen && (
        <ReceiveTransferDialog
          open={isReceiveOpen}
          onOpenChange={setIsReceiveOpen}
          transfer={transfer}
        />
      )}
    </>
  );
}
