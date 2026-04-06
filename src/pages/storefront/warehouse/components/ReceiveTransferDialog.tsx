import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InventoryTransfer } from '@/types/warehouse';
import { useReceiveTransfer } from '@/hooks/useInventoryTransfers';

interface ReceiveTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: InventoryTransfer;
}

export function ReceiveTransferDialog({ open, onOpenChange, transfer }: ReceiveTransferDialogProps) {
  const receiveTransfer = useReceiveTransfer();

  // Initialize with remaining quantities
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    (transfer.items || []).forEach(item => {
      const remaining = item.quantity_sent - item.quantity_received;
      initial[item.item_id] = remaining > 0 ? remaining : 0;
    });
    return initial;
  });

  const handleQuantityChange = (itemId: string, qty: number, maxRemaining: number) => {
    setReceivedQtys(prev => ({
      ...prev,
      [itemId]: Math.min(Math.max(0, qty), maxRemaining),
    }));
  };

  const handleSubmit = async () => {
    const items = Object.entries(receivedQtys)
      .filter(([_, qty]) => qty > 0)
      .map(([item_id, quantity_received]) => ({ item_id, quantity_received }));

    if (items.length === 0) return;

    try {
      await receiveTransfer.mutateAsync({
        transferId: transfer.id,
        items,
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const hasItems = Object.values(receivedQtys).some(q => q > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Transfer Items</DialogTitle>
          <DialogDescription>
            Enter the quantity received for each item. Partial receipt is supported.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {(transfer.items || []).map(item => {
            const remaining = item.quantity_sent - item.quantity_received;
            if (remaining <= 0) {
              return (
                <div key={item.item_id} className="p-3 border rounded-lg opacity-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.item?.description || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.item?.serial_number}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Fully received</Badge>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.item_id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.item?.description || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.item?.serial_number}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground ml-2">
                    <p>Sent: {item.quantity_sent}</p>
                    <p>Already received: {item.quantity_received}</p>
                    <p className="font-medium">Remaining: {remaining}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">Receive qty:</Label>
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    value={receivedQtys[item.item_id] || 0}
                    onChange={(e) => handleQuantityChange(item.item_id, parseInt(e.target.value) || 0, remaining)}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(item.item_id, remaining, remaining)}
                  >
                    All
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasItems || receiveTransfer.isPending}
          >
            {receiveTransfer.isPending ? 'Receiving...' : 'Confirm Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
