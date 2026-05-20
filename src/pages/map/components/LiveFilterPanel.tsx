/**
 * LiveFilterPanel - Entity-switching filter sidebar for Live Map
 * Shows vehicles, drivers, deliveries, facilities, warehouses or zones
 * with search, status tabs, and entity layer toggles
 */

import { useState, useMemo } from 'react';
import {
  Search,
  X,
  Truck,
  Users,
  Building2,
  Warehouse,
  MapPin,
  Route,
  Package,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  CheckCircle2,
  Circle,
  Activity,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LiveVehicle, LiveDriver, LiveDelivery } from '@/types/live-map';

/* ── Types ───────────────────────────────────────────── */

type ActivePanel = 'vehicles' | 'drivers' | 'deliveries' | 'facilities' | 'warehouses' | 'zones';
type VehicleTab = 'all' | 'driving' | 'parked';
type DriverTab = 'all' | 'online' | 'offline';
type DeliveryTab = 'all' | 'active' | 'completed';
type StatusTab = 'all' | 'active' | 'inactive';

interface VehicleCardData {
  id: string;
  type: 'vehicle' | 'driver';
  label: string;
  sublabel: string;
  status: 'driving' | 'idle' | 'parked' | 'delayed';
  vehicleType: string;
  hasWarning: boolean;
  position: [number, number];
  batchName?: string;
  batchId?: string | null;
  lastUpdate: Date;
}

/* ── Status helpers ──────────────────────────────────── */

function getVehicleStatus(v: LiveVehicle): VehicleCardData['status'] {
  if (!v.isActive) return 'parked';
  if (v.speed > 0.5) return 'driving';
  return 'idle';
}

function getDriverStatus(d: LiveDriver): VehicleCardData['status'] {
  if (d.status === 'DELAYED') return 'delayed';
  if (d.status === 'EN_ROUTE') return 'driving';
  if (d.status === 'AT_STOP') return 'idle';
  if (d.status === 'INACTIVE' || d.status === 'COMPLETED') return 'parked';
  return d.isOnline ? 'idle' : 'parked';
}

const vehicleStatusConfig = {
  driving: {
    dot: 'bg-emerald-500',
    pulse: true,
    label: 'Driving',
    labelClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  idle: {
    dot: 'bg-amber-500',
    pulse: false,
    label: 'Idle',
    labelClass: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  parked: {
    dot: 'bg-gray-400',
    pulse: false,
    label: 'Parked',
    labelClass: 'text-gray-600 bg-gray-50 border-gray-200',
  },
  delayed: {
    dot: 'bg-red-500',
    pulse: true,
    label: 'Delayed',
    labelClass: 'text-red-700 bg-red-50 border-red-200',
  },
};

const driverStatusLabel: Record<string, { label: string; labelClass: string; dot: string }> = {
  EN_ROUTE:  { label: 'En Route',  labelClass: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  AT_STOP:   { label: 'At Stop',   labelClass: 'text-amber-700 bg-amber-50 border-amber-200',       dot: 'bg-amber-500' },
  DELAYED:   { label: 'Delayed',   labelClass: 'text-red-700 bg-red-50 border-red-200',             dot: 'bg-red-500' },
  ACTIVE:    { label: 'Active',    labelClass: 'text-blue-700 bg-blue-50 border-blue-200',          dot: 'bg-blue-500' },
  INACTIVE:  { label: 'Offline',   labelClass: 'text-gray-600 bg-gray-50 border-gray-200',          dot: 'bg-gray-400' },
  COMPLETED: { label: 'Done',      labelClass: 'text-gray-600 bg-gray-50 border-gray-200',          dot: 'bg-gray-400' },
  SUSPENDED: { label: 'Suspended', labelClass: 'text-orange-700 bg-orange-50 border-orange-200',   dot: 'bg-orange-500' },
};

function formatTime(date: Date) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

/* ── Panel config ────────────────────────────────────── */

const panelConfig: Record<ActivePanel, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  filterKey: keyof ReturnType<typeof useLiveMapStore.getState>['filters'];
  color: string;
}> = {
  vehicles:   { label: 'Vehicles on route', icon: Truck,      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', filterKey: 'showVehicles',   color: 'text-violet-500' },
  drivers:    { label: 'Drivers',           icon: Users,      iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    filterKey: 'showDrivers',    color: 'text-blue-500' },
  deliveries: { label: 'Deliveries',        icon: Package,    iconBg: 'bg-green-100',   iconColor: 'text-green-600',   filterKey: 'showDeliveries', color: 'text-green-500' },
  facilities: { label: 'Facilities',        icon: Building2,  iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', filterKey: 'showFacilities', color: 'text-emerald-500' },
  warehouses: { label: 'Warehouses',        icon: Warehouse,  iconBg: 'bg-violet-100',  iconColor: 'text-violet-600',  filterKey: 'showWarehouses', color: 'text-violet-400' },
  zones:      { label: 'Zones',             icon: MapPin,     iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   filterKey: 'showZones',      color: 'text-amber-500' },
};

/* ── EntityToggleButton (collapsed sidebar) ──────────── */

interface EntityToggleButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  count: number;
  color: string;
  onClick: () => void;
  vertical?: boolean;
}

function EntityToggleButton({ icon: Icon, active, count, color, onClick }: EntityToggleButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative h-8 w-8', active ? color : 'text-muted-foreground')}
          onClick={onClick}
        >
          <Icon className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center leading-none">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{active ? 'Hide' : 'Show'} ({count})</p>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Main component ──────────────────────────────────── */

export function LiveFilterPanel({ onTripSelect }: { onTripSelect?: (batchId: string | null, label?: string) => void }) {
  const filters = useLiveMapStore((s) => s.filters);
  const toggleFilter = useLiveMapStore((s) => s.toggleFilter);
  const resetFilters = useLiveMapStore((s) => s.resetFilters);
  const selectEntity = useLiveMapStore((s) => s.selectEntity);

  const {
    vehicles,
    drivers,
    deliveries,
    facilities,
    warehouses,
    zones,
    counts,
  } = useLiveTrackingCtx();

  const [searchQuery, setSearchQuery] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>('vehicles');
  const [vehicleTab, setVehicleTab]     = useState<VehicleTab>('all');
  const [driverTab, setDriverTab]       = useState<DriverTab>('all');
  const [deliveryTab, setDeliveryTab]   = useState<DeliveryTab>('all');
  const [facilityTab, setFacilityTab]   = useState<StatusTab>('all');
  const [warehouseTab, setWarehouseTab] = useState<StatusTab>('all');
  const [zoneTab, setZoneTab]           = useState<StatusTab>('all');
  const [collapsed, setCollapsed] = useState(false);
  const [activeTripCardId, setActiveTripCardId] = useState<string | null>(null);

  const cfg = panelConfig[activePanel];

  /* ── Vehicle cards ─────────── */
  const vehicleCards = useMemo((): VehicleCardData[] => {
    const vc: VehicleCardData[] = vehicles.map((v) => ({
      id: v.id, type: 'vehicle',
      label: v.plate,
      sublabel: v.driverName || `${v.make || ''} ${v.model || ''}`.trim() || v.type,
      status: getVehicleStatus(v), vehicleType: v.type, hasWarning: false,
      position: v.position,
      batchName: v.batchId ? `Batch ${v.batchId.slice(0, 8)}` : undefined,
      batchId: v.batchId,
      lastUpdate: v.lastUpdate,
    }));
    const dc: VehicleCardData[] = drivers
      .filter((d) => d.position[0] !== 0 && d.position[1] !== 0)
      .map((d) => ({
        id: d.id, type: 'driver',
        label: d.name,
        sublabel: d.phone || 'Driver',
        status: getDriverStatus(d), vehicleType: 'driver', hasWarning: d.status === 'DELAYED',
        position: d.position,
        batchName: d.batchId ? `Batch ${d.batchId.slice(0, 8)}` : undefined,
        batchId: d.batchId,
        lastUpdate: d.lastUpdate,
      }));
    return [...vc, ...dc];
  }, [vehicles, drivers]);

  const filteredVehicleCards = useMemo(() => {
    let r = vehicleCards;
    if (vehicleTab === 'driving') r = r.filter((c) => c.status === 'driving' || c.status === 'delayed');
    else if (vehicleTab === 'parked') r = r.filter((c) => c.status === 'parked' || c.status === 'idle');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((c) => c.label.toLowerCase().includes(q) || c.sublabel.toLowerCase().includes(q) || c.batchName?.toLowerCase().includes(q));
    }
    const order = { delayed: 0, driving: 1, idle: 2, parked: 3 };
    return r.sort((a, b) => order[a.status] - order[b.status]);
  }, [vehicleCards, vehicleTab, searchQuery]);

  const vehicleTabCounts = useMemo(() => ({
    all: vehicleCards.length,
    driving: vehicleCards.filter((c) => c.status === 'driving' || c.status === 'delayed').length,
    parked: vehicleCards.filter((c) => c.status === 'parked' || c.status === 'idle').length,
  }), [vehicleCards]);

  /* ── Driver list ─────────────────────────────────────── */
  const filteredDrivers = useMemo(() => {
    let r = drivers;
    if (driverTab === 'online')  r = r.filter((d) => d.isOnline);
    if (driverTab === 'offline') r = r.filter((d) => !d.isOnline);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((d) => d.name.toLowerCase().includes(q) || d.phone?.toLowerCase().includes(q));
    }
    return r;
  }, [drivers, driverTab, searchQuery]);

  const driverTabCounts = useMemo(() => ({
    all: drivers.length,
    online: drivers.filter((d) => d.isOnline).length,
    offline: drivers.filter((d) => !d.isOnline).length,
  }), [drivers]);

  /* ── Delivery list ───────────────────────────────────── */
  const filteredDeliveries = useMemo(() => {
    let r = deliveries;
    if (deliveryTab === 'active')    r = r.filter((d) => d.status === 'planned' || d.status === 'assigned' || d.status === 'in-progress');
    if (deliveryTab === 'completed') r = r.filter((d) => d.status === 'completed');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((d) => d.name.toLowerCase().includes(q) || d.driverName?.toLowerCase().includes(q));
    }
    return r;
  }, [deliveries, deliveryTab, searchQuery]);

  const deliveryTabCounts = useMemo(() => ({
    all: deliveries.length,
    active: deliveries.filter((d) => d.status === 'planned' || d.status === 'assigned' || d.status === 'in-progress').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  }), [deliveries]);

  /* ── Facility list ───────────────────────────────────── */
  type FacilityRow = { id: string; name: string; type: string | null; lga: string | null; lat: number | null; lng: number | null };
  const filteredFacilities = useMemo(() => {
    let r = (facilities as FacilityRow[]);
    if (facilityTab === 'active')   r = r.filter((f) => f.lat != null && f.lng != null);
    if (facilityTab === 'inactive') r = r.filter((f) => f.lat == null || f.lng == null);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((f) => f.name.toLowerCase().includes(q) || f.lga?.toLowerCase().includes(q) || f.type?.toLowerCase().includes(q));
    }
    return r;
  }, [facilities, facilityTab, searchQuery]);

  const facilityTabCounts = useMemo(() => ({
    all: (facilities as FacilityRow[]).length,
    active: (facilities as FacilityRow[]).filter((f) => f.lat != null && f.lng != null).length,
    inactive: (facilities as FacilityRow[]).filter((f) => f.lat == null || f.lng == null).length,
  }), [facilities]);

  /* ── Warehouse list ──────────────────────────────────── */
  type WarehouseRow = { id: string; name: string; code: string | null; lat: number | null; lng: number | null; is_active: boolean | null };
  const filteredWarehouses = useMemo(() => {
    let r = (warehouses as WarehouseRow[]);
    if (warehouseTab === 'active')   r = r.filter((w) => w.is_active);
    if (warehouseTab === 'inactive') r = r.filter((w) => !w.is_active);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((w) => w.name.toLowerCase().includes(q) || w.code?.toLowerCase().includes(q));
    }
    return r;
  }, [warehouses, warehouseTab, searchQuery]);

  const warehouseTabCounts = useMemo(() => ({
    all: (warehouses as WarehouseRow[]).length,
    active: (warehouses as WarehouseRow[]).filter((w) => w.is_active).length,
    inactive: (warehouses as WarehouseRow[]).filter((w) => !w.is_active).length,
  }), [warehouses]);

  /* ── Zone list ───────────────────────────────────────── */
  type ZoneRow = { id: string; name: string; code: string | null; region_center: { lat: number; lng: number }; is_active: boolean };
  const filteredZones = useMemo(() => {
    let r = (zones as ZoneRow[]);
    if (zoneTab === 'active')   r = r.filter((z) => z.is_active);
    if (zoneTab === 'inactive') r = r.filter((z) => !z.is_active);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter((z) => z.name.toLowerCase().includes(q) || z.code?.toLowerCase().includes(q));
    }
    return r;
  }, [zones, zoneTab, searchQuery]);

  const zoneTabCounts = useMemo(() => ({
    all: (zones as ZoneRow[]).length,
    active: (zones as ZoneRow[]).filter((z) => z.is_active).length,
    inactive: (zones as ZoneRow[]).filter((z) => !z.is_active).length,
  }), [zones]);

  /* ── Counts for the panel header ─────────────────────── */
  const panelCount = {
    vehicles:   vehicleTabCounts.all,
    drivers:    driverTabCounts.all,
    deliveries: deliveryTabCounts.all,
    facilities: facilityTabCounts.all,
    warehouses: warehouseTabCounts.all,
    zones:      zoneTabCounts.all,
  }[activePanel];

  const panelActiveCount = {
    vehicles:   vehicleTabCounts.driving,
    drivers:    driverTabCounts.online,
    deliveries: deliveryTabCounts.active,
    facilities: facilityTabCounts.active,
    warehouses: warehouseTabCounts.active,
    zones:      zoneTabCounts.active,
  }[activePanel];

  const isLayerVisible = filters[cfg.filterKey] as boolean;

  const anyLayerHidden =
    !filters.showDrivers ||
    !filters.showVehicles ||
    !filters.showDeliveries ||
    !filters.showFacilities ||
    !filters.showWarehouses ||
    !filters.showZones ||
    !filters.showRoutes;

  /* ── Handlers ─────────────────────────────────────────── */
  const handlePanelSwitch = (panel: ActivePanel) => {
    setActivePanel(panel);
    setSearchQuery('');
    if (collapsed) setCollapsed(false);
  };

  /* ── Collapsed state ──────────────────────────────────── */
  if (collapsed) {
    return (
      <div className="w-12 border-r bg-card flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(false)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Separator className="my-1 w-6" />
        {(['vehicles', 'drivers', 'deliveries', 'facilities', 'warehouses', 'zones'] as ActivePanel[]).map((p) => {
          const pc = panelConfig[p];
          const cnt = { vehicles: counts.vehicles, drivers: counts.drivers, deliveries: counts.deliveries, facilities: counts.facilities, warehouses: counts.warehouses, zones: counts.zones }[p];
          return (
            <EntityToggleButton
              key={p}
              icon={pc.icon}
              active={filters[pc.filterKey] as boolean}
              count={cnt}
              color={pc.color}
              onClick={() => toggleFilter(pc.filterKey)}
              vertical
            />
          );
        })}
      </div>
    );
  }

  /* ── Shared tab trigger class ─────────────────────────── */
  const tabCls = 'flex-1 h-7 text-xs font-medium data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm';

  return (
    <div className="w-80 border-r bg-card flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', cfg.iconBg)}>
              <cfg.icon className={cn('h-4 w-4', cfg.iconColor)} />
            </div>
            <div>
              <h2 className="font-semibold text-sm leading-tight">{cfg.label}</h2>
              <p className="text-[11px] text-muted-foreground">
                {panelActiveCount} active of {panelCount} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Layer visibility toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', isLayerVisible ? 'text-muted-foreground' : 'text-muted-foreground/40')}
                  onClick={() => toggleFilter(cfg.filterKey)}
                >
                  {isLayerVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isLayerVisible ? 'Hide on map' : 'Show on map'}
              </TooltipContent>
            </Tooltip>
            {/* Collapse */}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setCollapsed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-muted/40 border-transparent focus:border-border focus:bg-background"
            />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs — per panel */}
      <div className="px-3 py-2 border-b">
        {activePanel === 'vehicles' && (
          <Tabs value={vehicleTab} onValueChange={(v) => setVehicleTab(v as VehicleTab)}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className={tabCls}>ALL <TabBadge>{vehicleTabCounts.all}</TabBadge></TabsTrigger>
              <TabsTrigger value="driving" className={tabCls}>DRIVING <TabBadge>{vehicleTabCounts.driving}</TabBadge></TabsTrigger>
              <TabsTrigger value="parked" className={tabCls}>PARKED <TabBadge>{vehicleTabCounts.parked}</TabBadge></TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {activePanel === 'drivers' && (
          <Tabs value={driverTab} onValueChange={(v) => setDriverTab(v as DriverTab)}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className={tabCls}>ALL <TabBadge>{driverTabCounts.all}</TabBadge></TabsTrigger>
              <TabsTrigger value="online" className={tabCls}>ONLINE <TabBadge>{driverTabCounts.online}</TabBadge></TabsTrigger>
              <TabsTrigger value="offline" className={tabCls}>OFFLINE <TabBadge>{driverTabCounts.offline}</TabBadge></TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {activePanel === 'deliveries' && (
          <Tabs value={deliveryTab} onValueChange={(v) => setDeliveryTab(v as DeliveryTab)}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className={tabCls}>ALL <TabBadge>{deliveryTabCounts.all}</TabBadge></TabsTrigger>
              <TabsTrigger value="active" className={tabCls}>ACTIVE <TabBadge>{deliveryTabCounts.active}</TabBadge></TabsTrigger>
              <TabsTrigger value="completed" className={tabCls}>DONE <TabBadge>{deliveryTabCounts.completed}</TabBadge></TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {activePanel === 'facilities' && (
          <Tabs value={facilityTab} onValueChange={(v) => setFacilityTab(v as StatusTab)}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className={tabCls}>ALL <TabBadge>{facilityTabCounts.all}</TabBadge></TabsTrigger>
              <TabsTrigger value="active" className={tabCls}>MAPPED <TabBadge>{facilityTabCounts.active}</TabBadge></TabsTrigger>
              <TabsTrigger value="inactive" className={tabCls}>UNMAPPED <TabBadge>{facilityTabCounts.inactive}</TabBadge></TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {activePanel === 'warehouses' && (
          <Tabs value={warehouseTab} onValueChange={(v) => setWarehouseTab(v as StatusTab)}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className={tabCls}>ALL <TabBadge>{warehouseTabCounts.all}</TabBadge></TabsTrigger>
              <TabsTrigger value="active" className={tabCls}>ACTIVE <TabBadge>{warehouseTabCounts.active}</TabBadge></TabsTrigger>
              <TabsTrigger value="inactive" className={tabCls}>INACTIVE <TabBadge>{warehouseTabCounts.inactive}</TabBadge></TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {activePanel === 'zones' && (
          <Tabs value={zoneTab} onValueChange={(v) => setZoneTab(v as StatusTab)}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5">
              <TabsTrigger value="all" className={tabCls}>ALL <TabBadge>{zoneTabCounts.all}</TabBadge></TabsTrigger>
              <TabsTrigger value="active" className={tabCls}>ACTIVE <TabBadge>{zoneTabCounts.active}</TabBadge></TabsTrigger>
              <TabsTrigger value="inactive" className={tabCls}>INACTIVE <TabBadge>{zoneTabCounts.inactive}</TabBadge></TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">

          {/* Vehicles */}
          {activePanel === 'vehicles' && (
            filteredVehicleCards.length === 0
              ? <EmptyState icon={Truck} message="No vehicles found" />
              : filteredVehicleCards.map((card) => {
                const cardKey = `${card.type}-${card.id}`;
                const isActive = activeTripCardId === cardKey;
                return (
                  <VehicleCard
                    key={cardKey}
                    card={card}
                    onClick={() => selectEntity(card.id, card.type === 'vehicle' ? 'vehicle' : 'driver')}
                    isExpanded={isActive}
                    onTripToggle={() => {
                      if (isActive) {
                        setActiveTripCardId(null);
                        onTripSelect?.(null);
                      } else {
                        setActiveTripCardId(cardKey);
                        onTripSelect?.(card.batchId || null, card.label);
                      }
                    }}
                  />
                );
              })
          )}

          {/* Drivers */}
          {activePanel === 'drivers' && (
            filteredDrivers.length === 0
              ? <EmptyState icon={Users} message="No drivers found" />
              : filteredDrivers.map((d) => (
                <DriverCard key={d.id} driver={d} onClick={() => selectEntity(d.id, 'driver')} />
              ))
          )}

          {/* Deliveries */}
          {activePanel === 'deliveries' && (
            filteredDeliveries.length === 0
              ? <EmptyState icon={Package} message="No deliveries found" />
              : filteredDeliveries.map((d) => (
                <DeliveryCard key={d.id} delivery={d} onClick={() => selectEntity(d.id, 'delivery')} />
              ))
          )}

          {/* Facilities */}
          {activePanel === 'facilities' && (
            filteredFacilities.length === 0
              ? <EmptyState icon={Building2} message="No facilities found" />
              : (filteredFacilities as { id: string; name: string; type: string | null; lga: string | null; lat: number | null; lng: number | null }[]).map((f) => (
                <FacilityCard key={f.id} facility={f} onClick={() => selectEntity(f.id, 'facility')} />
              ))
          )}

          {/* Warehouses */}
          {activePanel === 'warehouses' && (
            filteredWarehouses.length === 0
              ? <EmptyState icon={Warehouse} message="No warehouses found" />
              : (filteredWarehouses as { id: string; name: string; code: string | null; is_active: boolean | null }[]).map((w) => (
                <WarehouseCard key={w.id} warehouse={w} />
              ))
          )}

          {/* Zones */}
          {activePanel === 'zones' && (
            filteredZones.length === 0
              ? <EmptyState icon={MapPin} message="No zones found" />
              : (filteredZones as { id: string; name: string; code: string | null; is_active: boolean }[]).map((z) => (
                <ZoneCard key={z.id} zone={z} />
              ))
          )}

        </div>
      </ScrollArea>

      {/* Reset banner — shown when any layer is hidden */}
      {anyLayerHidden && (
        <div className="border-t px-3 py-1.5 flex items-center justify-between bg-muted/40">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <EyeOff className="h-3 w-3" />
            Some layers are hidden
          </span>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Show all
          </button>
        </div>
      )}

      {/* Entity tab bar */}
      <div className="border-t px-2 py-2">
        <div className="flex items-center gap-0.5">
          <PanelTabButton
            icon={Truck}
            label="Vehicles"
            panel="vehicles"
            active={activePanel === 'vehicles'}
            layerOn={filters.showVehicles}
            count={counts.vehicles}
            color="text-violet-500"
            onSelect={() => handlePanelSwitch('vehicles')}
            onToggle={() => toggleFilter('showVehicles')}
          />
          <PanelTabButton
            icon={Users}
            label="Drivers"
            panel="drivers"
            active={activePanel === 'drivers'}
            layerOn={filters.showDrivers}
            count={counts.drivers}
            color="text-blue-500"
            onSelect={() => handlePanelSwitch('drivers')}
            onToggle={() => toggleFilter('showDrivers')}
          />
          <PanelTabButton
            icon={Package}
            label="Deliveries"
            panel="deliveries"
            active={activePanel === 'deliveries'}
            layerOn={filters.showDeliveries}
            count={counts.deliveries}
            color="text-green-500"
            onSelect={() => handlePanelSwitch('deliveries')}
            onToggle={() => toggleFilter('showDeliveries')}
          />
          <PanelTabButton
            icon={Building2}
            label="Facilities"
            panel="facilities"
            active={activePanel === 'facilities'}
            layerOn={filters.showFacilities}
            count={counts.facilities}
            color="text-emerald-500"
            onSelect={() => handlePanelSwitch('facilities')}
            onToggle={() => toggleFilter('showFacilities')}
          />
          <PanelTabButton
            icon={Warehouse}
            label="Warehouses"
            panel="warehouses"
            active={activePanel === 'warehouses'}
            layerOn={filters.showWarehouses}
            count={counts.warehouses}
            color="text-violet-400"
            onSelect={() => handlePanelSwitch('warehouses')}
            onToggle={() => toggleFilter('showWarehouses')}
          />
          <PanelTabButton
            icon={Route}
            label="Routes"
            panel="zones"
            active={false}
            layerOn={filters.showRoutes}
            color="text-orange-500"
            onSelect={() => {}}
            onToggle={() => toggleFilter('showRoutes')}
          />
          <PanelTabButton
            icon={MapPin}
            label="Zones"
            panel="zones"
            active={activePanel === 'zones'}
            layerOn={filters.showZones}
            count={counts.zones}
            color="text-amber-500"
            onSelect={() => handlePanelSwitch('zones')}
            onToggle={() => toggleFilter('showZones')}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function TabBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px] bg-background/60">
      {children}
    </Badge>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-30" />
      {message}
    </div>
  );
}

/* ── Vehicle Card ─────────────────────────────────────── */

function VehicleCard({ card, onClick, isExpanded, onTripToggle }: {
  card: VehicleCardData;
  onClick: () => void;
  isExpanded: boolean;
  onTripToggle: () => void;
}) {
  const cfg = vehicleStatusConfig[card.status];
  return (
    <div
      className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors group cursor-pointer', isExpanded && 'bg-accent/30')}
      onClick={onClick}
    >
      <div className="relative shrink-0">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center',
          card.status === 'driving' || card.status === 'delayed' ? 'bg-emerald-50 border border-emerald-200' : 'bg-muted/60 border border-border')}>
          {card.type === 'vehicle'
            ? <Truck className={cn('h-5 w-5', card.status === 'driving' ? 'text-emerald-600' : 'text-muted-foreground')} />
            : <Users className={cn('h-5 w-5', card.status === 'driving' ? 'text-emerald-600' : 'text-muted-foreground')} />}
        </div>
        <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card', cfg.dot)}>
          {cfg.pulse && <span className={cn('absolute inset-0 rounded-full animate-ping opacity-75', cfg.dot)} />}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('font-semibold text-sm truncate', card.status === 'driving' && 'text-emerald-700')}>{card.label}</span>
          {card.hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">{card.batchName || card.sublabel}</div>
        <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{formatTime(card.lastUpdate)}</div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border font-medium', cfg.labelClass)}>
          {cfg.label}
        </Badge>
        <button
          onClick={(e) => { e.stopPropagation(); onTripToggle(); }}
          className={cn(
            'text-[10px] font-medium flex items-center gap-0.5 transition-all rounded px-1',
            isExpanded
              ? 'text-blue-600 opacity-100'
              : 'text-emerald-600 opacity-0 group-hover:opacity-100 hover:bg-emerald-50',
          )}
        >
          TRIP {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

/* ── Driver Card ──────────────────────────────────────── */

function DriverCard({ driver, onClick }: { driver: LiveDriver; onClick: () => void }) {
  const sc = driverStatusLabel[driver.status] ?? driverStatusLabel['INACTIVE'];
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors group">
      <div className="relative shrink-0">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center',
          driver.isOnline ? 'bg-blue-50 border border-blue-200' : 'bg-muted/60 border border-border')}>
          <Users className={cn('h-5 w-5', driver.isOnline ? 'text-blue-600' : 'text-muted-foreground')} />
        </div>
        <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card', sc.dot)}>
          {(driver.status === 'EN_ROUTE' || driver.status === 'DELAYED') && (
            <span className={cn('absolute inset-0 rounded-full animate-ping opacity-75', sc.dot)} />
          )}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{driver.name}</span>
          {driver.status === 'DELAYED' && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">{driver.phone || (driver.batchId ? `Batch ${driver.batchId.slice(0, 8)}` : 'No active batch')}</div>
        <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{formatTime(driver.lastUpdate)}</div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border font-medium', sc.labelClass)}>
          {sc.label}
        </Badge>
        <span className={cn('text-[10px] font-medium flex items-center gap-0.5', driver.isOnline ? 'text-emerald-500' : 'text-muted-foreground/50')}>
          <Activity className="h-2.5 w-2.5" />
          {driver.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </button>
  );
}

/* ── Delivery Card ────────────────────────────────────── */

function DeliveryCard({ delivery, onClick }: { delivery: LiveDelivery; onClick: () => void }) {
  const isRunning = delivery.status === 'in-progress' || delivery.status === 'assigned';
  const isPlanned = delivery.status === 'planned';
  const pct = Math.round(delivery.progress);
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors group">
      <div className="relative shrink-0">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center',
          isRunning ? 'bg-green-50 border border-green-200'
          : isPlanned ? 'bg-blue-50 border border-blue-200'
          : 'bg-muted/60 border border-border')}>
          <Package className={cn('h-5 w-5', isRunning ? 'text-green-600' : isPlanned ? 'text-blue-600' : 'text-muted-foreground')} />
        </div>
        <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
          isRunning ? 'bg-green-500' : isPlanned ? 'bg-blue-400' : 'bg-gray-400')}>
          {isRunning && <span className="absolute inset-0 rounded-full animate-ping opacity-75 bg-green-500" />}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{delivery.name}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{delivery.driverName || 'Unassigned driver'}</div>
        {/* Progress bar */}
        <div className="mt-1 flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {delivery.completedStops}/{delivery.totalStops}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border font-medium',
          isRunning ? 'text-green-700 bg-green-50 border-green-200'
          : isPlanned ? 'text-blue-700 bg-blue-50 border-blue-200'
          : 'text-gray-600 bg-gray-50 border-gray-200')}>
          {isRunning ? 'Active' : isPlanned ? 'Planned' : 'Done'}
        </Badge>
        <span className="text-[10px] text-muted-foreground/70 font-mono">{pct}%</span>
      </div>
    </button>
  );
}

/* ── Facility Card ────────────────────────────────────── */

function FacilityCard({ facility, onClick }: {
  facility: { id: string; name: string; type: string | null; lga: string | null; lat: number | null; lng: number | null };
  onClick: () => void;
}) {
  const mapped = facility.lat != null && facility.lng != null;
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors group">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
        mapped ? 'bg-emerald-50 border border-emerald-200' : 'bg-muted/60 border border-border')}>
        <Building2 className={cn('h-5 w-5', mapped ? 'text-emerald-600' : 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm truncate block">{facility.name}</span>
        <div className="text-xs text-muted-foreground truncate">{facility.lga || 'No LGA'}</div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {facility.type && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium capitalize">
            {facility.type}
          </Badge>
        )}
        {mapped
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
      </div>
    </button>
  );
}

/* ── Warehouse Card ───────────────────────────────────── */

function WarehouseCard({ warehouse }: { warehouse: { id: string; name: string; code: string | null; is_active: boolean | null } }) {
  const active = warehouse.is_active ?? true;
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
        active ? 'bg-violet-50 border border-violet-200' : 'bg-muted/60 border border-border')}>
        <Warehouse className={cn('h-5 w-5', active ? 'text-violet-600' : 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm truncate block">{warehouse.name}</span>
        <div className="text-xs text-muted-foreground">{warehouse.code || '—'}</div>
      </div>
      <div className="shrink-0">
        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border font-medium',
          active ? 'text-violet-700 bg-violet-50 border-violet-200' : 'text-gray-600 bg-gray-50 border-gray-200')}>
          {active ? 'Active' : 'Inactive'}
        </Badge>
      </div>
    </div>
  );
}

/* ── Zone Card ────────────────────────────────────────── */

function ZoneCard({ zone }: { zone: { id: string; name: string; code: string | null; is_active: boolean } }) {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
        zone.is_active ? 'bg-amber-50 border border-amber-200' : 'bg-muted/60 border border-border')}>
        <MapPin className={cn('h-5 w-5', zone.is_active ? 'text-amber-600' : 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm truncate block">{zone.name}</span>
        <div className="text-xs text-muted-foreground">{zone.code || '—'}</div>
      </div>
      <div className="shrink-0">
        <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border font-medium',
          zone.is_active ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-gray-600 bg-gray-50 border-gray-200')}>
          {zone.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>
    </div>
  );
}

/* ── Panel Tab Button ─────────────────────────────────── */

function PanelTabButton({
  icon: Icon, label, active, layerOn, count, color, onSelect, onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  panel: ActivePanel;
  active: boolean;
  layerOn: boolean;
  count?: number;
  color: string;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onSelect}
          onContextMenu={(e) => { e.preventDefault(); onToggle(); }}
          className={cn(
            'relative flex items-center justify-center rounded-md transition-all h-7 w-7',
            active
              ? 'bg-accent text-accent-foreground ring-1 ring-border'
              : layerOn
                ? 'text-muted-foreground hover:text-muted-foreground hover:bg-accent/50'
                : 'text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-accent/30',
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', (active || layerOn) && color)} />
          {count !== undefined && layerOn && (
            <span className="absolute -top-1 -right-1 h-3.5 min-w-[14px] rounded-full bg-foreground text-background text-[8px] font-bold flex items-center justify-center px-0.5">
              {count > 99 ? '99+' : count}
            </span>
          )}
          {/* dim dot when layer is hidden */}
          {!layerOn && (
            <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p>{label}{count !== undefined ? ` (${count})` : ''}</p>
        <p className="text-muted-foreground text-[10px]">Click to view · Right-click to toggle layer</p>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Keep types re-exported for use in other files ─────── */
// (LiveDriver is already exported from types/live-map)
