import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
  Plus,
  Minus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Invoice, InvoiceLineItem } from '@/types/invoice';
import { useVehicles } from '@/hooks/useVehicles';
import { useSaveInvoicePackaging } from '@/hooks/useInvoices';
import {
  SIZE_DEFS,
  SIZES,
  PACKAGE_TYPE_CONFIG,
  type PackageTypeName,
  type SizeName,
} from './PackagingStep';

// ─── Types ────────────────────────────────────────────────────────────────────

type TypeKey = 'Carton' | 'Kit / Bag' | 'Box';

interface TypeRow {
  typeKey: TypeKey;
  size: SizeName;
  count: number;
}

interface CustomRow {
  id: string;
  count: number;
  l: number;
  w: number;
  h: number;
  maxWeight: number;
}

const TYPE_KEYS: TypeKey[] = ['Carton', 'Kit / Bag', 'Box'];

// Map from TypeKey to DB key prefix
const TYPE_DB_KEY: Record<TypeKey, string> = {
  Carton:      'carton',
  'Kit / Bag': 'bag',
  Box:         'box',
};

// ─── Row style config pulled from PackagingStep ────────────────────────────────

const ROW_STYLE: Record<TypeKey, {
  colorClass: string;
  badgeClass: string;
  textClass: string;
  iconBg: string;
}> = {
  Carton: {
    colorClass: 'bg-amber-50 border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    textClass: 'text-amber-700',
    iconBg: 'bg-amber-100',
  },
  'Kit / Bag': {
    colorClass: 'bg-rose-50 border-rose-200',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    textClass: 'text-rose-700',
    iconBg: 'bg-rose-100',
  },
  Box: {
    colorClass: 'bg-slate-50 border-slate-200',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    textClass: 'text-slate-700',
    iconBg: 'bg-slate-100',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextSize(current: SizeName): SizeName {
  const idx = SIZES.indexOf(current);
  return SIZES[(idx + 1) % SIZES.length];
}

function volumeFromDims(l: number, w: number, h: number): number {
  return (l * w * h) / 1_000_000;
}

// Auto-suggest: assign each item to the most appropriate type+size combo
function autoComputeRows(items: InvoiceLineItem[]): TypeRow[] {
  const rows: TypeRow[] = TYPE_KEYS.map(typeKey => ({ typeKey, size: 'M', count: 0 }));

  for (const item of items) {
    const w = (item.weight_kg || 0) * item.quantity;
    const v = (item.volume_m3 || 0) * item.quantity;
    if (w === 0 && v === 0) continue;

    // Pick smallest size of Box that fits
    let assigned = false;
    for (const size of SIZES) {
      const def = SIZE_DEFS['Box'][size];
      const maxVol = volumeFromDims(def.l, def.w, def.h);
      if (w <= def.default_unit_weight * 1.5 && v <= maxVol) {
        const rowIdx = rows.findIndex(r => r.typeKey === 'Box');
        rows[rowIdx].size = size;
        rows[rowIdx].count += Math.max(1, Math.ceil(w / def.default_unit_weight));
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      const rowIdx = rows.findIndex(r => r.typeKey === 'Box');
      rows[rowIdx].size = 'XL';
      rows[rowIdx].count += 1;
    }
  }

  return rows;
}

function buildCounts(rows: TypeRow[], customRows: CustomRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.count > 0) {
      const key = `${TYPE_DB_KEY[row.typeKey]}_${row.size.toLowerCase()}`;
      counts[key] = (counts[key] || 0) + row.count;
    }
  }
  for (const cr of customRows) {
    if (cr.count > 0) {
      counts['custom'] = (counts['custom'] || 0) + cr.count;
    }
  }
  return counts;
}

// ─── Vehicle fit helpers ───────────────────────────────────────────────────────

function getVehicleSlots(vehicle: any): number {
  const tiered = vehicle.tiered_config;
  if (tiered?.tiers && Array.isArray(tiered.tiers)) {
    return tiered.tiers.reduce((s: number, t: any) => s + (t.slot_count || 0), 0);
  }
  return Math.round((vehicle.capacity || 0) * 10);
}

interface VehicleFitResult {
  canFit: boolean;
  vehiclesNeeded: number;
  bestVehicle: any | null;
  maxSingleVehicleSlots: number;
}

function analyzeVehicleFit(totalSlotDemand: number, vehicles: any[]): VehicleFitResult {
  const available = vehicles.filter(v => v.status === 'available');
  if (available.length === 0) {
    return { canFit: false, vehiclesNeeded: 1, bestVehicle: null, maxSingleVehicleSlots: 0 };
  }
  const withSlots = available.map(v => ({ ...v, _slots: getVehicleSlots(v) }));
  const sorted = [...withSlots].sort((a, b) => b._slots - a._slots);
  const best = sorted[0];
  const needed = Math.ceil(totalSlotDemand);
  if (needed <= best._slots) {
    return { canFit: true, vehiclesNeeded: 1, bestVehicle: best, maxSingleVehicleSlots: best._slots };
  }
  return {
    canFit: false,
    vehiclesNeeded: Math.ceil(needed / best._slots),
    bestVehicle: best,
    maxSingleVehicleSlots: best._slots,
  };
}

// ─── TypeRow counter component ────────────────────────────────────────────────

function PackageTypeRow({
  row,
  onCountChange,
  onSizeClick,
}: {
  row: TypeRow;
  onCountChange: (val: number) => void;
  onSizeClick: () => void;
}) {
  const meta = PACKAGE_TYPE_CONFIG[row.typeKey as PackageTypeName];
  const style = ROW_STYLE[row.typeKey];
  const def = SIZE_DEFS[row.typeKey as PackageTypeName][row.size];
  const slotCost = def.slot_cost;
  const slotDemand = row.count * slotCost;
  const Icon = meta.icon;
  const nextSz = nextSize(row.size);

  return (
    <div className={cn('rounded-lg border p-3 flex items-center gap-3', style.colorClass)}>
      {/* Icon — click to cycle size */}
      <button
        type="button"
        title={`Click to change size (next: ${nextSz})`}
        onClick={onSizeClick}
        className={cn(
          'p-2 rounded-md transition-all hover:scale-110 active:scale-95 cursor-pointer shrink-0',
          style.iconBg, style.textClass
        )}
      >
        <Icon className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm">{meta.subtitle ? row.typeKey : row.typeKey}</span>
          {/* Size badge — also clickable to cycle */}
          <button
            type="button"
            onClick={onSizeClick}
            title={`Click to change size (next: ${nextSz})`}
            className={cn(
              'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold',
              'transition-all hover:opacity-80 cursor-pointer',
              style.badgeClass
            )}
          >
            {row.size}
          </button>
          <Badge variant="outline" className={cn('text-xs px-1 py-0', style.badgeClass)}>
            {slotCost} slot each
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {def.l}×{def.w}×{def.h} cm · max {def.default_unit_weight} kg
        </p>
        {row.count > 0 && (
          <p className={cn('text-xs font-medium mt-0.5', style.textClass)}>
            → {slotDemand.toFixed(2)} slots
          </p>
        )}
      </div>

      {/* Counter */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onCountChange(Math.max(0, row.count - 1))}
          disabled={row.count === 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center font-bold text-sm">{row.count}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onCountChange(row.count + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Custom row component ──────────────────────────────────────────────────────

function CustomPackageRow({
  cr,
  onCountChange,
  onDimChange,
  onRemove,
}: {
  cr: CustomRow;
  onCountChange: (val: number) => void;
  onDimChange: (field: keyof Pick<CustomRow, 'l' | 'w' | 'h' | 'maxWeight'>, val: number) => void;
  onRemove: () => void;
}) {
  const vol = volumeFromDims(cr.l, cr.w, cr.h);

  return (
    <div className="rounded-lg border p-3 bg-purple-50 border-purple-200 space-y-2">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-purple-100 text-purple-700 shrink-0">
          <Plus className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-purple-800">Custom</span>
            <Badge variant="outline" className="text-xs px-1 py-0 bg-purple-100 text-purple-700 border-purple-200">
              manual size
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {cr.l}×{cr.w}×{cr.h} cm · {vol.toFixed(4)} m³
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCountChange(Math.max(0, cr.count - 1))}
            disabled={cr.count === 0}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-bold text-sm">{cr.count}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCountChange(cr.count + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Dimension inputs */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        {(['l', 'w', 'h'] as const).map(dim => (
          <div key={dim} className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase">{dim} (cm)</label>
            <Input
              type="number"
              min={1}
              value={cr[dim]}
              onChange={e => onDimChange(dim, Math.max(1, Number(e.target.value)))}
              className="h-7 text-xs"
            />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Max kg</label>
          <Input
            type="number"
            min={0.1}
            step={0.5}
            value={cr.maxWeight}
            onChange={e => onDimChange('maxWeight', Math.max(0.1, Number(e.target.value)))}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface PackagingMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onSaved?: () => void;
}

let _customId = 0;

export function PackagingMenuDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
}: PackagingMenuDialogProps) {
  const { data: vehicles = [] } = useVehicles();
  const savePackaging = useSaveInvoicePackaging();

  const [packagingRequired, setPackagingRequired] = useState(invoice.packaging_required ?? false);
  const [rows, setRows] = useState<TypeRow[]>(
    TYPE_KEYS.map(typeKey => ({ typeKey, size: 'M', count: 0 }))
  );
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);

  // Seed from saved packaging or auto-compute
  useEffect(() => {
    if (!open) return;
    setPackagingRequired(invoice.packaging_required ?? false);
    setCustomRows([]);

    if (invoice.packaging?.packages && invoice.packaging.packages.length > 0) {
      // Rebuild rows from saved data
      const rebuilt: TypeRow[] = TYPE_KEYS.map(typeKey => ({ typeKey, size: 'M' as SizeName, count: 0 }));
      const dbToTypeKey: Record<string, TypeKey> = {
        carton: 'Carton', bag: 'Kit / Bag', box: 'Box',
      };
      for (const pkg of invoice.packaging.packages) {
        const typeKey = dbToTypeKey[pkg.package_type];
        if (typeKey) {
          const rowIdx = rebuilt.findIndex(r => r.typeKey === typeKey);
          if (rowIdx >= 0) {
            rebuilt[rowIdx].size = (pkg.size as SizeName) || 'M';
            rebuilt[rowIdx].count += 1;
          }
        }
      }
      // Fallback: if nothing mapped, use total_packages as Box M
      if (rebuilt.every(r => r.count === 0) && invoice.packaging.total_packages > 0) {
        rebuilt[2].count = invoice.packaging.total_packages; // Box row
      }
      setRows(rebuilt);
    } else if (invoice.items && invoice.items.length > 0) {
      setRows(autoComputeRows(invoice.items));
    } else {
      setRows(TYPE_KEYS.map(typeKey => ({ typeKey, size: 'M', count: 0 })));
    }
  }, [open, invoice]);

  const hasItems = (invoice.items?.length || 0) > 0;
  const hasWeightData =
    invoice.items?.some(i => (i.weight_kg || 0) > 0 || (i.volume_m3 || 0) > 0) ?? false;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let totalSlotDemand = 0;
    let totalPackages = 0;

    for (const row of rows) {
      const slotCost = SIZE_DEFS[row.typeKey as PackageTypeName][row.size].slot_cost;
      totalSlotDemand += row.count * slotCost;
      totalPackages += row.count;
    }
    for (const cr of customRows) {
      // Custom: assume 0.5 slots (medium) unless big
      const vol = volumeFromDims(cr.l, cr.w, cr.h);
      const slotCost = vol > 0.3 ? 2 : vol > 0.1 ? 1 : vol > 0.05 ? 0.5 : 0.25;
      totalSlotDemand += cr.count * slotCost;
      totalPackages += cr.count;
    }

    const itemWeight =
      invoice.items?.reduce((sum, i) => sum + (i.weight_kg || 0) * i.quantity, 0) ||
      invoice.total_weight_kg ||
      0;
    const packageWeight =
      rows.reduce((sum, row) => {
        const def = SIZE_DEFS[row.typeKey as PackageTypeName][row.size];
        return sum + row.count * def.default_unit_weight;
      }, 0) +
      customRows.reduce((sum, cr) => sum + cr.count * cr.maxWeight, 0);
    const totalWeight = itemWeight > 0 ? itemWeight : packageWeight;

    const totalVolume =
      invoice.items?.reduce((sum, i) => sum + (i.volume_m3 || 0) * i.quantity, 0) ??
      invoice.total_volume_m3 ??
      0;

    return { totalSlotDemand, totalPackages, totalWeight, totalVolume, weightIsEstimated: itemWeight === 0 && packageWeight > 0 };
  }, [rows, customRows, invoice]);

  const vehicleFit = useMemo(() => {
    if (totals.totalSlotDemand === 0) return null;
    return analyzeVehicleFit(totals.totalSlotDemand, vehicles);
  }, [totals.totalSlotDemand, vehicles]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSizeClick = (typeKey: TypeKey) => {
    setRows(prev =>
      prev.map(r => r.typeKey === typeKey ? { ...r, size: nextSize(r.size) } : r)
    );
  };

  const handleCountChange = (typeKey: TypeKey, val: number) => {
    setRows(prev => prev.map(r => r.typeKey === typeKey ? { ...r, count: val } : r));
  };

  const handleAutoSuggest = () => {
    if (invoice.items && invoice.items.length > 0) {
      setRows(autoComputeRows(invoice.items));
    }
  };

  const handleAddCustom = () => {
    setCustomRows(prev => [
      ...prev,
      { id: `custom-${++_customId}`, count: 1, l: 60, w: 40, h: 30, maxWeight: 10 },
    ]);
  };

  const handleCustomCountChange = (id: string, val: number) => {
    setCustomRows(prev => prev.map(cr => cr.id === id ? { ...cr, count: val } : cr));
  };

  const handleCustomDimChange = (
    id: string,
    field: keyof Pick<CustomRow, 'l' | 'w' | 'h' | 'maxWeight'>,
    val: number
  ) => {
    setCustomRows(prev => prev.map(cr => cr.id === id ? { ...cr, [field]: val } : cr));
  };

  const handleRemoveCustom = (id: string) => {
    setCustomRows(prev => prev.filter(cr => cr.id !== id));
  };

  const handleSave = async () => {
    await savePackaging.mutateAsync({
      invoiceId: invoice.id,
      packagingRequired,
      counts: buildCounts(rows, customRows),
      totalWeight: totals.totalWeight,
      totalVolume: totals.totalVolume,
    });
    onSaved?.();
    onOpenChange(false);
  };

  const totalPackagesLabel = useMemo(() => {
    const parts: string[] = [];
    for (const row of rows) {
      if (row.count > 0) parts.push(`${row.count}× ${row.typeKey} ${row.size}`);
    }
    for (const cr of customRows) {
      if (cr.count > 0) parts.push(`${cr.count}× Custom (${cr.l}×${cr.w}×${cr.h})`);
    }
    return parts.length > 0 ? parts.join(', ') : 'No packages configured';
  }, [rows, customRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-primary">📦</span>
            Packaging Configuration
          </DialogTitle>
          <DialogDescription>
            {invoice.invoice_number}
            {invoice.facility?.name && ` · ${invoice.facility.name}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="py-2">

            {/* ── Toggle ── */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 mb-4">
              <div className="space-y-0.5">
                <Label htmlFor="pkg-required" className="text-sm font-semibold cursor-pointer">
                  Packaging Required
                </Label>
                <p className="text-xs text-muted-foreground">
                  Consignment needs physical packaging before dispatch
                </p>
              </div>
              <Switch
                id="pkg-required"
                checked={packagingRequired}
                onCheckedChange={setPackagingRequired}
              />
            </div>

            {packagingRequired ? (
              <div className="grid grid-cols-2 gap-6">
                {/* ── LEFT COLUMN: Package config ── */}
                <div className="space-y-4">
                  {/* Auto-suggest banner */}
                  {hasItems && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <Info className="h-4 w-4 shrink-0" />
                        {hasWeightData
                          ? 'Counts auto-suggested from item weight/volume data.'
                          : 'No weight/volume data — set counts manually.'}
                      </div>
                      {hasWeightData && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0 ml-2"
                          onClick={handleAutoSuggest}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Re-suggest
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Package rows */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Packages</Label>
                      <p className="text-xs text-muted-foreground">Click icon or size badge to cycle size</p>
                    </div>
                    <div className="space-y-2">
                      {rows.map(row => (
                        <PackageTypeRow
                          key={row.typeKey}
                          row={row}
                          onCountChange={val => handleCountChange(row.typeKey, val)}
                          onSizeClick={() => handleSizeClick(row.typeKey)}
                        />
                      ))}

                      {customRows.map(cr => (
                        <CustomPackageRow
                          key={cr.id}
                          cr={cr}
                          onCountChange={val => handleCustomCountChange(cr.id, val)}
                          onDimChange={(field, val) => handleCustomDimChange(cr.id, field, val)}
                          onRemove={() => handleRemoveCustom(cr.id)}
                        />
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs border-dashed text-muted-foreground hover:text-foreground"
                        onClick={handleAddCustom}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        + Custom Size
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Payload summary + Vehicle fit ── */}
                <div className="space-y-4">
                  {/* Payload Summary */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Payload Summary</Label>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                        {rows
                          .filter(r => r.count > 0)
                          .map(r => {
                            const style = ROW_STYLE[r.typeKey];
                            return (
                              <Badge
                                key={r.typeKey}
                                variant="outline"
                                className={cn('text-xs font-medium', style.badgeClass)}
                              >
                                {r.count}× {r.typeKey} {r.size}
                              </Badge>
                            );
                          })}
                        {customRows
                          .filter(cr => cr.count > 0)
                          .map(cr => (
                            <Badge
                              key={cr.id}
                              variant="outline"
                              className="text-xs font-medium bg-purple-100 text-purple-700 border-purple-200"
                            >
                              {cr.count}× Custom
                            </Badge>
                          ))}
                        {totals.totalPackages === 0 && (
                          <span className="text-xs text-muted-foreground">No packages configured</span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="text-center">
                          <p className="text-lg font-bold">{totals.totalPackages}</p>
                          <p className="text-xs text-muted-foreground">Packages</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold">{totals.totalSlotDemand.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Slot demand</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold">
                            {totals.totalWeight > 0 ? `${totals.totalWeight.toFixed(1)} kg` : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Weight{totals.weightIsEstimated ? ' (est.)' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Fit */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Vehicle Fit</Label>

                    {totals.totalPackages === 0 ? (
                      <Alert className="bg-muted/20">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <AlertDescription className="text-xs text-muted-foreground">
                          Configure packages above to see vehicle fit analysis.
                        </AlertDescription>
                      </Alert>
                    ) : vehicles.length === 0 ? (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          No vehicles found. Vehicle fit analysis unavailable.
                        </AlertDescription>
                      </Alert>
                    ) : vehicleFit?.canFit ? (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700 text-sm">
                          <span className="font-semibold">Fits in 1 vehicle</span>
                          {vehicleFit.bestVehicle && (
                            <span className="text-green-600">
                              {' '}— {vehicleFit.bestVehicle.model} ({vehicleFit.bestVehicle.plateNumber}){' '}
                              <span className="font-normal">
                                · {vehicleFit.maxSingleVehicleSlots} slots available
                                · {Math.round((totals.totalSlotDemand / vehicleFit.maxSingleVehicleSlots) * 100)}% utilization
                              </span>
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : vehicleFit ? (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700 text-sm">
                          <span className="font-semibold">
                            Requires {vehicleFit.vehiclesNeeded} vehicles
                          </span>{' '}
                          — consignment exceeds single vehicle capacity
                          {vehicleFit.bestVehicle && (
                            <span className="text-amber-600">
                              {' '}({vehicleFit.maxSingleVehicleSlots} slots max,{' '}
                              {Math.ceil(totals.totalSlotDemand)} needed)
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <Alert className="bg-muted/30">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <AlertDescription className="text-muted-foreground text-sm">
                  No packaging required — this consignment will be dispatched as-is.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          {packagingRequired && totals.totalPackages > 0 && (
            <p className="text-xs text-muted-foreground self-center flex-1 hidden sm:block truncate">
              {totalPackagesLabel} · {totals.totalSlotDemand.toFixed(2)} slots
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={savePackaging.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={savePackaging.isPending}>
            {savePackaging.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {packagingRequired && totals.totalPackages > 0 ? 'Confirm Packaging' : 'Save'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
