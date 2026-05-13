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
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Zap, ZapOff, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { Warehouse, WarehouseFormData } from '@/types/warehouse';
import { STORAGE_CONDITIONS, WAREHOUSE_CAPABILITIES } from '@/types/warehouse';
import { useCreateWarehouse, useUpdateWarehouse, useWarehouses } from '@/hooks/useWarehouses';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

// ─── Warehouse schema (root node) ────────────────────────────────────────────
const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  operating_hours: z.string().optional(),
  total_capacity_m3: z.coerce.number().min(0).optional(),
  is_active: z.boolean().default(true),
});

// ─── Store schema (child node) ───────────────────────────────────────────────
const storeSchema = z.object({
  name: z.string().min(1, 'Store name is required'),
  code: z.string().min(1, 'Store code is required'),
  can_receive: z.boolean().default(true),
  can_dispatch: z.boolean().default(false),
  can_store: z.boolean().default(true),
  storage_conditions: z.array(z.string()).default([]),
  storage_mode: z.enum(['active', 'passive']).default('passive'),
  total_capacity_m3: z.coerce.number().min(0).optional(),
  is_active: z.boolean().default(true),
});

// ─── Inline add-store schema (same shape as storeSchema) ─────────────────────
const inlineStoreSchema = z.object({
  name: z.string().min(1, 'Store name is required'),
  code: z.string().min(1, 'Store code is required'),
  can_receive: z.boolean().default(true),
  can_dispatch: z.boolean().default(false),
  can_store: z.boolean().default(true),
  storage_conditions: z.array(z.string()).default([]),
  storage_mode: z.enum(['active', 'passive']).default('passive'),
  total_capacity_m3: z.coerce.number().min(0).optional(),
});

type WarehouseFormValues = z.infer<typeof warehouseSchema>;
type StoreFormValues = z.infer<typeof storeSchema>;
type InlineStoreValues = z.infer<typeof inlineStoreSchema>;

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse;
  defaultParentId?: string | null;
}

export function WarehouseFormDialog({ open, onOpenChange, warehouse, defaultParentId }: WarehouseFormDialogProps) {
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const isEditing = !!warehouse;
  const isStoreMode = !!defaultParentId || (isEditing && !!warehouse?.parent_id);

  // For store mode: resolve parent warehouse name
  const parentId = defaultParentId || warehouse?.parent_id || null;
  const { data: allWarehousesData } = useWarehouses(undefined, undefined, 500);
  const parentWarehouse = parentId
    ? allWarehousesData?.warehouses.find(w => w.id === parentId)
    : null;

  // Existing stores for the warehouse (edit mode, root only)
  const { data: storesData } = useWarehouses(
    isEditing && !isStoreMode ? { parent_id: warehouse!.id } : undefined,
    undefined,
    100
  );
  const existingStores = storesData?.warehouses || [];

  // Inline add-store state
  const [showAddStore, setShowAddStore] = useState(false);
  // Stores staged for creation (create mode only — flushed after warehouse is saved)
  const [pendingStores, setPendingStores] = useState<InlineStoreValues[]>([]);

  // ─── Warehouse form ──────────────────────────────────────────────────────
  const warehouseForm = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: '', code: '',
      address: '', city: '', state: '', country: '',
      lat: undefined, lng: undefined,
      contact_name: '', contact_phone: '', contact_email: '', operating_hours: '',
      total_capacity_m3: undefined,
      is_active: true,
    },
  });

  // ─── Store form ──────────────────────────────────────────────────────────
  const storeForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '', code: '',
      can_receive: true, can_dispatch: false, can_store: true,
      storage_conditions: [],
      storage_mode: 'passive',
      total_capacity_m3: undefined,
      is_active: true,
    },
  });

  // ─── Inline add-store form ───────────────────────────────────────────────
  const inlineStoreForm = useForm<InlineStoreValues>({
    resolver: zodResolver(inlineStoreSchema),
    defaultValues: {
      name: '', code: '',
      can_receive: true, can_dispatch: false, can_store: true,
      storage_conditions: [],
      storage_mode: 'passive',
      total_capacity_m3: undefined,
    },
  });

  // Reset forms when dialog opens/closes or warehouse changes
  useEffect(() => {
    if (!open) return;

    if (warehouse) {
      if (isStoreMode) {
        storeForm.reset({
          name: warehouse.name,
          code: warehouse.code,
          can_receive: warehouse.capabilities?.can_receive ?? true,
          can_dispatch: warehouse.capabilities?.can_dispatch ?? false,
          can_store: warehouse.capabilities?.can_store ?? true,
          storage_conditions: warehouse.storage_conditions || [],
          storage_mode: warehouse.storage_mode || 'passive',
          total_capacity_m3: warehouse.total_capacity_m3,
          is_active: warehouse.is_active,
        });
      } else {
        warehouseForm.reset({
          name: warehouse.name,
          code: warehouse.code,
          address: warehouse.address || '',
          city: warehouse.city || '',
          state: warehouse.state || '',
          country: warehouse.country || '',
          lat: warehouse.lat,
          lng: warehouse.lng,
          contact_name: warehouse.contact_name || '',
          contact_phone: warehouse.contact_phone || '',
          contact_email: warehouse.contact_email || '',
          operating_hours: warehouse.operating_hours || '',
          total_capacity_m3: warehouse.total_capacity_m3,
          is_active: warehouse.is_active,
        });
      }
    } else {
      if (isStoreMode) {
        storeForm.reset({
          name: '', code: '',
          can_receive: true, can_dispatch: false, can_store: true,
          storage_conditions: [],
          storage_mode: 'passive',
          total_capacity_m3: undefined,
          is_active: true,
        });
      } else {
        warehouseForm.reset({
          name: '', code: '',
          address: '', city: '', state: '', country: '',
          lat: undefined, lng: undefined,
          contact_name: '', contact_phone: '', contact_email: '', operating_hours: '',
          total_capacity_m3: undefined,
          is_active: true,
        });
      }
    }
    setShowAddStore(false);
    setPendingStores([]);
  }, [open, warehouse, isStoreMode]);

  // ─── Total capacity (warehouse form) ────────────────────────────────────
  const watchedWarehouseCapacity = warehouseForm.watch('total_capacity_m3');
  const ownCapacity = Number(watchedWarehouseCapacity) || 0;
  const storesCapacity = existingStores.reduce((sum, s) => sum + (s.total_capacity_m3 || 0), 0);
  const totalCapacity = ownCapacity + storesCapacity;

  // ─── Submit: warehouse ───────────────────────────────────────────────────
  const onSubmitWarehouse = async (values: WarehouseFormValues) => {
    const formData: WarehouseFormData = {
      name: values.name,
      code: values.code,
      parent_id: null,
      storage_mode: 'active',
      capabilities: { can_receive: true, can_dispatch: true, can_store: true },
      storage_conditions: [],
      address: values.address || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      country: values.country || undefined,
      lat: values.lat,
      lng: values.lng,
      contact_name: values.contact_name || undefined,
      contact_phone: values.contact_phone || undefined,
      contact_email: values.contact_email || undefined,
      operating_hours: values.operating_hours || undefined,
      total_capacity_m3: values.total_capacity_m3,
    };
    try {
      if (isEditing && warehouse) {
        await updateWarehouse.mutateAsync({ id: warehouse.id, data: formData });
      } else {
        const newWarehouse = await createWarehouse.mutateAsync(formData);
        // Flush any stores staged during create mode
        if (pendingStores.length > 0 && newWarehouse?.id && workspaceId) {
          for (const store of pendingStores) {
            await supabase.from('warehouses').insert({
              name: store.name,
              code: store.code,
              parent_id: newWarehouse.id,
              storage_mode: store.storage_mode,
              capabilities: {
                can_receive: store.can_receive,
                can_dispatch: store.can_dispatch,
                can_store: store.can_store,
              },
              storage_conditions: store.storage_conditions,
              total_capacity_m3: store.total_capacity_m3 || null,
              workspace_id: workspaceId,
              warehouse_type: 'zonal',
              is_active: true,
            });
          }
          queryClient.invalidateQueries({ queryKey: ['warehouses'] });
        }
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  // ─── Submit: store ───────────────────────────────────────────────────────
  const onSubmitStore = async (values: StoreFormValues) => {
    const formData: WarehouseFormData = {
      name: values.name,
      code: values.code,
      parent_id: parentId,
      storage_mode: values.storage_mode,
      capabilities: {
        can_receive: values.can_receive,
        can_dispatch: values.can_dispatch,
        can_store: values.can_store,
      },
      storage_conditions: values.storage_conditions,
      total_capacity_m3: values.total_capacity_m3,
    };
    try {
      if (isEditing && warehouse) {
        await updateWarehouse.mutateAsync({ id: warehouse.id, data: formData });
      } else {
        await createWarehouse.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  // ─── Submit: inline add-store ─────────────────────────────────────────────
  const onSubmitInlineStore = async (values: InlineStoreValues) => {
    if (isEditing && warehouse) {
      // Edit mode: save immediately as a child warehouse
      const formData: WarehouseFormData = {
        name: values.name,
        code: values.code,
        parent_id: warehouse.id,
        storage_mode: values.storage_mode,
        capabilities: {
          can_receive: values.can_receive,
          can_dispatch: values.can_dispatch,
          can_store: values.can_store,
        },
        storage_conditions: values.storage_conditions,
        total_capacity_m3: values.total_capacity_m3,
      };
      try {
        await createWarehouse.mutateAsync(formData);
      } catch {
        return;
      }
    } else {
      // Create mode: stage for later — flush after parent warehouse is saved
      setPendingStores(prev => [...prev, values]);
    }
    inlineStoreForm.reset();
    setShowAddStore(false);
  };

  const isPending = createWarehouse.isPending || updateWarehouse.isPending;

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const toggleCondition = (
    current: string[],
    value: string,
    setValue: (v: string[]) => void
  ) => {
    if (current.includes(value)) {
      setValue(current.filter(c => c !== value));
    } else {
      setValue([...current, value]);
    }
  };

  const title = isStoreMode
    ? (isEditing ? 'Edit Store' : 'Add Store')
    : (isEditing ? 'Edit Warehouse' : 'Add Warehouse');

  // ─── Store fields (shared between store form and inline add-store) ────────
  const StoreFields = ({
    nameReg, codeReg,
    canReceive, setCanReceive,
    canDispatch, setCanDispatch,
    canStore, setCanStore,
    conditions, setConditions,
    storageMode, setStorageMode,
    capacityReg,
    errors,
    idPrefix = '',
  }: {
    nameReg: any; codeReg: any;
    canReceive: boolean; setCanReceive: (v: boolean) => void;
    canDispatch: boolean; setCanDispatch: (v: boolean) => void;
    canStore: boolean; setCanStore: (v: boolean) => void;
    conditions: string[]; setConditions: (v: string[]) => void;
    storageMode: 'active' | 'passive'; setStorageMode: (v: 'active' | 'passive') => void;
    capacityReg: any;
    errors: any;
    idPrefix?: string;
  }) => (
    <>
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}name`}>Store Name *</Label>
            <Input id={`${idPrefix}name`} {...nameReg} placeholder="e.g., Cold Chain Store" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}code`}>Store Code *</Label>
            <Input id={`${idPrefix}code`} {...codeReg} placeholder="e.g., ST-001" />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Capabilities</h3>
        <div className="space-y-3">
          {WAREHOUSE_CAPABILITIES.map(cap => {
            const checked = cap.key === 'can_receive' ? canReceive : cap.key === 'can_dispatch' ? canDispatch : canStore;
            const setter = cap.key === 'can_receive' ? setCanReceive : cap.key === 'can_dispatch' ? setCanDispatch : setCanStore;
            return (
              <div key={cap.key} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">{cap.label}</Label>
                  <p className="text-xs text-muted-foreground">{cap.description}</p>
                </div>
                <Switch checked={checked} onCheckedChange={setter} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage Conditions */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Storage Conditions</h3>
        <div className="grid grid-cols-2 gap-3">
          {STORAGE_CONDITIONS.map(condition => (
            <div
              key={condition.value}
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => toggleCondition(conditions, condition.value, setConditions)}
            >
              <Checkbox
                checked={conditions.includes(condition.value)}
                onCheckedChange={() => toggleCondition(conditions, condition.value, setConditions)}
              />
              <Badge className={cn('font-normal text-xs', condition.color)}>
                {condition.label}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Mode */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Storage Mode</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors',
              storageMode === 'active' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            )}
            onClick={() => setStorageMode('active')}
          >
            <Zap className={cn('h-4 w-4 mt-0.5 shrink-0', storageMode === 'active' ? 'text-primary' : 'text-muted-foreground')} />
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Can hold inventory</p>
            </div>
          </button>
          <button
            type="button"
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors',
              storageMode === 'passive' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            )}
            onClick={() => setStorageMode('passive')}
          >
            <ZapOff className={cn('h-4 w-4 mt-0.5 shrink-0', storageMode === 'passive' ? 'text-primary' : 'text-muted-foreground')} />
            <div>
              <p className="text-sm font-medium">Passive</p>
              <p className="text-xs text-muted-foreground">Structural only</p>
            </div>
          </button>
        </div>
      </div>

      {/* Capacity */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Capacity</h3>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}capacity`}>Store Capacity (m³)</Label>
          <Input
            id={`${idPrefix}capacity`}
            type="number"
            step="0.01"
            {...capacityReg}
            placeholder="0.00"
          />
        </div>
      </div>
    </>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {isStoreMode ? 'Configure store details' : 'Configure warehouse details'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">

          {/* ── STORE MODE ─────────────────────────────────────────────── */}
          {isStoreMode && (
            <form
              id="warehouse-form"
              onSubmit={storeForm.handleSubmit(onSubmitStore)}
              className="space-y-6 pb-4 pr-3"
            >
              {/* Parent Warehouse (locked) */}
              {parentWarehouse && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground">Parent Warehouse</Label>
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{parentWarehouse.name}</span>
                    <Badge variant="outline" className="font-mono text-xs ml-auto">{parentWarehouse.code}</Badge>
                  </div>
                </div>
              )}

              <StoreFields
                nameReg={storeForm.register('name')}
                codeReg={storeForm.register('code')}
                canReceive={storeForm.watch('can_receive')}
                setCanReceive={v => storeForm.setValue('can_receive', v)}
                canDispatch={storeForm.watch('can_dispatch')}
                setCanDispatch={v => storeForm.setValue('can_dispatch', v)}
                canStore={storeForm.watch('can_store')}
                setCanStore={v => storeForm.setValue('can_store', v)}
                conditions={storeForm.watch('storage_conditions') || []}
                setConditions={v => storeForm.setValue('storage_conditions', v)}
                storageMode={storeForm.watch('storage_mode')}
                setStorageMode={v => storeForm.setValue('storage_mode', v)}
                capacityReg={storeForm.register('total_capacity_m3')}
                errors={storeForm.formState.errors}
                idPrefix="store-"
              />
            </form>
          )}

          {/* ── WAREHOUSE MODE ─────────────────────────────────────────── */}
          {!isStoreMode && (
            <form
              id="warehouse-form"
              onSubmit={warehouseForm.handleSubmit(onSubmitWarehouse)}
              className="space-y-6 pb-4 pr-3"
            >
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wh-name">Name *</Label>
                    <Input id="wh-name" {...warehouseForm.register('name')} placeholder="e.g., Central Warehouse" />
                    {warehouseForm.formState.errors.name && (
                      <p className="text-xs text-destructive">{warehouseForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wh-code">Code *</Label>
                    <Input id="wh-code" {...warehouseForm.register('code')} placeholder="e.g., WH-001" />
                    {warehouseForm.formState.errors.code && (
                      <p className="text-xs text-destructive">{warehouseForm.formState.errors.code.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active Status</Label>
                  <p className="text-xs text-muted-foreground">Inactive warehouses won't appear in selections</p>
                </div>
                <Switch
                  checked={warehouseForm.watch('is_active')}
                  onCheckedChange={v => warehouseForm.setValue('is_active', v)}
                />
              </div>

              <Separator />

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Location</h3>
                <div className="space-y-2">
                  <Label htmlFor="wh-address">Address</Label>
                  <Input id="wh-address" {...warehouseForm.register('address')} placeholder="Street address" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wh-city">City</Label>
                    <Input id="wh-city" {...warehouseForm.register('city')} placeholder="City" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wh-state">State</Label>
                    <Input id="wh-state" {...warehouseForm.register('state')} placeholder="State" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wh-country">Country</Label>
                    <Input id="wh-country" {...warehouseForm.register('country')} placeholder="Country" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wh-lat">Latitude</Label>
                    <Input id="wh-lat" type="number" step="any" {...warehouseForm.register('lat')} placeholder="e.g., 9.0765" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wh-lng">Longitude</Label>
                    <Input id="wh-lng" type="number" step="any" {...warehouseForm.register('lng')} placeholder="e.g., 7.3986" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wh-contact-name">Contact Name</Label>
                    <Input id="wh-contact-name" {...warehouseForm.register('contact_name')} placeholder="Contact person" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wh-contact-phone">Phone</Label>
                    <Input id="wh-contact-phone" {...warehouseForm.register('contact_phone')} placeholder="+234..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wh-contact-email">Email</Label>
                    <Input id="wh-contact-email" type="email" {...warehouseForm.register('contact_email')} placeholder="email@example.com" />
                    {warehouseForm.formState.errors.contact_email && (
                      <p className="text-xs text-destructive">{warehouseForm.formState.errors.contact_email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wh-hours">Operating Hours</Label>
                    <Input id="wh-hours" {...warehouseForm.register('operating_hours')} placeholder="e.g., Mon-Fri 8am-6pm" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stores section (create + edit) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground">Stores</h3>
                    {!isEditing && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stores are sub-nodes of this warehouse. You can add them now or after saving.
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowAddStore(v => !v)}
                  >
                    {showAddStore ? (
                      <><ChevronDown className="h-3.5 w-3.5 mr-1" />Cancel</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5 mr-1" />Add Store</>
                    )}
                  </Button>
                </div>

                {/* Existing stores (edit mode) */}
                {isEditing && existingStores.length > 0 && (
                  <div className="space-y-1.5">
                    {existingStores.map(store => (
                      <div
                        key={store.id}
                        className="flex items-center gap-2 p-2.5 rounded-md bg-muted/30 border text-sm"
                      >
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate flex-1">{store.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{store.code}</Badge>
                        {store.storage_mode === 'active' ? (
                          <Badge className="text-[10px] px-1.5 bg-green-100 text-green-800 gap-1">
                            <Zap className="h-2.5 w-2.5" />Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 gap-1">
                            <ZapOff className="h-2.5 w-2.5" />Passive
                          </Badge>
                        )}
                        {store.total_capacity_m3 && (
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {store.total_capacity_m3.toLocaleString()} m³
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending stores (create mode) */}
                {!isEditing && pendingStores.length > 0 && (
                  <div className="space-y-1.5">
                    {pendingStores.map((store, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2.5 rounded-md bg-muted/30 border text-sm"
                      >
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate flex-1">{store.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{store.code}</Badge>
                        {store.storage_mode === 'active' ? (
                          <Badge className="text-[10px] px-1.5 bg-green-100 text-green-800 gap-1">
                            <Zap className="h-2.5 w-2.5" />Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 gap-1">
                            <ZapOff className="h-2.5 w-2.5" />Passive
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingStores(prev => prev.filter((_, j) => j !== i))}
                          className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add-store form */}
                {showAddStore && (
                  <div className="rounded-lg border-2 border-dashed p-4 space-y-5 bg-muted/20">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Store</p>

                    <StoreFields
                      nameReg={inlineStoreForm.register('name')}
                      codeReg={inlineStoreForm.register('code')}
                      canReceive={inlineStoreForm.watch('can_receive')}
                      setCanReceive={v => inlineStoreForm.setValue('can_receive', v)}
                      canDispatch={inlineStoreForm.watch('can_dispatch')}
                      setCanDispatch={v => inlineStoreForm.setValue('can_dispatch', v)}
                      canStore={inlineStoreForm.watch('can_store')}
                      setCanStore={v => inlineStoreForm.setValue('can_store', v)}
                      conditions={inlineStoreForm.watch('storage_conditions') || []}
                      setConditions={v => inlineStoreForm.setValue('storage_conditions', v)}
                      storageMode={inlineStoreForm.watch('storage_mode')}
                      setStorageMode={v => inlineStoreForm.setValue('storage_mode', v)}
                      capacityReg={inlineStoreForm.register('total_capacity_m3')}
                      errors={inlineStoreForm.formState.errors}
                      idPrefix="inline-"
                    />

                    <Button
                      type="button"
                      size="sm"
                      onClick={inlineStoreForm.handleSubmit(onSubmitInlineStore)}
                      disabled={isEditing && createWarehouse.isPending}
                      className="w-full"
                    >
                      {isEditing && createWarehouse.isPending ? 'Adding...' : 'Add Store'}
                    </Button>
                  </div>
                )}

                {isEditing && existingStores.length === 0 && !showAddStore && (
                  <p className="text-sm text-muted-foreground italic">No stores added yet</p>
                )}
                {!isEditing && pendingStores.length === 0 && !showAddStore && (
                  <p className="text-sm text-muted-foreground italic">No stores added — optional</p>
                )}
              </div>

              <Separator />

              {/* Capacity */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Capacity</h3>
                <div className="space-y-2">
                  <Label htmlFor="wh-capacity">Warehouse Capacity (m³)</Label>
                  <Input
                    id="wh-capacity"
                    type="number"
                    step="0.01"
                    {...warehouseForm.register('total_capacity_m3')}
                    placeholder="0.00"
                  />
                </div>
                {isEditing && (
                  <div className="rounded-md bg-muted/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Warehouse</span>
                      <span className="tabular-nums">{ownCapacity.toLocaleString()} m³</span>
                    </div>
                    {existingStores.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Stores ({existingStores.length})</span>
                        <span className="tabular-nums">{storesCapacity.toLocaleString()} m³</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Total Capacity</span>
                      <span className="text-base font-bold tabular-nums">{totalCapacity.toLocaleString()} m³</span>
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="warehouse-form" disabled={isPending}>
            {isPending ? 'Saving...' : isStoreMode
              ? (isEditing ? 'Update Store' : 'Create Store')
              : (isEditing ? 'Update Warehouse' : 'Create Warehouse')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
