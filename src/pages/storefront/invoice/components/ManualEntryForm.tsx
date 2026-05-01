import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useFacilities } from '@/hooks/useFacilities';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { useItems } from '@/hooks/useItems';
import { usePrograms } from '@/hooks/usePrograms';
import type { ItemCategory, Item } from '@/types/items';
import type { InvoiceFormData } from '@/types/invoice';

const headerSchema = z.object({
  ref_number: z.string().optional(),
  program: z.string().optional(),
  warehouse_id: z.string().min(1, 'Warehouse is required'),
  facility_id: z.string().min(1, 'Facility is required'),
  packaging_required: z.boolean().default(false),
  notes: z.string().optional(),
});

type HeaderValues = z.infer<typeof headerSchema>;

interface LineItem {
  item_id: string | undefined;
  search_text: string;
  description: string;
  quantity: number;
  unit_price: number;
  weight_kg: number | undefined;
  volume_m3: number | undefined;
  category: ItemCategory | undefined;
  batch_number: string | undefined;
  unit_pack: string | undefined;
}

function createEmptyItem(): LineItem {
  return {
    item_id: undefined,
    search_text: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    weight_kg: undefined,
    volume_m3: undefined,
    category: undefined,
    batch_number: undefined,
    unit_pack: undefined,
  };
}

// Autocomplete input for item names with DB suggestions
function ItemAutocompleteInput({
  value,
  onChange,
  onSelect,
  items,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: Item) => void;
  items: Item[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!value || value.length < 1) return [];
    const search = value.toLowerCase();
    return items
      .filter(item =>
        (item.item_name || '').toLowerCase().includes(search) ||
        (item.product_code || '').toLowerCase().includes(search) ||
        (item.description || '').toLowerCase().includes(search)
      )
      .slice(0, 8);
  }, [value, items]);

  const showDropdown = open && suggestions.length > 0;

  useEffect(() => {
    setFocusedIndex(-1);
  }, [suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      onSelect(suggestions[focusedIndex]);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => value && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 z-[9999] mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {suggestions.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer ${
                idx === focusedIndex ? 'bg-accent' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
                setOpen(false);
              }}
            >
              <span className="font-medium">{item.item_name || item.description}</span>
              {item.unit_pack && (
                <span className="text-muted-foreground ml-2">({item.unit_pack})</span>
              )}
              {item.product_code && (
                <span className="text-muted-foreground ml-2 text-xs">- {item.product_code}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ManualEntryFormProps {
  onClose: () => void;
}

export function ManualEntryForm({ onClose }: ManualEntryFormProps) {
  const [items, setItems] = useState<LineItem[]>([createEmptyItem()]);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const createInvoice = useCreateInvoice();
  const queryClient = useQueryClient();

  // Invalidate queries on mount to ensure fresh data
  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['facilities'] });
    queryClient.invalidateQueries({ queryKey: ['warehouses'] });
  }, [queryClient]);

  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const { data: facilitiesData, isLoading: facilitiesLoading } = useFacilities();
  const { data: itemsData } = useItems();
  const { data: programsData } = usePrograms({ status: 'active' });

  const warehouses = warehousesData?.warehouses || [];
  const facilities = facilitiesData?.facilities || [];
  const availableItems = itemsData?.items || [];
  const programs = programsData?.programs || [];

  const form = useForm<HeaderValues>({
    resolver: zodResolver(headerSchema),
    defaultValues: {
      ref_number: '',
      program: '',
      warehouse_id: '',
      facility_id: '',
      packaging_required: false,
      notes: '',
    },
  });

  const handleItemChange = (index: number, field: keyof LineItem, value: string | number | undefined) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // If item_id is being set, auto-populate item data
      if (field === 'item_id' && value) {
        const selectedItem = availableItems.find(item => item.id === value);
        if (selectedItem) {
          updated[index] = {
            ...updated[index],
            item_id: selectedItem.id,
            description: selectedItem.description,
            category: selectedItem.category,
            unit_price: selectedItem.unit_price,
            weight_kg: selectedItem.weight_kg,
            volume_m3: selectedItem.volume_m3,
            batch_number: selectedItem.batch_number,
            unit_pack: selectedItem.unit_pack,
          };
        }
      }
      
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const validItems = items.filter(item => (item.description.trim() || item.search_text.trim()) && item.quantity > 0 && item.unit_price >= 0);

  const totals = {
    count: items.length,
    price: items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    weight: items.reduce((sum, item) => sum + (item.weight_kg || 0), 0),
    volume: items.reduce((sum, item) => sum + (item.volume_m3 || 0), 0),
  };

  const onSubmit = async (header: HeaderValues) => {
    if (validItems.length === 0) return;

    const formData: InvoiceFormData = {
      ref_number: header.ref_number || undefined,
      program: header.program || undefined,
      warehouse_id: header.warehouse_id,
      facility_id: header.facility_id,
      notes: header.notes || undefined,
      items: validItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
        category: item.category,
        batch_number: item.batch_number,
      })),
    };

    try {
      await createInvoice.mutateAsync(formData);
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-8 min-h-full">
      {/* Requisition Information Section */}
      <div className="space-y-6 flex-shrink-0">
        <h3 className="text-sm font-semibold text-muted-foreground">Invoice Details</h3>

        {/* Purpose Group */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="warehouse_id">Source Warehouse *</Label>
            <Select
              value={form.watch('warehouse_id')}
              onValueChange={(value) => form.setValue('warehouse_id', value, { shouldValidate: true })}
              disabled={warehousesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={warehousesLoading ? "Loading warehouses..." : "Select warehouse"} />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {warehouses.map(wh => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name} {wh.code ? `(${wh.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.warehouse_id && (
              <p className="text-xs text-destructive">{form.formState.errors.warehouse_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="facility_id">Destination Facility *</Label>
            <Select
              value={form.watch('facility_id')}
              onValueChange={(value) => form.setValue('facility_id', value, { shouldValidate: true })}
              disabled={facilitiesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={facilitiesLoading ? "Loading facilities..." : "Select facility"} />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                {facilities.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}{f.lga ? ` — ${f.lga}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.facility_id && (
              <p className="text-xs text-destructive">{form.formState.errors.facility_id.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="ref_number">Reference Number</Label>
            <Input
              {...form.register('ref_number')}
              placeholder="Optional reference"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="program">Program</Label>
            <Select
              value={form.watch('program') || ''}
              onValueChange={(value) => form.setValue('program', value === '__none__' ? '' : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select program (optional)" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="__none__">None</SelectItem>
                {programs.map(p => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}{p.code ? ` (${p.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Packaging Required</Label>
            <p className="text-xs text-muted-foreground">Needs packaging before dispatch</p>
          </div>
          <Switch
            checked={form.watch('packaging_required')}
            onCheckedChange={(checked) => form.setValue('packaging_required', checked)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            {...form.register('notes')}
            placeholder="Optional notes..."
            rows={2}
          />
        </div>
      </div>

      {/* Line Items Section */}
      <div className="space-y-4">
        {/* Line Items Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-muted-foreground">Line Items</h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        {/* Line Items Card */}
        <div className="border rounded-lg">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 items-center px-4 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            <div className="col-span-4">Item</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Unit Pack</div>
            <div className="col-span-2">Quantity</div>
            <div className="col-span-1">Price</div>
            <div className="col-span-1">Total</div>
          </div>

          {/* Scrollable Line Items */}
          <div className="max-h-[320px] overflow-y-auto pr-2">
            {items.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No items added. Click "Add Item" to begin.
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {items.map((item, index) => (
                  <div key={index} className="space-y-2">
                    {/* Primary Row: 6 visible columns */}
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-4">
                        <ItemAutocompleteInput
                          value={item.search_text}
                          onChange={(val) => handleItemChange(index, 'search_text', val)}
                          onSelect={(selectedItem) => {
                            setItems(prev => {
                              const updated = [...prev];
                              updated[index] = {
                                ...updated[index],
                                item_id: selectedItem.id,
                                search_text: selectedItem.item_name || selectedItem.description || '',
                                description: selectedItem.description || selectedItem.item_name || '',
                                category: selectedItem.category,
                                unit_price: selectedItem.unit_price,
                                weight_kg: selectedItem.weight_kg,
                                volume_m3: selectedItem.volume_m3,
                                batch_number: selectedItem.batch_number,
                                unit_pack: selectedItem.unit_pack,
                              };
                              return updated;
                            });
                          }}
                          items={availableItems}
                          placeholder="Start typing to search..."
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={item.category || ''}
                          disabled
                          className="h-9 text-sm"
                          placeholder="Category"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={item.unit_pack || ''}
                          disabled
                          className="h-9 text-sm"
                          placeholder="Unit"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                          className="h-9"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          disabled
                          className="h-9 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-1 text-sm font-medium">
                        {(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>
                    
                    {/* Secondary Row: More button and expanded content */}
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-11">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(index)}
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          More
                          {expandedItems.has(index) ? (
                            <ChevronUp className="ml-1 h-3 w-3" />
                          ) : (
                            <ChevronDown className="ml-1 h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="h-9 w-9 p-0"
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Expanded Content: Weight, Volume, Batch */}
                    {expandedItems.has(index) && (
                      <div className="grid grid-cols-12 gap-3 items-center pl-5 pr-7 py-2 bg-muted/30 rounded">
                        <div className="col-span-4">
                          <Input
                            value={item.batch_number || ''}
                            disabled
                            placeholder="Batch Number"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={item.weight_kg || ''}
                            disabled
                            placeholder="Weight (kg)"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.volume_m3 || ''}
                            disabled
                            placeholder="Volume (m³)"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary Footer */}
        {items.length > 0 && (
          <div className="flex justify-between items-center text-sm font-medium pt-4 border-t">
            <div className="flex items-center gap-6">
              <span>{totals.count} item(s)</span>
              {totals.weight > 0 && <span>{totals.weight.toFixed(1)} kg</span>}
              {totals.volume > 0 && <span>{totals.volume.toFixed(2)} m³</span>}
            </div>
            <div className="text-base font-semibold text-foreground">
              Total: {formatCurrency(totals.price)}
            </div>
          </div>
        )}
      </div>

      {/* Form Submit */}
      <form id="manual-invoice-form" onSubmit={form.handleSubmit(onSubmit)} className="hidden">
        {/* Hidden form for submit handling */}
      </form>
    </div>
  );
}
