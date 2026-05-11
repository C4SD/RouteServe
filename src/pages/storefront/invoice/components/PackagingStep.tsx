import { useState, useMemo } from 'react';
import {
  Package,
  ShoppingBag,
  Box as BoxIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Check,
  ArrowRight,
  Loader2,
  Scale,
  Boxes,
  LayoutGrid,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PackageTypeName = 'Carton' | 'Kit / Bag' | 'Box';
export type SizeName = 'S' | 'M' | 'L' | 'XL';

export interface PackagingRow {
  id: string;
  type: PackageTypeName;
  size: SizeName;
  unit_weight: number;
  quantity: number;
}

export interface PackagingTotals {
  totalPackages: number;
  totalWeight: number;
  totalVolume: number;
  totalSlots: number;
}

export interface InvoiceDisplayContext {
  sourceWarehouseName?: string;
  sourceWarehouseCode?: string;
  destinationFacilityName?: string;
  destinationFacilityCode?: string;
  program?: string;
  referenceNumber?: string;
  createdBy?: string;
}

// ─── Hardcoded size definitions ───────────────────────────────────────────────

interface SizeDef {
  l: number;
  w: number;
  h: number;
  default_unit_weight: number;
  slot_cost: number;
}

export const SIZE_DEFS: Record<PackageTypeName, Record<SizeName, SizeDef>> = {
  Carton: {
    S:  { l: 40,  w: 30,  h: 30,  default_unit_weight: 3,  slot_cost: 0.25 },
    M:  { l: 60,  w: 40,  h: 30,  default_unit_weight: 10, slot_cost: 0.5  },
    L:  { l: 80,  w: 60,  h: 40,  default_unit_weight: 20, slot_cost: 1.0  },
    XL: { l: 100, w: 80,  h: 60,  default_unit_weight: 40, slot_cost: 2.0  },
  },
  'Kit / Bag': {
    S:  { l: 30,  w: 20,  h: 20,  default_unit_weight: 2,  slot_cost: 0.25 },
    M:  { l: 60,  w: 40,  h: 30,  default_unit_weight: 8,  slot_cost: 0.5  },
    L:  { l: 80,  w: 50,  h: 40,  default_unit_weight: 15, slot_cost: 1.0  },
    XL: { l: 100, w: 70,  h: 50,  default_unit_weight: 25, slot_cost: 2.0  },
  },
  Box: {
    S:  { l: 30,  w: 30,  h: 30,  default_unit_weight: 3,  slot_cost: 0.25 },
    M:  { l: 50,  w: 50,  h: 50,  default_unit_weight: 7,  slot_cost: 0.5  },
    L:  { l: 70,  w: 70,  h: 70,  default_unit_weight: 15, slot_cost: 1.0  },
    XL: { l: 100, w: 100, h: 100, default_unit_weight: 30, slot_cost: 2.0  },
  },
};

export const SIZES: SizeName[] = ['S', 'M', 'L', 'XL'];

export const PACKAGE_TYPE_CONFIG: Record<
  PackageTypeName,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    iconColor: string;
    subtitle: string;
  }
> = {
  Carton:    { icon: Package,     color: 'bg-amber-50',  iconColor: 'text-amber-600', subtitle: 'Corrugated box' },
  'Kit / Bag': { icon: ShoppingBag, color: 'bg-rose-50',   iconColor: 'text-rose-600',  subtitle: 'Soft bag / kit' },
  Box:       { icon: BoxIcon,     color: 'bg-slate-100', iconColor: 'text-slate-600', subtitle: 'Rigid box' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _rowId = 0;
function nextId() {
  return `pkg-${++_rowId}`;
}

function computeRowTotals(row: PackagingRow) {
  const def = SIZE_DEFS[row.type][row.size];
  const total_weight = row.unit_weight * row.quantity;
  const volume = (def.l * def.w * def.h * row.quantity) / 1_000_000;
  const slot_demand = def.slot_cost * row.quantity;
  return { total_weight, volume, slot_demand };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stepper() {
  return (
    <div className="flex items-center px-8 py-4 border-b bg-background shrink-0">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Invoice Details</span>
      </div>

      <div className="flex-1 h-px bg-primary mx-4" />

      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <span className="text-xs font-bold text-primary-foreground">2</span>
        </div>
        <span className="text-sm font-semibold">Packaging</span>
      </div>

      <div className="flex-1 h-px bg-muted mx-4" />

      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-full border-2 border-muted bg-background flex items-center justify-center">
          <span className="text-xs text-muted-foreground">3</span>
        </div>
        <span className="text-sm text-muted-foreground">Review & Confirm</span>
      </div>
    </div>
  );
}

function ContextPanel({ ctx }: { ctx: InvoiceDisplayContext }) {
  return (
    <div className="w-56 shrink-0 border-r bg-muted/20 p-5 space-y-4 overflow-auto">
      <h3 className="text-sm font-semibold">Invoice Context</h3>

      {ctx.sourceWarehouseName && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Source Warehouse</p>
          <p className="text-sm font-medium">{ctx.sourceWarehouseName}</p>
          {ctx.sourceWarehouseCode && (
            <p className="text-xs text-muted-foreground">{ctx.sourceWarehouseCode}</p>
          )}
        </div>
      )}

      {ctx.destinationFacilityName && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Destination Facility</p>
          <p className="text-sm font-medium">{ctx.destinationFacilityName}</p>
          {ctx.destinationFacilityCode && (
            <p className="text-xs text-muted-foreground">{ctx.destinationFacilityCode}</p>
          )}
        </div>
      )}

      {ctx.program && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Program</p>
          <p className="text-sm font-medium">{ctx.program}</p>
        </div>
      )}

      {ctx.referenceNumber && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Reference Number</p>
          <p className="text-sm font-mono font-medium">{ctx.referenceNumber}</p>
        </div>
      )}

      <div className="space-y-0.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Packaging Required</p>
        <Badge className="bg-green-100 text-green-700 border border-green-200 hover:bg-green-100">
          Yes
        </Badge>
      </div>

      {ctx.createdBy && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Created By</p>
          <p className="text-sm font-medium">{ctx.createdBy}</p>
        </div>
      )}
    </div>
  );
}

function SizeSwitcherCell({
  type,
  size,
  onSizeChange,
}: {
  type: PackageTypeName;
  size: SizeName;
  onSizeChange: (s: SizeName) => void;
}) {
  const def = SIZE_DEFS[type][size];
  const idx = SIZES.indexOf(size);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => idx > 0 && onSizeChange(SIZES[idx - 1])}
          disabled={idx === 0}
          className="h-6 w-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="w-8 text-center text-sm font-bold text-primary">{size}</span>
        <button
          type="button"
          onClick={() => idx < SIZES.length - 1 && onSizeChange(SIZES[idx + 1])}
          disabled={idx === SIZES.length - 1}
          className="h-6 w-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        {def.l} × {def.w} × {def.h}
      </span>
    </div>
  );
}

function PayloadSummary({ rows }: { rows: PackagingRow[] }) {
  const totals = useMemo(() => {
    let totalPackages = 0;
    let totalWeight = 0;
    let totalVolume = 0;
    let totalSlots = 0;

    for (const row of rows) {
      const r = computeRowTotals(row);
      totalPackages += row.quantity;
      totalWeight += r.total_weight;
      totalVolume += r.volume;
      totalSlots += r.slot_demand;
    }

    return { totalPackages, totalWeight, totalVolume, totalSlots };
  }, [rows]);

  const estimatedVehicles = rows.length === 0 ? 0 : Math.max(1, Math.ceil(totals.totalSlots / 10));

  const statItems = [
    {
      icon: Boxes,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-500',
      label: 'Total Packages',
      value: totals.totalPackages,
      unit: 'packages',
    },
    {
      icon: Scale,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-500',
      label: 'Total Weight',
      value: totals.totalWeight.toFixed(0),
      unit: 'kg',
    },
    {
      icon: BoxIcon,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
      label: 'Total Volume',
      value: totals.totalVolume.toFixed(2),
      unit: 'm³',
    },
    {
      icon: LayoutGrid,
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-500',
      label: 'Estimated Slots Required',
      value: Math.ceil(totals.totalSlots),
      unit: 'slots',
    },
    {
      icon: Truck,
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-500',
      label: 'Estimated Vehicles',
      value: estimatedVehicles,
      unit: estimatedVehicles === 1 ? 'Van' : 'Vans',
    },
  ];

  return (
    <div className="w-60 shrink-0 border-l bg-background p-5 space-y-4 overflow-auto">
      <div>
        <h3 className="text-sm font-semibold">Payload Summary</h3>
        <p className="text-xs text-muted-foreground">Calculated from packaging details</p>
      </div>

      <div className="space-y-4">
        {statItems.map(({ icon: Icon, bgColor, iconColor, label, value, unit }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', bgColor)}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold leading-tight">
                {value}
                <span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="pt-2 border-t">
          <a href="#" className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={e => e.preventDefault()}>
            View vehicle recommendations
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PackagingStepProps {
  displayContext: InvoiceDisplayContext;
  onBack: () => void;
  onConfirm: (rows: PackagingRow[], totals: PackagingTotals) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

export function PackagingStep({
  displayContext,
  onBack,
  onConfirm,
  isLoading,
  onCancel,
}: PackagingStepProps) {
  const [rows, setRows] = useState<PackagingRow[]>([]);
  const [selectedType, setSelectedType] = useState<PackageTypeName>('Carton');

  const addRow = (type: PackageTypeName) => {
    const def = SIZE_DEFS[type]['M'];
    setRows(prev => [
      ...prev,
      { id: nextId(), type, size: 'M', unit_weight: def.default_unit_weight, quantity: 1 },
    ]);
  };

  const updateRow = (id: string, field: keyof PackagingRow, value: PackagingRow[keyof PackagingRow]) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value } as PackagingRow;
        if (field === 'size' || field === 'type') {
          const t = field === 'type' ? (value as PackageTypeName) : r.type;
          const s = field === 'size' ? (value as SizeName) : r.size;
          updated.unit_weight = SIZE_DEFS[t][s].default_unit_weight;
        }
        return updated;
      })
    );
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const totals = useMemo((): PackagingTotals => {
    let totalPackages = 0;
    let totalWeight = 0;
    let totalVolume = 0;
    let totalSlots = 0;
    for (const row of rows) {
      const r = computeRowTotals(row);
      totalPackages += row.quantity;
      totalWeight += r.total_weight;
      totalVolume += r.volume;
      totalSlots += r.slot_demand;
    }
    return { totalPackages, totalWeight, totalVolume, totalSlots };
  }, [rows]);

  const canConfirm = rows.length > 0 && rows.every(r => r.quantity > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Stepper />

      {/* Three-column body */}
      <div className="flex flex-1 min-h-0">
        <ContextPanel ctx={displayContext} />

        {/* Center: packaging builder */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Define Packaging</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Add the types and quantities of packages that will be dispatched to the facility.
            </p>
          </div>

          {/* 1. Select Package Type */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">1. Select Package Type</h3>
            <div className="grid grid-cols-4 gap-3">
              {(Object.keys(PACKAGE_TYPE_CONFIG) as PackageTypeName[]).map(type => {
                const cfg = PACKAGE_TYPE_CONFIG[type];
                const Icon = cfg.icon;
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      'relative rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all text-left',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-background'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', cfg.color)}>
                      <Icon className={cn('h-6 w-6', cfg.iconColor)} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold">{type}</p>
                      <p className="text-[10px] text-muted-foreground">{cfg.subtitle}</p>
                    </div>
                  </button>
                );
              })}

              {/* Add Custom */}
              <button
                type="button"
                onClick={() => addRow(selectedType)}
                className="rounded-xl border-2 border-dashed border-muted-foreground/25 p-4 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-muted/30 transition-all"
              >
                <div className="w-12 h-12 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold">Add Custom</p>
                  <p className="text-[10px] text-muted-foreground">Custom package</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Enter Package Quantities */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">2. Enter Package Quantities</h3>

            {rows.length === 0 ? (
              <div className="border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-3 text-muted-foreground">
                <Package className="h-8 w-8 opacity-30" />
                <p className="text-sm">No packages added yet</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRow(selectedType)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add {selectedType}
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Package Type</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Unit Size (cm)</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Unit Weight (kg)</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Quantity</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Total Weight (kg)</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Volume (m³)</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map(row => {
                      const { total_weight, volume } = computeRowTotals(row);
                      const cfg = PACKAGE_TYPE_CONFIG[row.type];
                      const Icon = cfg.icon;
                      return (
                        <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Icon className={cn('h-4 w-4 shrink-0', cfg.iconColor)} />
                              <span className="font-medium">{row.type}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <SizeSwitcherCell
                              type={row.type}
                              size={row.size}
                              onSizeChange={s => updateRow(row.id, 'size', s)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={row.unit_weight}
                              onChange={e => updateRow(row.id, 'unit_weight', Number(e.target.value))}
                              className="h-8 text-sm text-center w-20 mx-auto"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <Input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={e =>
                                updateRow(row.id, 'quantity', Math.max(1, Number(e.target.value)))
                              }
                              className="h-8 text-sm text-center w-16 mx-auto"
                            />
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums">
                            {total_weight}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums">
                            {volume.toFixed(2)}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="h-7 w-7 rounded flex items-center justify-center mx-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addRow(selectedType)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Another Package Type
            </Button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border">
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              Dimensions and unit weights are based on your standard package settings.
            </div>
          </div>
        </div>

        <PayloadSummary rows={rows} />
      </div>

      {/* Footer */}
      <div className="border-t bg-background px-6 py-4 flex items-center justify-between shrink-0">
        <Button type="button" variant="ghost" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          Back to Invoice Details
        </Button>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm || isLoading}
            onClick={() => onConfirm(rows, totals)}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Invoice…
              </>
            ) : (
              <>
                Save Packaging & Create Invoice
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
