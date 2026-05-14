import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import type { Item, ItemCategory, ItemFormData, ItemProgram } from '@/types/items';
import { ITEM_CATEGORIES, ITEM_PROGRAMS } from '@/types/items';
import { useCreateItem, useUpdateItem, useItemCategories } from '@/hooks/useItems';

const itemSchema = z.object({
  product_code: z.string().min(1, 'Product Code is required'),
  item_name: z.string().min(1, 'Item Name is required'),
  unit_pack: z.string().min(1, 'Unit Pack is required'),
  category: z.string().min(1, 'Category is required'), // Use string validation instead of enum
  weight_kg: z.coerce.number().optional(),
  volume_m3: z.coerce.number().optional(),
  programs: z.array(z.enum(ITEM_PROGRAMS as [ItemProgram, ...ItemProgram[]])).optional(),
  // Batch fields (optional)
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
  initial_quantity: z.coerce.number().optional(),
  purchase_price: z.coerce.number().optional(),
  // Legacy fields for backward compatibility
  serial_number: z.string().optional(),
  description: z.string().optional(),
  storage_location: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item;
}

export function ItemFormDialog({ open, onOpenChange, item }: ItemFormDialogProps) {
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const isEditing = !!item;
  
  // Use static categories - simple and reliable
  const availableCategories = ITEM_CATEGORIES;
  const categoriesLoading = false;
  const categoriesError = null;
  
  // Local state for controlled select to avoid re-render loops
  const [selectedCategory, setSelectedCategory] = useState('Tablet');

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      product_code: '',
      item_name: '',
      unit_pack: '',
      category: ITEM_CATEGORIES[0] || 'Tablet', // Use first available category
      weight_kg: undefined,
      volume_m3: undefined,
      programs: [],
      batch_number: '',
      expiry_date: '',
      initial_quantity: undefined,
      purchase_price: undefined,
      // Legacy fields
      serial_number: '',
      description: '',
      storage_location: '',
    },
  });

  useEffect(() => {
    const defaultCategory = ITEM_CATEGORIES[0] || 'Tablet';
    if (item) {
      const formValues = {
        product_code: item.product_code || item.serial_number || '',
        item_name: item.item_name || item.description || '',
        unit_pack: item.unit_pack || '',
        category: item.category,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
        programs: item.program ? [item.program] : [],
        batch_number: item.batch_number || '',
        expiry_date: item.expiry_date || '',
        initial_quantity: item.stock_on_hand,
        purchase_price: item.unit_price,
        // Legacy fields
        serial_number: item.serial_number || '',
        description: item.description || '',
        storage_location: item.store_address || '',
      };
      form.reset(formValues);
      setSelectedCategory(item.category || defaultCategory);
    } else {
      const formValues = {
        product_code: '',
        item_name: '',
        unit_pack: '',
        category: defaultCategory,
        weight_kg: undefined,
        volume_m3: undefined,
        programs: [],
        batch_number: '',
        expiry_date: '',
        initial_quantity: undefined,
        purchase_price: undefined,
        // Legacy fields
        serial_number: '',
        description: '',
        storage_location: '',
      };
      form.reset(formValues);
      setSelectedCategory(defaultCategory);
    }
  }, [item, form]);

  const onSubmit = async (values: ItemFormValues) => {
    // Map to existing ItemFormData for now
    const formData: ItemFormData = {
      product_code: values.product_code,
      item_name: values.item_name,
      unit_pack: values.unit_pack,
      category: values.category,
      program: values.programs?.[0], // Take first program for now
      weight_kg: values.weight_kg,
      volume_m3: values.volume_m3,
      batch_number: values.batch_number,
      expiry_date: values.expiry_date,
      store_address: values.storage_location,
      stock_on_hand: values.initial_quantity || 0,
      unit_price: values.purchase_price || 0,
      // Legacy fields
      serial_number: values.serial_number || values.product_code,
      description: values.description || values.item_name,
    };

    try {
      if (isEditing && item) {
        await updateItem.mutateAsync({ id: item.id, data: formData });
      } else {
        await createItem.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] overflow-hidden rounded-xl shadow-lg flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 bg-background px-8 py-6 border-b">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription>
              Define master data for stock tracking and logistics planning.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10">
          {/* SECTION 1: Product Identity */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Product Identity</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="product_code">Product Code *</Label>
                  <Input
                    id="product_code"
                    {...form.register('product_code')}
                    placeholder="e.g., PAR-001"
                    disabled={isEditing} // Cannot edit product code after creation
                  />
                  {form.formState.errors.product_code && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.product_code.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item_name">Item Name *</Label>
                  <Input
                    id="item_name"
                    {...form.register('item_name')}
                    placeholder="Enter item name"
                  />
                  {form.formState.errors.item_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.item_name.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <select 
                    id="category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      form.setValue('category', e.target.value, { shouldValidate: true });
                    }}
                  >
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.category && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.category.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_pack">Unit Pack *</Label>
                  <Input
                    id="unit_pack"
                    {...form.register('unit_pack')}
                    placeholder="e.g., 10 tablets/pack"
                  />
                  {form.formState.errors.unit_pack && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.unit_pack.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Logistics Attributes */}
          <div className="mt-10 border-t pt-8 space-y-6">
            <h3 className="text-lg font-semibold">Logistics Attributes</h3>
            <p className="text-sm text-muted-foreground">
              Used for route capacity planning and fleet optimization.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="weight_kg">Weight (kg)</Label>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.01"
                  {...form.register('weight_kg')}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="volume_m3">Volume (m³)</Label>
                <Input
                  id="volume_m3"
                  type="number"
                  step="0.0001"
                  {...form.register('volume_m3')}
                  placeholder="0.0000"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Program Association (Optional) */}
          <div className="mt-10 border-t pt-8 space-y-6">
            <h3 className="text-lg font-semibold">Program Association (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              If blank, this item is available across all programs.
            </p>
            
            <div className="space-y-2">
              <Label>Programs</Label>
              <div className="flex flex-wrap gap-2">
                {ITEM_PROGRAMS.map((program) => (
                  <Button
                    key={program}
                    type="button"
                    variant={form.watch('programs')?.includes(program) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const currentPrograms = form.watch('programs') || [];
                      if (currentPrograms.includes(program)) {
                        form.setValue('programs', currentPrograms.filter(p => p !== program));
                      } else {
                        form.setValue('programs', [...currentPrograms, program]);
                      }
                    }}
                  >
                    {program}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: Create Initial Batch (Optional) */}
          <div className="mt-12">
            <Accordion type="single" collapsible className="border-none">
              <AccordionItem value="batch" className="border">
                <AccordionTrigger className="px-0">
                  Create Initial Batch (Optional)
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="batch_number">Batch Number</Label>
                      <Input
                        id="batch_number"
                        {...form.register('batch_number')}
                        placeholder="e.g., BTH-2024-001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expiry_date">Expiry Date</Label>
                      <Input
                        id="expiry_date"
                        type="date"
                        {...form.register('expiry_date')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="initial_quantity">Initial Quantity</Label>
                      <Input
                        id="initial_quantity"
                        type="number"
                        {...form.register('initial_quantity')}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purchase_price">Purchase Price</Label>
                      <Input
                        id="purchase_price"
                        type="number"
                        step="0.01"
                        {...form.register('purchase_price')}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-background border-t px-8 py-4 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="item-form" 
            disabled={isPending || !form.watch('product_code') || !form.watch('item_name') || !form.watch('unit_pack')}
          >
            {isPending ? 'Saving...' : isEditing ? 'Update Item' : 'Create Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
