import { useState } from 'react';
import { format } from 'date-fns';
import {
  X, Edit, MapPin, Phone, Mail, Clock, Package, ArrowUpRight, ArrowDownRight,
  Activity, ChevronRight, ArrowDownToLine, ArrowUpFromLine, Database, Plus,
  Zap, ZapOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Warehouse } from '@/types/warehouse';
import { STORAGE_ZONE_TYPES, STORAGE_CONDITIONS, WAREHOUSE_CAPABILITIES } from '@/types/warehouse';
import { useWarehouseInventory, useWarehouses, useActivateWarehouse, useDeactivateWarehouse } from '@/hooks/useWarehouses';
import { useNodeInventory } from '@/hooks/useWarehouseInventory';

interface WarehouseDetailPanelProps {
  warehouse: Warehouse;
  onClose: () => void;
  onEdit: () => void;
  onSelectWarehouse?: (id: string) => void;
  onAddStore?: (parentId: string) => void;
}

export function WarehouseDetailPanel({ warehouse, onClose, onEdit, onSelectWarehouse, onAddStore }: WarehouseDetailPanelProps) {
  const [confirmingActivation, setConfirmingActivation] = useState(false);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
  const { data: inventoryData } = useWarehouseInventory(warehouse.id);
  const { data: nodeInventory } = useNodeInventory(warehouse.id);
  const { data: allWarehousesData } = useWarehouses(undefined, undefined, 500);
  const activateWarehouse = useActivateWarehouse();
  const deactivateWarehouse = useDeactivateWarehouse();

  const handleActivate = async () => {
    await activateWarehouse.mutateAsync(warehouse.id);
    setConfirmingActivation(false);
  };

  const handleDeactivate = async () => {
    await deactivateWarehouse.mutateAsync(warehouse.id);
    setConfirmingDeactivation(false);
  };

  const allWarehouses = allWarehousesData?.warehouses || [];

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return '-';
    }
  };

  const getUtilization = () => {
    if (!warehouse.total_capacity_m3 || warehouse.total_capacity_m3 === 0) return 0;
    return ((warehouse.used_capacity_m3 || 0) / warehouse.total_capacity_m3) * 100;
  };

  const utilization = getUtilization();
  const usedCapacity = warehouse.used_capacity_m3 || 0;
  const totalCapacity = warehouse.total_capacity_m3 || 0;
  const availableCapacity = totalCapacity - usedCapacity;

  const getUtilizationColor = (pct: number) => {
    if (pct > 80) return { text: 'text-red-600', bar: '[&>div]:bg-red-500', bg: 'bg-red-50', label: 'Congested' };
    if (pct > 50) return { text: 'text-amber-600', bar: '[&>div]:bg-amber-500', bg: 'bg-amber-50', label: 'Monitor' };
    return { text: 'text-green-600', bar: '[&>div]:bg-green-500', bg: 'bg-green-50', label: 'Available' };
  };

  const colorConfig = getUtilizationColor(utilization);

  const getZoneTypeConfig = (type: string) => {
    return STORAGE_ZONE_TYPES.find(z => z.value === type) || STORAGE_ZONE_TYPES[4];
  };

  // Build ancestor breadcrumb
  const getAncestors = (): Warehouse[] => {
    const ancestors: Warehouse[] = [];
    let currentId = warehouse.parent_id;
    while (currentId) {
      const parent = allWarehouses.find(w => w.id === currentId);
      if (!parent) break;
      ancestors.unshift(parent);
      currentId = parent.parent_id;
    }
    return ancestors;
  };

  // Get direct children
  const getChildren = () => {
    return allWarehouses.filter(w => w.parent_id === warehouse.id);
  };

  const ancestors = getAncestors();
  const children = getChildren();

  // Store-specific computed values
  const isRootWarehouse = !warehouse.parent_id;
  const stores = children; // children of a root warehouse are stores
  const storesCapacity = stores.reduce((sum, s) => sum + (s.total_capacity_m3 || 0), 0);
  const warehouseOwnCapacity = warehouse.total_capacity_m3 || 0;
  const combinedTotalCapacity = isRootWarehouse ? warehouseOwnCapacity + storesCapacity : totalCapacity;

  // Capability display
  const capabilityConfig = [
    { key: 'can_receive' as const, label: 'Receive', icon: ArrowDownToLine, color: 'bg-blue-100 text-blue-700' },
    { key: 'can_dispatch' as const, label: 'Dispatch', icon: ArrowUpFromLine, color: 'bg-orange-100 text-orange-700' },
    { key: 'can_store' as const, label: 'Store', icon: Database, color: 'bg-green-100 text-green-700' },
  ];

  const getConditionConfig = (value: string) => {
    return STORAGE_CONDITIONS.find(c => c.value === value);
  };

  // Placeholder supply flow data
  const inbound = 0;
  const outbound = 0;
  const netFlow = inbound - outbound;

  return (
    <div className="w-[340px] shrink-0 border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{warehouse.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="font-mono">{warehouse.code}</Badge>
              {warehouse.storage_mode === 'active' ? (
                <Badge className="bg-green-100 text-green-800 gap-1">
                  <Zap className="h-3 w-3" />
                  Active Storage
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <ZapOff className="h-3 w-3" />
                  Passive
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Hierarchy Breadcrumb */}
          {(ancestors.length > 0 || children.length > 0) && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Hierarchy</h3>

                {/* Ancestors */}
                {ancestors.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap text-sm">
                    {ancestors.map((ancestor, i) => (
                      <span key={ancestor.id} className="flex items-center gap-1">
                        <button
                          className="text-primary hover:underline cursor-pointer"
                          onClick={() => onSelectWarehouse?.(ancestor.id)}
                        >
                          {ancestor.name}
                        </button>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </span>
                    ))}
                    <span className="font-medium">{warehouse.name}</span>
                  </div>
                )}

                {/* Children */}
                {children.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{children.length} sub-node{children.length !== 1 ? 's' : ''}</p>
                    <div className="space-y-1">
                      {children.map(child => (
                        <button
                          key={child.id}
                          className="flex items-center gap-2 w-full text-left p-2 rounded-md hover:bg-muted/50 text-sm transition-colors"
                          onClick={() => onSelectWarehouse?.(child.id)}
                        >
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{child.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono ml-auto">{child.code}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Capabilities */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {capabilityConfig.map(cap => {
                const enabled = warehouse.capabilities?.[cap.key] ?? false;
                const Icon = cap.icon;
                return (
                  <Badge
                    key={cap.key}
                    className={cn(
                      'gap-1 font-normal text-xs',
                      enabled ? cap.color : 'bg-muted text-muted-foreground line-through'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {cap.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Storage Conditions */}
          {warehouse.storage_conditions && warehouse.storage_conditions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Storage Conditions</h3>
                <div className="flex flex-wrap gap-2">
                  {warehouse.storage_conditions.map(condition => {
                    const config = getConditionConfig(condition);
                    return (
                      <Badge key={condition} className={cn('font-normal text-xs', config?.color || 'bg-muted')}>
                        {config?.label || condition}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Stores Section (root warehouses only) */}
          {isRootWarehouse && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Stores</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onAddStore?.(warehouse.id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Store
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stores are internal storage units within a warehouse (e.g. cold chain, infusion, quarantine)
                </p>
                {stores.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No stores added</p>
                ) : (
                  <div className="space-y-2">
                    {stores.map(store => (
                      <button
                        key={store.id}
                        className="flex items-start gap-2 w-full text-left p-2.5 rounded-md hover:bg-muted/50 border transition-colors"
                        onClick={() => onSelectWarehouse?.(store.id)}
                      >
                        <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{store.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {store.storage_mode === 'active' ? (
                                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Passive</Badge>
                              )}
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {store.total_capacity_m3 ? `${store.total_capacity_m3.toLocaleString()} m³` : '—'}
                              </span>
                            </div>
                          </div>
                          {store.storage_conditions && store.storage_conditions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {store.storage_conditions.map(condition => {
                                const config = getConditionConfig(condition);
                                return (
                                  <Badge key={condition} className={cn('font-normal text-[10px] px-1.5 py-0', config?.color || 'bg-muted')}>
                                    {config?.label || condition}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Capacity Utilization */}
          {isRootWarehouse && stores.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Capacity</h3>
                <Badge variant="outline" className={cn('text-xs', colorConfig.text, colorConfig.bg)}>
                  {colorConfig.label}
                </Badge>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                {/* Warehouse Own Capacity */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Warehouse Capacity</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {warehouseOwnCapacity.toLocaleString()} m³
                  </span>
                </div>

                {/* Stores Capacity Breakdown */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Stores Capacity</span>
                  <div className="pl-3 space-y-1 border-l-2 border-muted">
                    {stores.map(store => (
                      <div key={store.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate">{store.name}</span>
                        <span className="tabular-nums ml-2">
                          {(store.total_capacity_m3 || 0).toLocaleString()} m³
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Subtotal</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {storesCapacity.toLocaleString()} m³
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Total Capacity (computed) */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Total Capacity</span>
                  <span className="text-lg font-bold tabular-nums">
                    {combinedTotalCapacity.toLocaleString()} m³
                  </span>
                </div>

                {/* Utilization bar */}
                {combinedTotalCapacity > 0 && (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className={cn('text-2xl font-bold tabular-nums', colorConfig.text)}>
                        {(combinedTotalCapacity > 0 ? (usedCapacity / combinedTotalCapacity) * 100 : 0).toFixed(1)}%
                      </span>
                      <span className="text-xs text-muted-foreground">utilization</span>
                    </div>
                    <Progress
                      value={combinedTotalCapacity > 0 ? (usedCapacity / combinedTotalCapacity) * 100 : 0}
                      className={cn('h-3 rounded-full', colorConfig.bar)}
                    />
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-background rounded-md border">
                    <p className="text-xs text-muted-foreground">Used</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {usedCapacity.toLocaleString()} m³
                    </p>
                  </div>
                  <div className="p-2.5 bg-background rounded-md border">
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="text-sm font-semibold tabular-nums text-green-600">
                      {(combinedTotalCapacity - usedCapacity).toLocaleString()} m³
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Capacity Utilization</h3>
                <Badge variant="outline" className={cn('text-xs', colorConfig.text, colorConfig.bg)}>
                  {colorConfig.label}
                </Badge>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className={cn('text-3xl font-bold tabular-nums', colorConfig.text)}>
                    {utilization.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    of {totalCapacity.toLocaleString()} m³
                  </span>
                </div>
                <Progress
                  value={utilization}
                  className={cn('h-3 rounded-full', colorConfig.bar)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-background rounded-md border">
                    <p className="text-xs text-muted-foreground">Used</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {usedCapacity.toLocaleString()} m³
                    </p>
                  </div>
                  <div className="p-2.5 bg-background rounded-md border">
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="text-sm font-semibold tabular-nums text-green-600">
                      {availableCapacity.toLocaleString()} m³
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Supply Flow */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Supply Flow (Today)</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 bg-muted/50 rounded-md text-center">
                <ArrowDownRight className="h-3.5 w-3.5 text-blue-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Inbound</p>
                <p className="text-sm font-semibold tabular-nums">{inbound.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-muted/50 rounded-md text-center">
                <ArrowUpRight className="h-3.5 w-3.5 text-orange-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Outbound</p>
                <p className="text-sm font-semibold tabular-nums">{outbound.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-muted/50 rounded-md text-center">
                <Activity className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Net</p>
                <p className={cn(
                  'text-sm font-semibold tabular-nums',
                  netFlow > 0 && 'text-blue-600',
                  netFlow < 0 && 'text-orange-600'
                )}>
                  {netFlow > 0 ? '+' : ''}{netFlow.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Storage Zones */}
          {warehouse.storage_zones && warehouse.storage_zones.length > 0 && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Zone Distribution</h3>
                <div className="space-y-2">
                  {warehouse.storage_zones.map((zone, index) => {
                    const config = getZoneTypeConfig(zone.type);
                    const zoneUtilization = zone.capacity_m3 > 0
                      ? (zone.used_m3 / zone.capacity_m3) * 100
                      : 0;
                    const zoneColor = getUtilizationColor(zoneUtilization);

                    return (
                      <div key={zone.id || index} className="p-2.5 border rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Badge className={cn('font-normal text-xs px-1.5 py-0', config.color)}>
                              {config.label}
                            </Badge>
                            <span className="text-xs font-medium truncate">{zone.name}</span>
                          </div>
                          <span className={cn('text-xs font-semibold tabular-nums', zoneColor.text)}>
                            {zoneUtilization.toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={zoneUtilization} className={cn('h-1.5', zoneColor.bar)} />
                        <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                          <span>{zone.used_m3.toLocaleString()} / {zone.capacity_m3.toLocaleString()} m³</span>
                          {zone.temp_range && <span>{zone.temp_range}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Location */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Location</h3>
            {warehouse.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm">{warehouse.address}</p>
                  {(warehouse.city || warehouse.state) && (
                    <p className="text-sm text-muted-foreground">
                      {[warehouse.city, warehouse.state, warehouse.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}
            {warehouse.lat && warehouse.lng && (
              <p className="text-xs text-muted-foreground font-mono">
                {warehouse.lat.toFixed(6)}, {warehouse.lng.toFixed(6)}
              </p>
            )}
          </div>

          <Separator />

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Contact</h3>
            {warehouse.contact_name && (
              <p className="text-sm font-medium">{warehouse.contact_name}</p>
            )}
            {warehouse.contact_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{warehouse.contact_phone}</span>
              </div>
            )}
            {warehouse.contact_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{warehouse.contact_email}</span>
              </div>
            )}
            {warehouse.operating_hours && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{warehouse.operating_hours}</span>
              </div>
            )}
            {!warehouse.contact_name && !warehouse.contact_phone && !warehouse.contact_email && (
              <p className="text-sm text-muted-foreground">No contact information</p>
            )}
          </div>

          {/* Node Inventory */}
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Inventory</h3>

            {warehouse.storage_mode === 'passive' ? (
              /* Passive node — show activation prompt */
              <div className="rounded-lg border border-dashed p-4 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ZapOff className="h-4 w-4 shrink-0" />
                  <p className="text-sm">This node does not hold inventory.</p>
                </div>

                {confirmingActivation ? (
                  <div className="space-y-2 rounded-md bg-muted/50 p-3">
                    <p className="text-xs font-medium">Activate storage for this node?</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Stock will start at 0</li>
                      <li>You must add stock manually</li>
                    </ul>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleActivate}
                        disabled={activateWarehouse.isPending}
                      >
                        {activateWarehouse.isPending ? 'Activating...' : 'Confirm'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setConfirmingActivation(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConfirmingActivation(true)}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Activate Storage
                  </Button>
                )}
              </div>
            ) : (
              /* Active node — show inventory table */
              <>
                {nodeInventory && nodeInventory.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      <span>Item</span>
                      <span className="text-right">Reserved</span>
                      <span className="text-right">Available</span>
                    </div>
                    {nodeInventory.slice(0, 5).map(inv => (
                      <div key={inv.id} className="p-2.5 border rounded-lg">
                        <div className="grid grid-cols-3 gap-2 items-center">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{inv.item?.description || 'Unknown item'}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{inv.item?.serial_number}</p>
                          </div>
                          <p className="text-sm tabular-nums text-right text-amber-600">{inv.reserved_qty}</p>
                          <p className="text-sm font-semibold tabular-nums text-right text-green-600">{inv.available_qty}</p>
                        </div>
                      </div>
                    ))}
                    {nodeInventory.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{nodeInventory.length - 5} more items
                      </p>
                    )}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">No items at this node</p>
                        <p className="text-lg font-bold tabular-nums">0</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Deactivate option */}
                {(nodeInventory?.length === 0 || !nodeInventory) && (
                  confirmingDeactivation ? (
                    <div className="space-y-2 rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-medium">Set this node to passive (structural only)?</p>
                      <p className="text-xs text-muted-foreground">It will no longer hold inventory.</p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={handleDeactivate}
                          disabled={deactivateWarehouse.isPending}
                        >
                          {deactivateWarehouse.isPending ? 'Deactivating...' : 'Confirm'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setConfirmingDeactivation(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setConfirmingDeactivation(true)}
                    >
                      <ZapOff className="h-3 w-3 mr-1" />
                      Set as Passive
                    </Button>
                  )
                )}
              </>
            )}
          </div>

          {/* Dates */}
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p>{formatDate(warehouse.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p>{formatDate(warehouse.updated_at)}</p>
              </div>
              {warehouse.activated_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Storage Activated</p>
                  <p>{formatDate(warehouse.activated_at)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex-shrink-0 p-4 border-t">
        <Button onClick={onEdit} className="w-full">
          <Edit className="h-4 w-4 mr-2" />
          {warehouse.parent_id ? 'Edit Store' : 'Edit Warehouse'}
        </Button>
      </div>
    </div>
  );
}
