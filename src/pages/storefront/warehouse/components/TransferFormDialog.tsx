import { useState } from 'react';
import { Plus, Trash, ArrowRight } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useNodeInventory } from '@/hooks/useWarehouseInventory';
import { useCreateTransfer } from '@/hooks/useInventoryTransfers';

interface TransferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransferItemRow {
  item_id: string;
  quantity_sent: number;
  description: string;
  serial_number: string;
  available_qty: number;
}

export function TransferFormDialog({ open, onOpenChange }: TransferFormDialogProps) {
  const [fromNodeId, setFromNodeId] = useState<string>('');
  const [toNodeId, setToNodeId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItemRow[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');

  const { data: warehousesData } = useWarehouses({ can_dispatch: true }, undefined, 500);
  const { data: allWarehousesData } = useWarehouses(undefined, undefined, 500);
  const { data: sourceInventory } = useNodeInventory(fromNodeId || undefined);
  const createTransfer = useCreateTransfer();

  const dispatchableNodes = warehousesData?.warehouses || [];
  const allNodes = allWarehousesData?.warehouses || [];

  // Filter destination: exclude source node, only show nodes that can receive
  const receivableNodes = allNodes.filter(
    w => w.id !== fromNodeId && w.capabilities?.can_receive
  );

  // Available items at source (not already added)
  const addedItemIds = new Set(items.map(i => i.item_id));
  const availableItems = (sourceInventory || []).filter(
    inv => !addedItemIds.has(inv.item_id) && inv.available_qty > 0
  );

  const handleAddItem = () => {
    if (!selectedItemId) return;
    const inv = sourceInventory?.find(i => i.item_id === selectedItemId);
    if (!inv) return;

    setItems(prev => [
      ...prev,
      {
        item_id: inv.item_id,
        quantity_sent: 1,
        description: inv.item?.description || 'Unknown',
        serial_number: inv.item?.serial_number || '',
        available_qty: inv.available_qty,
      },
    ]);
    setSelectedItemId('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity_sent: Math.min(Math.max(1, qty), item.available_qty) } : item
      )
    );
  };

  const handleSubmit = async () => {
    if (!fromNodeId || !toNodeId || items.length === 0) return;

    try {
      await createTransfer.mutateAsync({
        fromNodeId,
        toNodeId,
        notes: notes || undefined,
        items: items.map(i => ({ item_id: i.item_id, quantity_sent: i.quantity_sent })),
      });
      // Reset form
      setFromNodeId('');
      setToNodeId('');
      setNotes('');
      setItems([]);
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleReset = () => {
    setFromNodeId('');
    setToNodeId('');
    setNotes('');
    setItems([]);
    setSelectedItemId('');
  };

  const isValid = fromNodeId && toNodeId && items.length > 0 && items.every(i => i.quantity_sent > 0);

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleReset(); onOpenChange(open); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create Inventory Transfer</DialogTitle>
          <DialogDescription className="sr-only">
            Move stock between warehouse nodes
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4 space-y-6 pb-4">
          {/* Route Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Transfer Route</h3>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="space-y-2">
                <Label>Source Node *</Label>
                <Select value={fromNodeId} onValueChange={(v) => { setFromNodeId(v); setItems([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dispatchableNodes.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground mb-2" />

              <div className="space-y-2">
                <Label>Destination Node *</Label>
                <Select value={toNodeId} onValueChange={setToNodeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {receivableNodes.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Items to Transfer</h3>

            {!fromNodeId ? (
              <p className="text-sm text-muted-foreground">Select a source node first</p>
            ) : sourceInventory && sourceInventory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inventory available at source node</p>
            ) : (
              <>
                {/* Add item row */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Add Item</Label>
                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.map(inv => (
                          <SelectItem key={inv.item_id} value={inv.item_id}>
                            {inv.item?.description} ({inv.item?.serial_number}) — {inv.available_qty} available
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddItem}
                    disabled={!selectedItemId}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Item list */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={item.item_id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.serial_number}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            max: {item.available_qty}
                          </Badge>
                          <Input
                            type="number"
                            min={1}
                            max={item.available_qty}
                            value={item.quantity_sent}
                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                            className="w-20 text-center"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add transfer notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createTransfer.isPending}
          >
            {createTransfer.isPending ? 'Creating...' : 'Create Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
