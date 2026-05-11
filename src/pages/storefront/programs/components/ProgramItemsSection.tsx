import { useState, useMemo } from 'react';
import { Plus, X, Search, Package, Upload, Database, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useItems, useUpdateItem } from '@/hooks/useItems';
import { toast } from 'sonner';
import type { Program } from '@/types/program';
import type { Item } from '@/types/items';
import { AddItemManuallyDialog } from './AddItemManuallyDialog';
import { UploadProgramItemsDialog } from './UploadProgramItemsDialog';

interface ProgramItemsSectionProps {
  program: Program;
}

type StockStatus = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

function getStockStatus(stockOnHand: number) {
  if (stockOnHand === 0) {
    return { label: 'Out of Stock', variant: 'destructive' as const, className: 'bg-red-100 text-red-700 border-red-200' };
  }
  if (stockOnHand <= 10) {
    return { label: 'Low Stock', variant: 'outline' as const, className: 'bg-orange-50 text-orange-700 border-orange-200' };
  }
  return { label: 'In Stock', variant: 'outline' as const, className: 'bg-green-50 text-green-700 border-green-200' };
}

export function ProgramItemsSection({ program }: ProgramItemsSectionProps) {
  const [isAddFromDbOpen, setIsAddFromDbOpen] = useState(false);
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockStatus>('all');

  // Fetch items linked to this program
  const { data, isLoading } = useItems({ program: program.code });
  const items = data?.items || [];

  const updateItem = useUpdateItem();

  // Filter items by search and stock status
  const filteredItems = useMemo(() => {
    let result = items;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          (item.item_name || item.description || '').toLowerCase().includes(q) ||
          (item.product_code || item.serial_number || '').toLowerCase().includes(q)
      );
    }

    if (stockFilter === 'in_stock') result = result.filter((i) => i.stock_on_hand > 10);
    if (stockFilter === 'low_stock') result = result.filter((i) => i.stock_on_hand > 0 && i.stock_on_hand <= 10);
    if (stockFilter === 'out_of_stock') result = result.filter((i) => i.stock_on_hand === 0);

    return result;
  }, [items, search, stockFilter]);

  // Stock summary counts
  const stockSummary = useMemo(() => {
    const inStock = items.filter((i) => i.stock_on_hand > 10).length;
    const lowStock = items.filter((i) => i.stock_on_hand > 0 && i.stock_on_hand <= 10).length;
    const outOfStock = items.filter((i) => i.stock_on_hand === 0).length;
    const totalValue = items.reduce((sum, i) => sum + i.stock_on_hand * i.unit_price, 0);
    return { inStock, lowStock, outOfStock, totalValue };
  }, [items]);

  const handleRemove = (item: Item) => {
    updateItem.mutate(
      { id: item.id, data: { program: undefined } },
      {
        onSuccess: () => toast.success(`Removed ${item.item_name || item.description} from ${program.name}`),
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Program Items</h4>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Items
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsAddManualOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Manually
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsAddFromDbOpen(true)}>
              <Database className="h-4 w-4 mr-2" />
              From Items Database
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockStatus)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stock summary bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {stockSummary.inStock} in stock
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            {stockSummary.lowStock} low
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {stockSummary.outOfStock} out
          </span>
          {stockSummary.totalValue > 0 && (
            <span className="ml-auto">
              Total Value: {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(stockSummary.totalValue)}
            </span>
          )}
        </div>
      )}

      {/* Items table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-1">No items linked to this program</p>
          <p className="text-xs text-muted-foreground mb-4">
            Add items manually, upload a file, or select from the items database
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddManualOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Manually
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload File
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAddFromDbOpen(true)}>
              <Database className="h-3.5 w-3.5 mr-1" />
              From Database
            </Button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">
            No items match the current filters
          </p>
        </div>
      ) : (
        <div className="border rounded-lg max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Product Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit Pack</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const status = getStockStatus(item.stock_on_hand);
                const isExpiringSoon = item.expiry_date && (() => {
                  const exp = new Date(item.expiry_date);
                  const now = new Date();
                  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                  return exp <= thirtyDays;
                })();

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">
                      {item.item_name || item.description}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {item.product_code || item.serial_number}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm">{item.category || '—'}</TableCell>
                    <TableCell className="text-sm">{item.unit_pack || '—'}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {item.stock_on_hand.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={`text-xs ${status.className}`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.expiry_date ? (
                        <span className={isExpiringSoon ? 'text-orange-600 flex items-center gap-1' : ''}>
                          {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
                          {new Date(item.expiry_date).toLocaleDateString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemove(item)}
                        disabled={updateItem.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <AddItemManuallyDialog
        program={program}
        open={isAddManualOpen}
        onOpenChange={setIsAddManualOpen}
      />

      <UploadProgramItemsDialog
        program={program}
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
      />

      <AddItemsToProgramDialog
        program={program}
        existingItemIds={items.map((i) => i.id)}
        open={isAddFromDbOpen}
        onOpenChange={setIsAddFromDbOpen}
      />
    </div>
  );
}

// ─── Add Items from Database Dialog ──────────────────────────────────

interface AddItemsToProgramDialogProps {
  program: Program;
  existingItemIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddItemsToProgramDialog({
  program,
  existingItemIds,
  open,
  onOpenChange,
}: AddItemsToProgramDialogProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useItems(
    search ? { search } : undefined,
    0,
    50
  );

  const updateItem = useUpdateItem();

  const availableItems = (data?.items || []).filter(
    (item) => !existingItemIds.includes(item.id)
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    try {
      await Promise.all(
        ids.map((id) =>
          updateItem.mutateAsync({
            id,
            data: { program: program.code },
          })
        )
      );
      toast.success(`Added ${ids.length} item(s) to ${program.name}`);
      setSelected(new Set());
      onOpenChange(false);
    } catch {
      toast.error('Failed to add some items');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Add Items from Database</DialogTitle>
          <DialogDescription>
            Search and select existing items to link to {program.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-auto border rounded-lg min-h-[200px] max-h-[400px]">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : availableItems.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground">
                {search ? 'No matching items found' : 'All items are already linked'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Item Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableItems.map((item) => {
                  const status = getStockStatus(item.stock_on_hand);
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => toggleSelect(item.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {item.item_name || item.description}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {item.product_code || item.serial_number}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm">{item.category || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={status.variant} className={`text-xs ${status.className}`}>
                          {item.stock_on_hand} - {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0 || updateItem.isPending}>
              Add to Program
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
