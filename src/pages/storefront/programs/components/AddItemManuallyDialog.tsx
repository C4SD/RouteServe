import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useCreateItem } from '@/hooks/useItems';
import { ITEM_CATEGORIES } from '@/types/items';
import type { ItemCategory } from '@/types/items';
import type { Program } from '@/types/program';

interface AddItemManuallyDialogProps {
  program: Program;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddItemManuallyDialog({
  program,
  open,
  onOpenChange,
}: AddItemManuallyDialogProps) {
  const createItem = useCreateItem();

  const [formData, setFormData] = useState({
    product_code: '',
    item_name: '',
    unit_pack: '',
    category: '' as string,
    stock_on_hand: '',
    unit_price: '',
    batch_number: '',
    expiry_date: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formData.product_code || !formData.item_name || !formData.unit_pack || !formData.category) {
      return;
    }

    createItem.mutate(
      {
        product_code: formData.product_code,
        item_name: formData.item_name,
        unit_pack: formData.unit_pack,
        category: formData.category as ItemCategory,
        program: program.code,
        stock_on_hand: parseInt(formData.stock_on_hand) || 0,
        unit_price: parseFloat(formData.unit_price) || 0,
        batch_number: formData.batch_number || undefined,
        expiry_date: formData.expiry_date || undefined,
      },
      {
        onSuccess: () => {
          setFormData({
            product_code: '',
            item_name: '',
            unit_pack: '',
            category: '',
            stock_on_hand: '',
            unit_price: '',
            batch_number: '',
            expiry_date: '',
          });
          onOpenChange(false);
        },
      }
    );
  };

  const canSubmit =
    formData.product_code &&
    formData.item_name &&
    formData.unit_pack &&
    formData.category &&
    !createItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Add Item to {program.name}</DialogTitle>
          <DialogDescription>
            Create a new item and link it to this program.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Product Code *</Label>
              <Input
                placeholder="e.g., MED-001"
                value={formData.product_code}
                onChange={(e) => handleChange('product_code', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Item Name *</Label>
              <Input
                placeholder="e.g., Paracetamol 500mg"
                value={formData.item_name}
                onChange={(e) => handleChange('item_name', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit Pack *</Label>
              <Input
                placeholder="e.g., Pack of 10"
                value={formData.unit_pack}
                onChange={(e) => handleChange('unit_pack', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => handleChange('category', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stock on Hand</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={formData.stock_on_hand}
                onChange={(e) => handleChange('stock_on_hand', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Price</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={formData.unit_price}
                onChange={(e) => handleChange('unit_price', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Batch Number</Label>
              <Input
                placeholder="Optional"
                value={formData.batch_number}
                onChange={(e) => handleChange('batch_number', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => handleChange('expiry_date', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createItem.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Add Item'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
