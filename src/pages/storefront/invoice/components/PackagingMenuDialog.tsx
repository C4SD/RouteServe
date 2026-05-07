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
import {
  Package,
  ShoppingBag,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Invoice, InvoiceLineItem } from '@/types/invoice';
import { useVehicles } from '@/hooks/useVehicles';
import { useSaveInvoicePackaging } from '@/hooks/useInvoices';

// ─── Package type configuration ────────────────────────────────────────────────

const PACKAGE_CONFIG = {
  bag_s: {
    label: 'Bag',
    size: 'S',
    dbType: 'bag',
    dbSize: 'S',
    slot_cost: 0.25,
    max_weight_kg: 2,
    max_volume_m3: 0.01,
    icon: ShoppingBag,
    colorClass: 'bg-green-50 border-green-200',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    textClass: 'text-green-700',
    desc: 'Max 2 kg / 0.01 m³',
  },
  box_m: {
    label: 'Box',
    size: 'M',
    dbType: 'box',
    dbSize: 'M',
    slot_cost: 0.5,
    max_weight_kg: 10,
    max_volume_m3: 0.05,
    icon: Package,
    colorClass: 'bg-blue-50 border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    textClass: 'text-blue-700',
    desc: 'Max 10 kg / 0.05 m³',
  },
  box_l: {
    label: 'Box',
    size: 'L',
    dbType: 'box',
    dbSize: 'L',
    slot_cost: 1.0,
    max_weight_kg: 25,
    max_volume_m3: 0.1,
    icon: Package,
    colorClass: 'bg-indigo-50 border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    textClass: 'text-indigo-700',
    desc: 'Max 25 kg / 0.10 m³',
  },
  crate_xl: {
    label: 'Crate',
    size: 'XL',
    dbType: 'crate',
    dbSize: 'XL',
    slot_cost: 2.0,
    max_weight_kg: 50,
    max_volume_m3: 0.25,
    icon: Package,
    colorClass: 'bg-orange-50 border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    textClass: 'text-orange-700',
    desc: 'Max 50 kg / 0.25 m³',
  },
} as const;

type PackageType = keyof typeof PACKAGE_CONFIG;
type PackageCounts = Record<PackageType, number>;

// ─── Auto-compute helpers ───────────────────────────────────────────────────

function selectPackageType(weight: number, volume: number): PackageType {
  const { bag_s, box_m, box_l } = PACKAGE_CONFIG;
  if (weight <= bag_s.max_weight_kg && volume <= bag_s.max_volume_m3) return 'bag_s';
  if (weight <= box_m.max_weight_kg && volume <= box_m.max_volume_m3) return 'box_m';
  if (weight <= box_l.max_weight_kg && volume <= box_l.max_volume_m3) return 'box_l';
  return 'crate_xl';
}

function autoComputeFromItems(items: InvoiceLineItem[]): PackageCounts {
  const counts: PackageCounts = { bag_s: 0, box_m: 0, box_l: 0, crate_xl: 0 };
  const hasData = items.some(i => (i.weight_kg || 0) > 0 || (i.volume_m3 || 0) > 0);
  if (!hasData) return counts;

  for (const item of items) {
    const w = (item.weight_kg || 0) * item.quantity;
    const v = (item.volume_m3 || 0) * item.quantity;
    if (w === 0 && v === 0) continue;
    const type = selectPackageType(w, v);
    const cfg = PACKAGE_CONFIG[type];
    const byWeight = w > 0 ? Math.ceil(w / cfg.max_weight_kg) : 0;
    const byVol = v > 0 ? Math.ceil(v / cfg.max_volume_m3) : 0;
    counts[type] += Math.max(byWeight, byVol, 1);
  }
  return counts;
}

// ─── Vehicle fit helpers ────────────────────────────────────────────────────

function getVehicleSlots(vehicle: any): number {
  const tiered = vehicle.tiered_config || (vehicle as any).tiered_config;
  if (tiered?.tiers && Array.isArray(tiered.tiers)) {
    return tiered.tiers.reduce((s: number, t: any) => s + (t.slot_count || 0), 0);
  }
  // Fall back to capacity (m³) × 10 as rough slot estimate when no tiered config
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

  const vehiclesNeeded = Math.ceil(needed / best._slots);
  return { canFit: false, vehiclesNeeded, bestVehicle: best, maxSingleVehicleSlots: best._slots };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PackageCounter({
  type,
  count,
  onChange,
}: {
  type: PackageType;
  count: number;
  onChange: (val: number) => void;
}) {
  const cfg = PACKAGE_CONFIG[type];
  const Icon = cfg.icon;
  const slotDemand = count * cfg.slot_cost;

  return (
    <div className={cn('rounded-lg border p-3 flex items-center gap-3', cfg.colorClass)}>
      <div className={cn('p-2 rounded-md bg-white/60', cfg.textClass)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm">
            {cfg.label} <span className="font-bold">{cfg.size}</span>
          </span>
          <Badge variant="outline" className={cn('text-xs px-1 py-0', cfg.badgeClass)}>
            {cfg.slot_cost} slot each
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{cfg.desc}</p>
        {count > 0 && (
          <p className={cn('text-xs font-medium mt-0.5', cfg.textClass)}>
            → {slotDemand.toFixed(2)} slots
          </p>
        )}
      </div>

      {/* Counter control */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(Math.max(0, count - 1))}
          disabled={count === 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center font-bold text-sm">{count}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(count + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

interface PackagingMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onSaved?: () => void;
}

export function PackagingMenuDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
}: PackagingMenuDialogProps) {
  const { data: vehicles = [] } = useVehicles();
  const savePackaging = useSaveInvoicePackaging();

  const [packagingRequired, setPackagingRequired] = useState(invoice.packaging_required ?? false);
  const [counts, setCounts] = useState<PackageCounts>({
    bag_s: 0,
    box_m: 0,
    box_l: 0,
    crate_xl: 0,
  });

  // Seed counts from existing packaging data or auto-compute from line items
  useEffect(() => {
    if (!open) return;
    setPackagingRequired(invoice.packaging_required ?? false);

    if (invoice.packaging) {
      // Rebuild counts from saved package_items
      const rebuilt: PackageCounts = { bag_s: 0, box_m: 0, box_l: 0, crate_xl: 0 };
      (invoice.packaging.packages || []).forEach(pkg => {
        const key = `${pkg.package_type}_${pkg.size?.toLowerCase()}` as PackageType;
        if (key in rebuilt) rebuilt[key] += 1;
      });
      // If no package_items breakdown, use total_packages as box_m fallback
      if (Object.values(rebuilt).every(v => v === 0) && invoice.packaging.total_packages > 0) {
        rebuilt.box_m = invoice.packaging.total_packages;
      }
      setCounts(rebuilt);
    } else if (invoice.items && invoice.items.length > 0) {
      setCounts(autoComputeFromItems(invoice.items));
    } else {
      setCounts({ bag_s: 0, box_m: 0, box_l: 0, crate_xl: 0 });
    }
  }, [open, invoice]);

  const hasItems = (invoice.items?.length || 0) > 0;
  const hasWeightData = invoice.items?.some(i => (i.weight_kg || 0) > 0 || (i.volume_m3 || 0) > 0) ?? false;

  // Totals derived from counts
  const totals = useMemo(() => {
    let totalSlotDemand = 0;
    let totalPackages = 0;
    (Object.entries(counts) as [PackageType, number][]).forEach(([type, count]) => {
      totalSlotDemand += count * PACKAGE_CONFIG[type].slot_cost;
      totalPackages += count;
    });

    const totalWeight = invoice.items?.reduce(
      (sum, i) => sum + (i.weight_kg || 0) * i.quantity,
      0
    ) ?? invoice.total_weight_kg ?? 0;

    const totalVolume = invoice.items?.reduce(
      (sum, i) => sum + (i.volume_m3 || 0) * i.quantity,
      0
    ) ?? invoice.total_volume_m3 ?? 0;

    return { totalSlotDemand, totalPackages, totalWeight, totalVolume };
  }, [counts, invoice]);

  // Vehicle fit analysis
  const vehicleFit = useMemo(() => {
    if (totals.totalSlotDemand === 0) return null;
    return analyzeVehicleFit(totals.totalSlotDemand, vehicles);
  }, [totals.totalSlotDemand, vehicles]);

  const handleAutoSuggest = () => {
    if (invoice.items && invoice.items.length > 0) {
      setCounts(autoComputeFromItems(invoice.items));
    }
  };

  const handleSave = async () => {
    await savePackaging.mutateAsync({
      invoiceId: invoice.id,
      packagingRequired,
      counts,
      totalWeight: totals.totalWeight,
      totalVolume: totals.totalVolume,
    });
    onSaved?.();
    onOpenChange(false);
  };

  const totalPackagesLabel = useMemo(() => {
    const parts: string[] = [];
    (Object.entries(counts) as [PackageType, number][]).forEach(([type, count]) => {
      if (count > 0) {
        const cfg = PACKAGE_CONFIG[type];
        parts.push(`${count}× ${cfg.label} ${cfg.size}`);
      }
    });
    return parts.length > 0 ? parts.join(', ') : 'No packages configured';
  }, [counts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Packaging Configuration
          </DialogTitle>
          <DialogDescription>
            {invoice.invoice_number}
            {invoice.facility?.name && ` · ${invoice.facility.name}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-2">

            {/* ── Toggle ── */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
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

            {packagingRequired && (
              <>
                <Separator />

                {/* ── Auto-suggest banner ── */}
                {hasItems && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <Info className="h-4 w-4 shrink-0" />
                      {hasWeightData
                        ? 'Counts auto-suggested from item weight/volume data.'
                        : 'No weight/volume data on items — set counts manually.'}
                    </div>
                    {hasWeightData && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0 ml-2"
                        onClick={handleAutoSuggest}
                      >
                        Re-suggest
                      </Button>
                    )}
                  </div>
                )}

                {/* ── Package counters ── */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Packages</Label>
                  <div className="space-y-2">
                    {(Object.keys(PACKAGE_CONFIG) as PackageType[]).map(type => (
                      <PackageCounter
                        key={type}
                        type={type}
                        count={counts[type]}
                        onChange={val => setCounts(prev => ({ ...prev, [type]: val }))}
                      />
                    ))}
                  </div>
                </div>

                <Separator />

                {/* ── Payload summary ── */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Payload Summary</Label>
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(counts) as [PackageType, number][])
                        .filter(([, count]) => count > 0)
                        .map(([type, count]) => {
                          const cfg = PACKAGE_CONFIG[type];
                          return (
                            <Badge
                              key={type}
                              variant="outline"
                              className={cn('text-xs font-medium', cfg.badgeClass)}
                            >
                              {count}× {cfg.label} {cfg.size}
                            </Badge>
                          );
                        })}
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
                        <p className="text-lg font-bold">
                          {totals.totalSlotDemand.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">Slot demand</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">
                          {totals.totalWeight > 0 ? `${totals.totalWeight.toFixed(1)} kg` : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">Weight</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Vehicle fit analysis ── */}
                {totals.totalPackages > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Vehicle Fit</Label>

                    {vehicles.length === 0 ? (
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
                              {' '}({vehicleFit.maxSingleVehicleSlots} slots max per vehicle,{' '}
                              {Math.ceil(totals.totalSlotDemand)} slots needed)
                            </span>
                          )}
                          <p className="mt-1 font-normal text-xs text-amber-600">
                            Scheduler will split into {vehicleFit.vehiclesNeeded} batches within the same schedule.
                          </p>
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                )}
              </>
            )}

            {!packagingRequired && (
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
