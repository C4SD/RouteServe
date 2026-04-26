import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, AlertTriangle, ChevronDown } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useFacilities } from '@/hooks/useFacilities';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCreateRequisition } from '@/hooks/useRequisitions';
import { useItems } from '@/hooks/useItems';
import { useProgrammeCategories } from '@/hooks/useProgrammeCategories';
import { REQUISITION_PURPOSES, type RequisitionPurpose } from '@/types/requisitions';
import type { Item } from '@/types/items';

const lineItemSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  unit_pack: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  qty_conditional: z.coerce.number().optional(),
  unit_price: z.coerce.number().min(0).optional(),
});

const formSchema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  sriv_number: z.string().optional(),
  warehouse_id: z.string().min(1, 'Warehouse is required'),
  purpose: z.enum(['requisition', 'receive_purchase_items', 'issue_to_loss_register', 'return_expiry', 'issue_to_inter_market'] as const),
  program: z.string().optional(),
  requisition_date: z.string().optional(), // Auto-generated
  required_by_date: z.string().optional(),
  received_from: z.string().optional(),
  issued_to: z.string().optional(),
  notes: z.string().optional(),
  pharmacy_incharge: z.string().optional(),
  facility_incharge: z.string().optional(),
  items: z.array(lineItemSchema).min(1, 'At least one item is required'),
});

type FormValues = z.infer<typeof formSchema>;

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
        item.item_name.toLowerCase().includes(search) ||
        item.product_code?.toLowerCase().includes(search)
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
              <span className="font-medium">{item.item_name}</span>
              {item.unit_pack && (
                <span className="text-muted-foreground ml-2">({item.unit_pack})</span>
              )}
              {item.program && (
                <span className="text-muted-foreground ml-2 text-xs">- {item.program}</span>
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
  onSuccess: () => void;
}

export function ManualEntryForm({ onClose, onSuccess }: ManualEntryFormProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Invalidate queries on mount to ensure fresh data
  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['facilities'] });
    queryClient.invalidateQueries({ queryKey: ['warehouses'] });
  }, [queryClient]);
  
  const { data: facilitiesData, isLoading: facilitiesLoading, error: facilitiesError } = useFacilities();
  const { data: warehousesData, isLoading: warehousesLoading, error: warehousesError } = useWarehouses();
  const { data: itemsData } = useItems();
  const { data: programmeCategories = [] } = useProgrammeCategories();
  const createRequisition = useCreateRequisition();

  const dbItems = itemsData?.items || [];

  const facilities = facilitiesData?.facilities || [];
  const warehouses = warehousesData?.warehouses || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      facility_id: '',
      sriv_number: '',
      warehouse_id: '',
      purpose: 'requisition',
      program: '',
      requisition_date: new Date().toISOString().split('T')[0], // Auto-set to today
      required_by_date: '',
      received_from: '',
      issued_to: '',
      notes: '',
      pharmacy_incharge: '',
      facility_incharge: '',
      items: [{ item_name: '', unit_pack: '', quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const purpose = form.watch('purpose');
  const facilityId = form.watch('facility_id');

  const selectedFacility = facilities.find(f => f.id === facilityId);
  const purposeConfig = REQUISITION_PURPOSES.find(p => p.value === purpose);
  const showConditionalColumn = purpose !== 'requisition';

  const onSubmit = async (values: FormValues) => {
    try {
      await createRequisition.mutateAsync({
        facility_id: values.facility_id,
        warehouse_id: values.warehouse_id,
        priority: 'medium',
        requested_delivery_date: values.required_by_date || values.requisition_date,
        notes: values.notes,
        items: values.items.map(item => ({
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit_pack || 'unit',
          weight_kg: 0,
          volume_m3: 0,
          temperature_required: false,
        })),
      });
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCancel = () => {
    const hasData = form.formState.isDirty;
    if (hasData) {
      setCancelDialogOpen(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      {/* Scrollable Content Region */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <form id="manual-requisition-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Requisition Information Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-muted-foreground">Requisition Information</h3>

            {(facilitiesError || warehousesError) && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {facilitiesError && <div>Failed to load facilities: {facilitiesError.message}</div>}
                {warehousesError && <div>Failed to load warehouses: {warehousesError.message}</div>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Facility */}
              <div className="space-y-2">
                <Label>Facility *</Label>
                <Select
                  key={`facilities-${facilities.length}-${facilitiesLoading}`}
                  value={form.watch('facility_id')}
                  onValueChange={(value) => {
                    form.setValue('facility_id', value);
                    // Auto-fill pharmacy incharge if available
                    const facility = facilities.find(f => f.id === value);
                    if (facility?.contact_name_pharmacy) {
                      form.setValue('pharmacy_incharge', facility.contact_name_pharmacy);
                    }
                  }}
                  disabled={facilitiesLoading}
                >
                  <SelectTrigger className="border-input bg-background">
                    <SelectValue placeholder={facilitiesLoading ? "Loading facilities..." : "Select facility"} />
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {facilities.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No facilities available
                      </div>
                    ) : (
                      facilities.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.facility_id && (
                  <p className="text-xs text-destructive">{form.formState.errors.facility_id.message}</p>
                )}
                {selectedFacility && (
                  <p className="text-xs text-muted-foreground">
                    {[selectedFacility.lga, selectedFacility.address].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>

              {/* SRIV Number */}
              <div className="space-y-2">
                <Label>SRIV No.</Label>
                <Input
                  {...form.register('sriv_number')}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Warehouse */}
              <div className="space-y-2">
                <Label>Warehouse *</Label>
                <Select
                  key={`warehouses-${warehouses.length}-${warehousesLoading}`}
                  value={form.watch('warehouse_id')}
                  onValueChange={(value) => form.setValue('warehouse_id', value)}
                  disabled={warehousesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={warehousesLoading ? "Loading warehouses..." : "Select warehouse"} />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {warehouses.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No warehouses available
                      </div>
                    ) : (
                      warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.warehouse_id && (
                  <p className="text-xs text-destructive">{form.formState.errors.warehouse_id.message}</p>
                )}
              </div>

              {/* Requisition Date */}
              <div className="space-y-2">
                <Label>Requisition Date (auto)</Label>
                <Input
                  type="date"
                  {...form.register('requisition_date')}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Required By Date */}
              <div className="space-y-2">
                <Label>Required By Date (optional)</Label>
                <Input
                  type="date"
                  {...form.register('required_by_date')}
                  placeholder="When do you need this by?"
                />
                <p className="text-xs text-muted-foreground">
                  Delivery scheduling happens in /scheduler
                </p>
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <Label>Purpose *</Label>
              <RadioGroup
                value={purpose}
                onValueChange={(value) => form.setValue('purpose', value as RequisitionPurpose)}
                className="grid grid-cols-2 gap-6"
              >
                {REQUISITION_PURPOSES.map((p) => (
                  <div key={p.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={p.value} id={p.value} />
                    <Label htmlFor={p.value} className="font-normal cursor-pointer">
                      {p.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Program */}
              <div className="space-y-2">
                <Label>Program</Label>
                <Select
                  value={form.watch('program') || ''}
                  onValueChange={(value) => form.setValue('program', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programmeCategories.map((p) => (
                      <SelectItem key={p.id} value={p.code}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Received From / Issued To - conditional */}
              {purpose === 'receive_purchase_items' && (
                <div className="space-y-2">
                  <Label>Received From</Label>
                  <Input
                    {...form.register('received_from')}
                    placeholder="Source of items"
                  />
                </div>
              )}
              {(purpose === 'issue_to_loss_register' || purpose === 'issue_to_inter_market') && (
                <div className="space-y-2">
                  <Label>Issued To</Label>
                  <Input
                    {...form.register('issued_to')}
                    placeholder="Destination"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-4">
            {/* Line Items Header */}
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-muted-foreground">Line Items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ item_name: '', unit_pack: '', quantity: 1, unit_price: 0 })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {/* Scrollable List Container */}
            <div className="border rounded-md max-h-[320px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-8">S/N</TableHead>
                    <TableHead className="min-w-[200px]">Item Description</TableHead>
                    <TableHead>Unit Pack</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    {showConditionalColumn && (
                      <TableHead className="text-right">{purposeConfig?.qtyColumn}</TableHead>
                    )}
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const qty = form.watch(`items.${index}.quantity`) || 0;
                    const price = form.watch(`items.${index}.unit_price`) || 0;
                    const total = qty * price;

                    return (
                      <TableRow key={field.id}>
                        <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                        <TableCell>
                          <ItemAutocompleteInput
                            value={form.watch(`items.${index}.item_name`) || ''}
                            onChange={(val) => form.setValue(`items.${index}.item_name`, val)}
                            onSelect={(item) => {
                              form.setValue(`items.${index}.item_name`, item.item_name);
                              if (item.unit_pack) {
                                form.setValue(`items.${index}.unit_pack`, item.unit_pack);
                              }
                              if (item.unit_price) {
                                form.setValue(`items.${index}.unit_price`, item.unit_price);
                              }
                            }}
                            items={dbItems}
                            placeholder="Start typing to search..."
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            {...form.register(`items.${index}.unit_pack`)}
                            placeholder="e.g., 10/pack"
                            className="h-8 w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            {...form.register(`items.${index}.quantity`)}
                            className="h-8 w-20 text-right"
                          />
                        </TableCell>
                        {showConditionalColumn && (
                          <TableCell>
                            <Input
                              type="number"
                              {...form.register(`items.${index}.qty_conditional`)}
                              className="h-8 w-20 text-right"
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            {...form.register(`items.${index}.unit_price`)}
                            className="h-8 w-24 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => remove(index)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {form.formState.errors.items && (
              <p className="text-xs text-destructive">{form.formState.errors.items.message}</p>
            )}
          </div>

          {/* Summary Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Summary</h3>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                {...form.register('notes')}
                placeholder="Additional notes or instructions..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name of Pharmacy Incharge</Label>
                <Input
                  {...form.register('pharmacy_incharge')}
                  placeholder="Auto-filled from facility"
                />
              </div>
              <div className="space-y-2">
                <Label>Name of Facility Incharge</Label>
                <Input
                  {...form.register('facility_incharge')}
                  placeholder="Auto-filled from facility"
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Fixed Footer */}
      <div className="px-8 py-6 border-t bg-background flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={form.handleSubmit((data) => {
            // Save as draft logic would go here
            console.log('Save draft:', data);
          })}
        >
          Save Draft
        </Button>
        <Button
          type="submit"
          form="manual-requisition-form"
          disabled={createRequisition.isPending}
        >
          {createRequisition.isPending ? 'Creating...' : 'Confirm'}
        </Button>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Discard Changes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to cancel? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>Discard Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
