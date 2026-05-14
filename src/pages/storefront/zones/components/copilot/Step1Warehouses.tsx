import { useState } from 'react';
import { Building2, CheckCircle2, MapPin, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useWarehouses } from '@/hooks/useWarehouses';
import { WarehouseFormDialog } from '@/pages/storefront/warehouse/components/WarehouseFormDialog';
import type { CopilotWarehouse } from '@/types/operations-copilot';

interface Step1WarehousesProps {
  selected: CopilotWarehouse[];
  onSelectionChange: (warehouses: CopilotWarehouse[]) => void;
  onNext: () => void;
}

export function Step1Warehouses({ selected, onSelectionChange, onNext }: Step1WarehousesProps) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useWarehouses({ is_active: true });
  const warehouses = data?.warehouses ?? [];

  const selectedIds = new Set(selected.map(w => w.id));

  const filtered = warehouses.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.code?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
    (w.state?.toLowerCase() ?? '').includes(search.toLowerCase()),
  );

  const validWarehouses = filtered.filter(w => w.lat && w.lng);
  const invalidWarehouses = filtered.filter(w => !w.lat || !w.lng);

  function toggle(w: typeof warehouses[0]) {
    if (!w.lat || !w.lng) return;
    const copilotW: CopilotWarehouse = {
      id: w.id,
      name: w.name,
      lat: w.lat!,
      lng: w.lng!,
      code: w.code,
      state: w.state,
    };
    if (selectedIds.has(w.id)) {
      onSelectionChange(selected.filter(s => s.id !== w.id));
    } else {
      onSelectionChange([...selected, copilotW]);
    }
  }

  function selectAll() {
    const newWarehouses: CopilotWarehouse[] = validWarehouses.map(w => ({
      id: w.id,
      name: w.name,
      lat: w.lat!,
      lng: w.lng!,
      code: w.code,
      state: w.state,
    }));
    const existing = selected.filter(s => !newWarehouses.find(n => n.id === s.id));
    onSelectionChange([...existing, ...newWarehouses]);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Warehouses</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Warehouses are the fixed operational anchors. Select all that should serve the target region.
          </p>
        </div>
        {selected.length > 0 && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {selected.length} selected
          </Badge>
        )}
      </div>

      <WarehouseFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="flex gap-2">
        <Input
          placeholder="Search by name, code, or state…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
        {validWarehouses.length > 0 && (
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select all
          </Button>
        )}
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onSelectionChange([])}>
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {/* Existing warehouse cards */}
            {validWarehouses.map(w => {
              const isSelected = selectedIds.has(w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => toggle(w)}
                  className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-medium text-sm truncate">{w.name}</span>
                      </div>
                      {w.code && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6">{w.code}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2 ml-6">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {w.lat?.toFixed(4)}, {w.lng?.toFixed(4)}
                          {w.state && ` · ${w.state}`}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              );
            })}

            {/* + Create Warehouse dashed card — always last in grid */}
            <button
              onClick={() => setCreateOpen(true)}
              className="text-left rounded-lg border-2 border-dashed p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/20 transition-all min-h-[96px]"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm font-medium">Create Warehouse</span>
            </button>
          </div>

          {invalidWarehouses.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-xs font-medium">
                  {invalidWarehouses.length} warehouse{invalidWarehouses.length > 1 ? 's' : ''} without coordinates cannot be used:
                  {' '}{invalidWarehouses.map(w => w.name).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={selected.length === 0}>
          Continue with {selected.length} warehouse{selected.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}
