import { useState, useMemo } from 'react';
import { Building2, Search, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFacilities } from '@/hooks/useFacilities';
import type { CopilotFacility } from '@/types/operations-copilot';

interface Step2FacilitiesProps {
  selected: CopilotFacility[];
  onSelectionChange: (facilities: CopilotFacility[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Facilities({ selected, onSelectionChange, onNext, onBack }: Step2FacilitiesProps) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [lgaFilter, setLgaFilter] = useState<string>('all');

  const { data: facilitiesData, isLoading: loading } = useFacilities(undefined, undefined, 2000);
  const rawFacilities = facilitiesData?.facilities;

  const facilities = useMemo(() =>
    (rawFacilities ?? []).filter(f =>
      Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng)) &&
      Number(f.lat) !== 0 && Number(f.lng) !== 0,
    ),
    [rawFacilities],
  );

  const states = useMemo(() =>
    [...new Set(facilities.map(f => f.state).filter(Boolean))].sort() as string[],
    [facilities],
  );

  const lgas = useMemo(() =>
    [...new Set(
      facilities
        .filter(f => stateFilter === 'all' || f.state === stateFilter)
        .map(f => f.lga)
        .filter(Boolean),
    )].sort() as string[],
    [facilities, stateFilter],
  );

  const filtered = useMemo(() =>
    facilities.filter(f => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (stateFilter !== 'all' && f.state !== stateFilter) return false;
      if (lgaFilter !== 'all' && f.lga !== lgaFilter) return false;
      return true;
    }),
    [facilities, search, stateFilter, lgaFilter],
  );

  const selectedIds = new Set(selected.map(f => f.id));

  function toggle(f: typeof facilities[0]) {
    const copilot: CopilotFacility = {
      id: f.id,
      name: f.name,
      lat: Number(f.lat),
      lng: Number(f.lng),
      lga: f.lga,
      ward: f.ward,
      state: f.state,
    };

    if (selectedIds.has(f.id)) {
      onSelectionChange(selected.filter(s => s.id !== f.id));
    } else {
      onSelectionChange([...selected, copilot]);
    }
  }

  function selectAllFiltered() {
    const newFacilities: CopilotFacility[] = filtered.map(f => ({
      id: f.id,
      name: f.name,
      lat: Number(f.lat),
      lng: Number(f.lng),
      lga: f.lga,
      ward: f.ward,
      state: f.state,
    }));
    const existing = selected.filter(s => !newFacilities.find(n => n.id === s.id));
    onSelectionChange([...existing, ...newFacilities]);
  }

  function clearFiltered() {
    const filteredIds = new Set(filtered.map(f => f.id));
    onSelectionChange(selected.filter(s => !filteredIds.has(s.id)));
  }

  const invalidCount = (rawFacilities ?? []).length - facilities.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Facilities</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose the facilities Copilot should assign to your warehouses and group into zones.
          </p>
        </div>
        {selected.length > 0 && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {selected.length} selected
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search facilities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={stateFilter} onValueChange={v => { setStateFilter(v); setLgaFilter('all'); }}>
          <SelectTrigger className="w-36">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {states.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {lgas.length > 0 && (
          <Select value={lgaFilter} onValueChange={setLgaFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="LGA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LGAs</SelectItem>
              {lgas.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" onClick={selectAllFiltered} disabled={filtered.length === 0}>
          Select {filtered.length > 0 ? `${filtered.length} shown` : 'all'}
        </Button>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFiltered}>
            Clear shown
          </Button>
        )}
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onSelectionChange([])}>
            Clear all
          </Button>
        )}
      </div>

      {/* Invalid coordinates notice */}
      {invalidCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-xs">
            {invalidCount} facilit{invalidCount > 1 ? 'ies' : 'y'} excluded — missing or zero coordinates.
          </p>
        </div>
      )}

      {/* List */}
      <ScrollArea className="h-[340px] rounded-lg border">
        {loading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-12 rounded" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No facilities match</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="p-1">
            {filtered.map(f => {
              const isSelected = selectedIds.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggle(f)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary/8 text-primary'
                      : 'hover:bg-muted/60'
                  }`}
                >
                  {isSelected
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[f.lga, f.ward, f.state].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 font-mono">
                    {Number(f.lat).toFixed(3)}, {Number(f.lng).toFixed(3)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={selected.length === 0}>
          Continue with {selected.length} facilit{selected.length !== 1 ? 'ies' : 'y'}
        </Button>
      </div>
    </div>
  );
}
