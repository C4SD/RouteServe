/**
 * =====================================================
 * Step 3 – Packaging Completion
 * =====================================================
 * Sits between Schedule (2) and Batch (4).
 * User declares the real warehouse packaging for every
 * facility in the working set before batching can start.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Package,
  ShoppingBag,
  Box as BoxIcon,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertCircle,
  Truck,
  Boxes,
  Scale,
  LayoutGrid,
  Pencil,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { WorkingSetItem, FacilityPackagingData, FacilityPackagingRow } from '@/types/unified-workflow';
import {
  SIZE_DEFS,
  SIZES,
  PACKAGE_TYPE_CONFIG,
  type PackageTypeName,
  type SizeName,
} from '@/pages/storefront/invoice/components/PackagingStep';

// ─── helpers ────────────────────────────────────────────────────────────────

let _id = 0;
const nextId = () => `pkg-${++_id}`;

function computeRow(row: FacilityPackagingRow) {
  const def = SIZE_DEFS[row.type as PackageTypeName][row.size as SizeName];
  return {
    total_weight: row.unit_weight * row.quantity,
    volume: (def.l * def.w * def.h * row.quantity) / 1_000_000,
    slot_demand: def.slot_cost * row.quantity,
  };
}

function computeTotals(rows: FacilityPackagingRow[]) {
  let total_weight = 0, total_volume = 0, total_packages = 0, total_slots = 0;
  for (const r of rows) {
    const c = computeRow(r);
    total_weight += c.total_weight;
    total_volume += c.volume;
    total_packages += r.quantity;
    total_slots += c.slot_demand;
  }
  return { total_weight, total_volume, total_packages, total_slots };
}

function summaryLabel(data: FacilityPackagingData): string {
  const counts: Partial<Record<string, number>> = {};
  for (const p of data.packages) {
    const key = p.type;
    counts[key] = (counts[key] ?? 0) + p.quantity;
  }
  return Object.entries(counts)
    .map(([type, qty]) => `${qty} ${type}${qty! > 1 && !type.endsWith('s') ? 's' : ''}`)
    .join(', ');
}

const PACKAGE_TYPES: PackageTypeName[] = ['Carton', 'Kit / Bag', 'Box'];

// ─── SizeSwitcher ────────────────────────────────────────────────────────────

function SizeSwitcherCell({
  type,
  size,
  onChange,
}: {
  type: PackageTypeName;
  size: SizeName;
  onChange: (s: SizeName) => void;
}) {
  const def = SIZE_DEFS[type][size];
  const idx = SIZES.indexOf(size);
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[90px]">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => onChange(SIZES[idx - 1])}
          className="h-5 w-5 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <span className="w-7 text-center text-xs font-bold text-primary">{size}</span>
        <button
          type="button"
          disabled={idx === SIZES.length - 1}
          onClick={() => onChange(SIZES[idx + 1])}
          className="h-5 w-5 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <span className="text-[9px] text-muted-foreground whitespace-nowrap tabular-nums">
        {def.l}×{def.w}×{def.h}
      </span>
    </div>
  );
}

// ─── PackagingEditor (right panel - single facility mode) ────────────────────

function PackagingEditor({
  facilityId,
  facilityName,
  invoiceRef,
  initial,
  onSave,
  onCancel,
}: {
  facilityId: string;
  facilityName: string;
  invoiceRef?: string;
  initial: FacilityPackagingRow[];
  onSave: (facilityId: string, rows: FacilityPackagingRow[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<FacilityPackagingRow[]>(() =>
    initial.length > 0 ? initial : []
  );
  const [selectedType, setSelectedType] = useState<PackageTypeName>('Carton');
  const [activeTab, setActiveTab] = useState<'details' | 'summary'>('details');

  const addRow = (type: PackageTypeName) => {
    const def = SIZE_DEFS[type]['M'];
    setRows((prev) => [
      ...prev,
      { id: nextId(), type, size: 'M', unit_weight: def.default_unit_weight, quantity: 1 },
    ]);
  };

  const updateRow = (id: string, patch: Partial<FacilityPackagingRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...patch };
        if (patch.type || patch.size) {
          const t = (patch.type ?? r.type) as PackageTypeName;
          const s = (patch.size ?? r.size) as SizeName;
          updated.unit_weight = SIZE_DEFS[t][s].default_unit_weight;
        }
        return updated;
      })
    );
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const totals = useMemo(() => computeTotals(rows), [rows]);

  const canSave = rows.length > 0 && rows.every((r) => r.quantity > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold leading-tight">{facilityName}</p>
            {invoiceRef && (
              <p className="text-xs text-muted-foreground mt-0.5">{invoiceRef}</p>
            )}
          </div>
          <Badge
            className={cn(
              'text-[10px] ml-2 mt-0.5 flex-shrink-0',
              rows.length > 0
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-orange-100 text-orange-700 border-orange-200'
            )}
          >
            {rows.length > 0 ? 'Packaged' : 'Pending'}
          </Badge>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'details' | 'summary')}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="mx-4 mt-2 flex-shrink-0 w-auto self-start">
          <TabsTrigger value="details" className="text-xs">Package Details</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex-1 overflow-y-auto px-4 pb-4 mt-0">
          {/* 1. Select type */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                1. Select Package Type &amp; Size
              </p>
              <button
                type="button"
                onClick={() => addRow(selectedType)}
                className="text-xs text-primary flex items-center gap-0.5 hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add New Package Type
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PACKAGE_TYPES.map((type) => {
                const cfg = PACKAGE_TYPE_CONFIG[type];
                const Icon = cfg.icon;
                const def = SIZE_DEFS[type]['M'];
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setSelectedType(type);
                      addRow(type);
                    }}
                    className={cn(
                      'relative rounded-lg border-2 p-2.5 flex flex-col items-center gap-1.5 text-center transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    {isSelected && rows.some((r) => r.type === type) && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className={cn('w-8 h-8 rounded flex items-center justify-center', cfg.color)}>
                      <Icon className={cn('h-4 w-4', cfg.iconColor)} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold leading-tight">{type}</p>
                      <p className="text-[9px] text-muted-foreground">
                        Max {SIZE_DEFS[type]['M'].default_unit_weight * 1.5} kg
                      </p>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => addRow(selectedType)}
                className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-2.5 flex flex-col items-center gap-1.5 text-center hover:border-primary/40 hover:bg-muted/30 transition-all"
              >
                <div className="w-8 h-8 rounded border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground">Add Type</p>
              </button>
            </div>
          </div>

          {/* 2. Quantity table */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              2. Enter Quantity
            </p>

            {rows.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg py-8 flex flex-col items-center gap-2 text-muted-foreground">
                <Package className="h-6 w-6 opacity-30" />
                <p className="text-xs">Select a package type above to add packages</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Size (cm)</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Unit kg</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Qty</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground">Total kg</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => {
                      const { total_weight } = computeRow(row);
                      const cfg = PACKAGE_TYPE_CONFIG[row.type as PackageTypeName];
                      const Icon = cfg.icon;
                      return (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.iconColor)} />
                              <span className="font-medium truncate max-w-[60px]">{row.type}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <SizeSwitcherCell
                              type={row.type as PackageTypeName}
                              size={row.size as SizeName}
                              onChange={(s) => updateRow(row.id, { size: s })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={row.unit_weight}
                              onChange={(e) => updateRow(row.id, { unit_weight: Number(e.target.value) })}
                              className="h-7 text-xs text-center w-14 mx-auto"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) =>
                                updateRow(row.id, { quantity: Math.max(1, Number(e.target.value)) })
                              }
                              className="h-7 text-xs text-center w-14 mx-auto"
                            />
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums font-medium">
                            {total_weight}
                          </td>
                          <td className="pr-2 py-2">
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          {rows.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg border text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Total Packages</p>
                <p className="text-sm font-bold">{totals.total_packages}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Total Weight</p>
                <p className="text-sm font-bold">{totals.total_weight.toFixed(0)} kg</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Est. Volume</p>
                <p className="text-sm font-bold">{totals.total_volume.toFixed(2)} m³</p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="summary" className="flex-1 overflow-y-auto px-4 pb-4 mt-0">
          {rows.length === 0 ? (
            <div className="mt-6 text-center text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No packaging defined yet</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {rows.map((row) => {
                const { total_weight, volume } = computeRow(row);
                const cfg = PACKAGE_TYPE_CONFIG[row.type as PackageTypeName];
                const Icon = cfg.icon;
                const def = SIZE_DEFS[row.type as PackageTypeName][row.size as SizeName];
                return (
                  <div key={row.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className={cn('w-9 h-9 rounded flex items-center justify-center flex-shrink-0', cfg.color)}>
                      <Icon className={cn('h-4 w-4', cfg.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{row.type} {row.size}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {def.l}×{def.w}×{def.h} cm · {row.unit_weight} kg each
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold">×{row.quantity}</p>
                      <p className="text-[10px] text-muted-foreground">{total_weight} kg</p>
                    </div>
                  </div>
                );
              })}
              <div className="p-3 rounded-lg bg-muted/30 border space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total packages</span>
                  <span className="font-semibold">{totals.total_packages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total weight</span>
                  <span className="font-semibold">{totals.total_weight.toFixed(0)} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated volume</span>
                  <span className="font-semibold">{totals.total_volume.toFixed(3)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slot demand</span>
                  <span className="font-semibold">{Math.ceil(totals.total_slots)}</span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t flex gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSave}
          onClick={() => onSave(facilityId, rows)}
          className="flex-1"
        >
          Save Packaging
        </Button>
      </div>
    </div>
  );
}

// ─── BulkApplyPanel ──────────────────────────────────────────────────────────

function BulkApplyPanel({
  selectedCount,
  onApply,
  onCancel,
}: {
  selectedCount: number;
  onApply: (rows: FacilityPackagingRow[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<FacilityPackagingRow[]>([]);
  const [addType, setAddType] = useState<PackageTypeName>('Carton');
  const [addQty, setAddQty] = useState(1);

  const addRow = () => {
    const def = SIZE_DEFS[addType]['M'];
    setRows((prev) => [
      ...prev,
      { id: nextId(), type: addType, size: 'M', unit_weight: def.default_unit_weight, quantity: addQty },
    ]);
    setAddQty(1);
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex-shrink-0">
        <p className="text-sm font-semibold">Apply Packaging to {selectedCount} Facilities</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Same packaging will be applied to all selected facilities
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Add row control */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Package Type</p>
          <div className="flex gap-2">
            <Select
              value={addType}
              onValueChange={(v) => setAddType(v as PackageTypeName)}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PACKAGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={addQty}
              onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
              className="h-8 text-xs w-20 text-center"
              placeholder="Qty"
            />
            <Button size="sm" variant="outline" onClick={addRow} className="h-8 text-xs px-3">
              Add
            </Button>
          </div>
        </div>

        {/* List to apply */}
        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Package List to Apply
              </p>
              <button
                type="button"
                onClick={() => setRows([])}
                className="text-xs text-destructive hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-1.5">
              {rows.map((row) => {
                const cfg = PACKAGE_TYPE_CONFIG[row.type as PackageTypeName];
                const Icon = cfg.icon;
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20"
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.iconColor)} />
                    <span className="text-xs flex-1">{row.type}</span>
                    <span className="text-xs font-medium tabular-nums">×{row.quantity}</span>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t flex gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={rows.length === 0}
          onClick={() => onApply(rows)}
          className="flex-1"
        >
          Apply to {selectedCount} Facilities
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface Step3PackagingCompletionProps {
  workingSet: WorkingSetItem[];
  facilityPackaging: Record<string, FacilityPackagingData>;
  onSetFacilityPackaging: (facilityId: string, data: FacilityPackagingData | null) => void;
}

const PAGE_SIZE = 10;

export function Step3PackagingCompletion({
  workingSet,
  facilityPackaging,
  onSetFacilityPackaging,
}: Step3PackagingCompletionProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'packaged' | 'pending'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [panelFacilityId, setPanelFacilityId] = useState<string | null>(null);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);

  // ── Derived data ────────────────────────────────────────────────────────────

  const allRows = useMemo(
    () =>
      workingSet.map((ws) => ({
        ...ws,
        packaging: facilityPackaging[ws.facility_id] ?? null,
        isPackaged: Boolean(
          facilityPackaging[ws.facility_id]?.packages?.length
        ),
      })),
    [workingSet, facilityPackaging]
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.facility_name.toLowerCase().includes(q) ||
          r.facility_code?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'packaged') rows = rows.filter((r) => r.isPackaged);
    if (statusFilter === 'pending') rows = rows.filter((r) => !r.isPackaged);
    return rows;
  }, [allRows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const packagedCount = allRows.filter((r) => r.isPackaged).length;
  const pendingCount = allRows.length - packagedCount;

  const globalTotals = useMemo(() => {
    let total_weight = 0, total_volume = 0, total_packages = 0, total_slots = 0;
    for (const data of Object.values(facilityPackaging)) {
      total_weight += data.computed.total_weight;
      total_volume += data.computed.total_volume;
      total_packages += data.computed.total_packages;
      total_slots += data.computed.total_slots;
    }
    const estimatedVehicles = total_slots > 0 ? Math.max(1, Math.ceil(total_slots / 10)) : 0;
    return { total_weight, total_volume, total_packages, total_slots, estimatedVehicles };
  }, [facilityPackaging]);

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleAll = useCallback(() => {
    if (selected.size === pagedRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pagedRows.map((r) => r.facility_id)));
    }
  }, [selected, pagedRows]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Panel actions ─────────────────────────────────────────────────────────

  const openFacilityPanel = useCallback(
    (facilityId: string) => {
      setPanelFacilityId(facilityId);
      setBulkPanelOpen(false);
    },
    []
  );

  const closePanel = useCallback(() => {
    setPanelFacilityId(null);
    setBulkPanelOpen(false);
  }, []);

  const handleSavePackaging = useCallback(
    (facilityId: string, rows: FacilityPackagingRow[]) => {
      const computed = computeTotals(rows);
      onSetFacilityPackaging(facilityId, {
        facility_id: facilityId,
        packages: rows,
        computed,
      });
      // Auto-advance to next pending facility
      const currentIdx = workingSet.findIndex((ws) => ws.facility_id === facilityId);
      const nextPending = workingSet
        .slice(currentIdx + 1)
        .find((ws) => !facilityPackaging[ws.facility_id]?.packages?.length);
      if (nextPending) {
        setPanelFacilityId(nextPending.facility_id);
      } else {
        closePanel();
      }
    },
    [onSetFacilityPackaging, workingSet, facilityPackaging, closePanel]
  );

  const handleBulkApply = useCallback(
    (rows: FacilityPackagingRow[]) => {
      const computed = computeTotals(rows);
      for (const facilityId of selected) {
        onSetFacilityPackaging(facilityId, { facility_id: facilityId, packages: rows, computed });
      }
      setSelected(new Set());
      setBulkPanelOpen(false);
    },
    [selected, onSetFacilityPackaging]
  );

  const handleBulkClear = useCallback(() => {
    for (const facilityId of selected) {
      onSetFacilityPackaging(facilityId, null);
    }
    setSelected(new Set());
  }, [selected, onSetFacilityPackaging]);

  // ── Render ────────────────────────────────────────────────────────────────

  const panelOpen = panelFacilityId !== null || bulkPanelOpen;
  const panelFacility = panelFacilityId
    ? workingSet.find((ws) => ws.facility_id === panelFacilityId)
    : null;

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Summary bar ── */}
      <div className="border-b px-6 py-4 flex-shrink-0 bg-background">
        <div className="flex items-center flex-wrap gap-4">
          {/* Facility counts */}
          <div className="flex items-center gap-4 pr-4 border-r">
            <div>
              <p className="text-2xl font-bold leading-none">{allRows.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Facilities Selected</p>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-green-600">{packagedCount}</span>
                <span className="text-xs text-muted-foreground">Packaged</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-orange-600">{pendingCount}</span>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
            </div>
          </div>

          {/* Metric cards */}
          <div className="flex items-center gap-5 flex-wrap">
            {[
              { Icon: Boxes, label: 'Total Packages', value: globalTotals.total_packages, color: 'text-blue-500' },
              { Icon: Scale, label: 'Total Weight', value: `${globalTotals.total_weight.toFixed(0)} kg`, color: 'text-purple-500' },
              { Icon: BoxIcon, label: 'Total Volume', value: `${globalTotals.total_volume.toFixed(2)} m³`, color: 'text-teal-500' },
              { Icon: LayoutGrid, label: 'Est. Slots', value: Math.ceil(globalTotals.total_slots), color: 'text-orange-500' },
              { Icon: Truck, label: 'Est. Vehicles (Van)', value: globalTotals.estimatedVehicles, color: 'text-indigo-500' },
            ].map(({ Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                <div>
                  <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
                  <p className="text-sm font-bold leading-tight">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Facility table */}
        <div className={cn('flex flex-col min-w-0', panelOpen ? 'flex-1' : 'w-full')}>
          {/* Toolbar */}
          <div className="px-4 py-3 border-b flex items-center gap-2 flex-wrap flex-shrink-0 bg-background">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search facility..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}
            >
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="packaged" className="text-xs">Packaged</SelectItem>
                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              </SelectContent>
            </Select>

            {selected.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 text-xs gap-1">
                    Bulk Actions ({selected.size})
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() => setBulkPanelOpen(true)}
                  >
                    <Boxes className="h-3.5 w-3.5 mr-2" />
                    Apply Same Packaging
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs text-destructive focus:text-destructive"
                    onClick={handleBulkClear}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Clear Packaging
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-background border-b">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={pagedRows.length > 0 && pagedRows.every((r) => selected.has(r.facility_id))}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Facility</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-24">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Packages (Summary)</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-24">Weight</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-24">Volume</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No facilities match your filters.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => {
                    const isActive = panelFacilityId === row.facility_id;
                    return (
                      <tr
                        key={row.facility_id}
                        onClick={() => openFacilityPanel(row.facility_id)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isActive
                            ? 'bg-primary/5 border-l-2 border-l-primary'
                            : 'hover:bg-muted/30'
                        )}
                      >
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selected.has(row.facility_id)}
                            onCheckedChange={() => toggleRow(row.facility_id)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-sm leading-tight">{row.facility_name}</p>
                          {row.facility_code && (
                            <p className="text-xs text-muted-foreground">{row.facility_code}</p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {row.isPackaged ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                              Packaged
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {row.packaging ? (
                            <div>
                              <p className="text-xs">{summaryLabel(row.packaging)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {row.packaging.computed.total_packages} packages
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs">
                          {row.packaging
                            ? `${row.packaging.computed.total_weight.toFixed(0)} kg`
                            : '—'}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-xs">
                          {row.packaging
                            ? `${row.packaging.computed.total_volume.toFixed(2)} m³`
                            : '—'}
                        </td>
                        <td
                          className="px-3 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {row.isPackaged ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => openFacilityPanel(row.facility_id)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => openFacilityPanel(row.facility_id)}
                                  className="h-7 w-7 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                onClick={() => openFacilityPanel(row.facility_id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Packaging
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-2.5 border-t flex items-center justify-between flex-shrink-0 bg-background">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredRows.length)}–
              {Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} facilities
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 w-7 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'h-7 w-7 rounded border text-xs',
                      page === pageNum
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted text-muted-foreground'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="text-muted-foreground text-xs px-1">…</span>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className={cn(
                      'h-7 w-7 rounded border text-xs',
                      page === totalPages
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted text-muted-foreground'
                    )}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        {panelOpen && (
          <div className="w-[400px] flex-shrink-0 border-l flex flex-col bg-background overflow-hidden">
            {/* Panel header */}
            <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Facility Packaging
              </p>
              <button
                type="button"
                onClick={closePanel}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {bulkPanelOpen ? (
                <BulkApplyPanel
                  selectedCount={selected.size}
                  onApply={handleBulkApply}
                  onCancel={closePanel}
                />
              ) : panelFacility ? (
                <PackagingEditor
                  facilityId={panelFacility.facility_id}
                  facilityName={panelFacility.facility_name}
                  invoiceRef={panelFacility.facility_code}
                  initial={
                    facilityPackaging[panelFacility.facility_id]?.packages ?? []
                  }
                  onSave={handleSavePackaging}
                  onCancel={closePanel}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* ── Validation warning bar ── */}
      {pendingCount > 0 && (
        <div className="border-t bg-orange-50 px-6 py-2.5 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <p className="text-xs text-orange-700">
            <span className="font-semibold">{pendingCount} {pendingCount === 1 ? 'facility' : 'facilities'}</span>
            {' '}still {pendingCount === 1 ? 'needs' : 'need'} packaging defined before you can continue.
          </p>
        </div>
      )}
    </div>
  );
}

export default Step3PackagingCompletion;
