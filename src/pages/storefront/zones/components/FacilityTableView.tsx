import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  ArrowUpDown,
  Building2,
  Download,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useOperationalZones } from '@/hooks/useOperationalZones';

interface FacilityRow {
  id: string;
  name: string;
  level_of_care: string | null;
  lga: string | null;
  lat: number;
  lng: number;
  type: string;
  programme: string | null;
  ip_name: string | null;
  zone_name: string | null;
  zone_id: string | null;
  service_area_name: string | null;
  service_area_id: string | null;
  delivery_frequency: string | null;
  priority: string | null;
  route_name: string | null;
  route_id: string | null;
  route_status: string | null;
  sequence_order: number | null;
  distance_from_previous_km: number | null;
  warehouse_name: string | null;
  distance_to_warehouse_km: number | null;
}

type SortField = 'name' | 'lga' | 'level_of_care' | 'zone_name' | 'service_area_name' | 'route_name' | 'distance_to_warehouse_km';
type SortDir = 'asc' | 'desc';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useFacilityAuditData() {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['facility-audit-view', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      // 1. Fetch facilities scoped to the current workspace
      const { data: facilities, error: facErr } = await supabase
        .from('facilities')
        .select('id, name, level_of_care, lga, lat, lng, type, programme, ip_name, zone_id, zones:zone_id(id, name)')
        .eq('workspace_id', workspaceId!)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (facErr) throw new Error(`Facilities: ${facErr.message}`);

      // 2. Fetch service area assignments with SA + warehouse info
      const { data: saAssignments, error: saErr } = await supabase
        .from('service_area_facilities')
        .select('facility_id, service_areas:service_area_id(id, name, delivery_frequency, priority, warehouse_id, warehouses:warehouse_id(id, name, lat, lng))');

      if (saErr) throw new Error(`SA assignments: ${saErr.message}`);

      // 3. Fetch route assignments with route info
      const { data: routeAssignments, error: rtErr } = await supabase
        .from('route_facilities')
        .select('facility_id, sequence_order, distance_from_previous_km, routes:route_id(id, name, status)');

      if (rtErr) throw new Error(`Route assignments: ${rtErr.message}`);

      // Index lookups
      const saMap = new Map<string, typeof saAssignments[0]>();
      for (const sa of saAssignments || []) {
        saMap.set(sa.facility_id, sa);
      }

      const rtMap = new Map<string, typeof routeAssignments[0]>();
      for (const rt of routeAssignments || []) {
        rtMap.set(rt.facility_id, rt);
      }

      // Compose rows
      const rows: FacilityRow[] = (facilities || []).map((f: any) => {
        const sa = saMap.get(f.id);
        const rt = rtMap.get(f.id);
        const saData = sa?.service_areas as any;
        const whData = saData?.warehouses as any;
        const rtData = rt?.routes as any;

        const distToWarehouse =
          whData && f.lat && f.lng && whData.lat && whData.lng
            ? Math.round(haversineKm(f.lat, f.lng, whData.lat, whData.lng) * 10) / 10
            : null;

        return {
          id: f.id,
          name: f.name,
          level_of_care: f.level_of_care,
          lga: f.lga,
          lat: f.lat,
          lng: f.lng,
          type: f.type,
          programme: f.programme,
          ip_name: f.ip_name,
          zone_name: (f.zones as any)?.name || null,
          zone_id: f.zone_id,
          service_area_name: saData?.name || null,
          service_area_id: saData?.id || null,
          delivery_frequency: saData?.delivery_frequency || null,
          priority: saData?.priority || null,
          route_name: rtData?.name || null,
          route_id: rtData?.id || null,
          route_status: rtData?.status || null,
          sequence_order: rt?.sequence_order ?? null,
          distance_from_previous_km: rt?.distance_from_previous_km ?? null,
          warehouse_name: whData?.name || null,
          distance_to_warehouse_km: distToWarehouse,
        };
      });

      return rows;
    },
    staleTime: 30_000,
  });
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  standard: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const routeStatusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  locked: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

type CoverageFilter = 'all' | 'assigned' | 'unassigned';

export function FacilityTableView() {
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { zones } = useOperationalZones();
  const { data: rows, isLoading } = useFacilityAuditData();

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    let result = rows;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.lga?.toLowerCase().includes(q) ||
          r.service_area_name?.toLowerCase().includes(q) ||
          r.route_name?.toLowerCase().includes(q) ||
          r.warehouse_name?.toLowerCase().includes(q)
      );
    }

    if (zoneFilter !== 'all') {
      result = result.filter((r) => r.zone_id === zoneFilter);
    }

    if (coverageFilter === 'assigned') {
      result = result.filter((r) => r.service_area_id || r.route_id);
    } else if (coverageFilter === 'unassigned') {
      result = result.filter((r) => !r.service_area_id && !r.route_id);
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rows, search, zoneFilter, coverageFilter, sortField, sortDir]);

  const stats = useMemo(() => {
    if (!rows) return { total: 0, withSA: 0, withRoute: 0, unassigned: 0 };
    const withSA = rows.filter((r) => r.service_area_id).length;
    const withRoute = rows.filter((r) => r.route_id).length;
    const unassigned = rows.filter((r) => !r.service_area_id && !r.route_id).length;
    return { total: rows.length, withSA, withRoute, unassigned };
  }, [rows]);

  const handleExport = () => {
    if (!filtered.length) return;
    const headers = [
      'Facility', 'Level of Care', 'LGA', 'Zone', 'Service Area',
      'Priority', 'Frequency', 'Route', 'Route Status', 'Seq',
      'Warehouse', 'Distance to Warehouse (km)',
    ];
    const csvRows = filtered.map((r) => [
      r.name,
      r.level_of_care || '',
      r.lga || '',
      r.zone_name || '',
      r.service_area_name || '',
      r.priority || '',
      r.delivery_frequency || '',
      r.route_name || '',
      r.route_status || '',
      r.sequence_order ?? '',
      r.warehouse_name || '',
      r.distance_to_warehouse_km ?? '',
    ]);
    const csv = [headers, ...csvRows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facility-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortableHead = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/40'}`} />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Facility Audit</h2>
          <p className="text-muted-foreground mt-1">
            Cross-reference view of all facilities across zones, service areas, and routes
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!filtered.length}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total Facilities" value={stats.total} />
        <SummaryCard label="In Service Areas" value={stats.withSA} accent="text-blue-600 dark:text-blue-400" />
        <SummaryCard label="On Routes" value={stats.withRoute} accent="text-green-600 dark:text-green-400" />
        <SummaryCard
          label="Unassigned"
          value={stats.unassigned}
          accent={stats.unassigned > 0 ? 'text-orange-600 dark:text-orange-400' : undefined}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search facilities, LGA, SA, route..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones?.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={coverageFilter} onValueChange={(v) => setCoverageFilter(v as CoverageFilter)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Coverage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Facilities</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} of {stats.total} facilities
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead field="name">Facility</SortableHead>
              <SortableHead field="level_of_care">LoC</SortableHead>
              <SortableHead field="lga">LGA</SortableHead>
              <SortableHead field="zone_name">Zone</SortableHead>
              <SortableHead field="service_area_name">Service Area</SortableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Frequency</TableHead>
              <SortableHead field="route_name">Route</SortableHead>
              <TableHead className="text-center">Seq</TableHead>
              <SortableHead field="distance_to_warehouse_km">Dist. to WH</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium truncate max-w-[200px] block">
                            {row.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            <p className="font-medium">{row.name}</p>
                            {row.programme && <p>Programme: {row.programme}</p>}
                            {row.ip_name && <p>IP: {row.ip_name}</p>}
                            <p>Type: {row.type}</p>
                            <p>Coords: {row.lat.toFixed(4)}, {row.lng.toFixed(4)}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-sm">{row.level_of_care || '—'}</TableCell>
                  <TableCell className="text-sm">{row.lga || '—'}</TableCell>
                  <TableCell className="text-sm">{row.zone_name || '—'}</TableCell>
                  <TableCell>
                    {row.service_area_name ? (
                      <span className="text-sm">{row.service_area_name}</span>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">None</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.priority ? (
                      <Badge className={priorityColors[row.priority] || ''}>{row.priority}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{row.delivery_frequency || '—'}</TableCell>
                  <TableCell>
                    {row.route_name ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{row.route_name}</span>
                        {row.route_status && (
                          <Badge variant="secondary" className={`text-xs ${routeStatusColors[row.route_status] || ''}`}>
                            {row.route_status}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">None</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {row.sequence_order != null ? `#${row.sequence_order}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {row.distance_to_warehouse_km != null ? (
                      <span className={row.distance_to_warehouse_km > 100 ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
                        {row.distance_to_warehouse_km} km
                      </span>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Building2 className="h-8 w-8" />
                    <p>No facilities match the current filters.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent || ''}`}>{value}</p>
    </div>
  );
}
