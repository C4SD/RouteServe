/**
 * EntityDetailPanel - Right slide-in panel for entity details
 * Self-fetches rich data for facility/warehouse; uses live data for driver/vehicle/delivery.
 */

import {
  X, User, Truck, Package, MapPin, Clock, Gauge, Battery, Signal,
  Navigation, Phone, Mail, CheckCircle, Building2, Warehouse,
  Layers, Thermometer, Activity, CircleDot, BadgeCheck, Zap,
  Copy, Check, RefreshCw, AlertCircle, LayoutGrid,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useFacility } from '@/hooks/useFacilities';
import { useWarehouse } from '@/hooks/useWarehouses';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  EntityType, LiveDriver, LiveVehicle, LiveDelivery, DriverStatus,
} from '@/types/live-map';

interface EntityDetailPanelProps {
  entityId: string;
  entityType: EntityType;
  entityData: LiveDriver | LiveVehicle | LiveDelivery | null | undefined;
  onClose: () => void;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<DriverStatus, string> = {
  INACTIVE: 'bg-gray-500',
  ACTIVE: 'bg-blue-500',
  EN_ROUTE: 'bg-blue-500',
  AT_STOP: 'bg-green-500',
  DELAYED: 'bg-red-500',
  COMPLETED: 'bg-emerald-500',
  SUSPENDED: 'bg-amber-500',
};
const STATUS_LABELS: Record<DriverStatus, string> = {
  INACTIVE: 'Inactive', ACTIVE: 'Active', EN_ROUTE: 'En Route',
  AT_STOP: 'At Stop', DELAYED: 'Delayed', COMPLETED: 'Completed', SUSPENDED: 'Suspended',
};

function CoordCopy({ lat, lng }: { lat: number; lng: number }) {
  const [copied, setCopied] = useState(false);
  const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 group text-left w-full"
      title="Copy coordinates"
    >
      <span className="font-mono text-xs tabular-nums text-muted-foreground group-hover:text-foreground transition-colors flex-1">
        {text}
      </span>
      {copied
        ? <Check className="h-3 w-3 text-green-500 shrink-0" />
        : <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
      }
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon?: React.ElementType; label?: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      {label && <span className="text-muted-foreground shrink-0 min-w-[80px]">{label}</span>}
      <span className="flex-1 text-right font-medium leading-snug">{value || '—'}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export function EntityDetailPanel({ entityId, entityType, entityData, onClose }: EntityDetailPanelProps) {
  const entityIcons: Record<EntityType, { Icon: React.ElementType; color: string; label: string }> = {
    driver:    { Icon: User,      color: 'text-blue-500',    label: 'Driver' },
    vehicle:   { Icon: Truck,     color: 'text-purple-500',  label: 'Vehicle' },
    delivery:  { Icon: Package,   color: 'text-green-500',   label: 'Delivery Batch' },
    facility:  { Icon: Building2, color: 'text-emerald-500', label: 'Facility' },
    warehouse: { Icon: Warehouse, color: 'text-amber-500',   label: 'Warehouse' },
  };

  const { Icon, color, label } = entityIcons[entityType];

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <h3 className="font-semibold text-sm">{label} Details</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {entityType === 'driver'    && <DriverContent    driver={entityData as LiveDriver} />}
        {entityType === 'vehicle'   && <VehicleContent   vehicle={entityData as LiveVehicle} />}
        {entityType === 'delivery'  && <DeliveryContent  delivery={entityData as LiveDelivery} />}
        {entityType === 'facility'  && <FacilityContent  facilityId={entityId} />}
        {entityType === 'warehouse' && <WarehouseContent warehouseId={entityId} />}
      </div>
    </div>
  );
}

// ── Facility (self-fetching) ───────────────────────────────────────────────────

function FacilityContent({ facilityId }: { facilityId: string }) {
  const { data: f, isLoading, error, refetch } = useFacility(facilityId);

  // Fetch recent deliveries for this facility
  const { data: recentDeliveries } = useQuery({
    queryKey: ['facility-deliveries', facilityId],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_batches')
        .select('id, status, created_at, driver:drivers(name)')
        .contains('facility_ids', [facilityId])
        .order('created_at', { ascending: false })
        .limit(4);
      return data || [];
    },
    enabled: !!facilityId,
    staleTime: 60000,
  });

  if (isLoading) return <PanelSkeleton rows={8} />;
  if (error || !f) return <PanelError onRetry={() => refetch()} />;

  const hasContact = f.phone || f.email || f.contactPerson || f.contact_name_pharmacy;
  const hasPrograms = f.programme || f.ip_name || f.funding_source || f.level_of_care;
  const services = [
    f.pcr_service && 'PCR',
    f.cd4_service && 'CD4',
    ...(f.type_of_service ? f.type_of_service.split(',').map((s: string) => s.trim()) : []),
  ].filter(Boolean) as string[];

  return (
    <div className="divide-y">
      {/* Identity block */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold leading-snug">{f.name}</h4>
            <div className="flex flex-wrap gap-1 mt-1">
              {f.type && <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{f.type}</Badge>}
              {f.warehouse_code && (
                <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-mono">{f.warehouse_code}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Pulse indicator */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active Facility
        </div>
      </div>

      {/* Location */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Location">
          {f.address && <Row icon={MapPin} value={f.address} />}
          <div className="grid grid-cols-2 gap-1 text-sm">
            {f.lga   && <div><span className="text-muted-foreground text-xs">LGA</span><div className="font-medium text-xs mt-0.5">{f.lga}</div></div>}
            {f.ward  && <div><span className="text-muted-foreground text-xs">Ward</span><div className="font-medium text-xs mt-0.5">{f.ward}</div></div>}
            {f.service_zone && <div><span className="text-muted-foreground text-xs">Zone</span><div className="font-medium text-xs mt-0.5">{f.service_zone}</div></div>}
            {f.state && <div><span className="text-muted-foreground text-xs">State</span><div className="font-medium text-xs mt-0.5 capitalize">{f.state}</div></div>}
          </div>
          <div className="bg-muted/40 rounded-lg px-2.5 py-2">
            <p className="text-xs text-muted-foreground mb-1">Coordinates</p>
            <CoordCopy lat={f.lat} lng={f.lng} />
          </div>
        </Section>
      </div>

      {/* Contact */}
      {hasContact && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Contact">
            {(f.contactPerson || f.contact_name_pharmacy) && (
              <Row icon={User} value={
                <span>{f.contactPerson || f.contact_name_pharmacy}
                  {f.designation && <span className="text-muted-foreground font-normal ml-1">· {f.designation}</span>}
                </span>
              } />
            )}
            {f.phone && (
              <a href={`tel:${f.phone}`} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {f.phone}
              </a>
            )}
            {f.phone_pharmacy && f.phone_pharmacy !== f.phone && (
              <a href={`tel:${f.phone_pharmacy}`} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {f.phone_pharmacy}
                <span className="text-xs text-muted-foreground">(pharmacy)</span>
              </a>
            )}
            {f.email && (
              <a href={`mailto:${f.email}`} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{f.email}</span>
              </a>
            )}
            {f.operatingHours && (
              <Row icon={Clock} value={f.operatingHours} />
            )}
          </Section>
        </div>
      )}

      {/* Programs & Funding */}
      {hasPrograms && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Programs & Funding">
            <div className="space-y-1.5">
              {f.programme     && <Row label="Programme"  value={f.programme} />}
              {f.ip_name       && <Row label="IP"         value={f.ip_name} />}
              {f.funding_source && <Row label="Funding"   value={f.funding_source} />}
              {f.level_of_care && <Row label="Level"      value={f.level_of_care} />}
            </div>
          </Section>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Services">
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs gap-1">
                  <Zap className="h-2.5 w-2.5" />
                  {s}
                </Badge>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Capacity */}
      {(f.capacity || f.storage_capacity) && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Capacity">
            {f.storage_capacity && (
              <StatCard label="Storage Capacity" value={`${f.storage_capacity.toLocaleString()}`} sub="units" />
            )}
            {f.capacity && !f.storage_capacity && (
              <StatCard label="Capacity" value={f.capacity.toLocaleString()} />
            )}
          </Section>
        </div>
      )}

      {/* Recent deliveries */}
      {recentDeliveries && recentDeliveries.length > 0 && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Recent Deliveries">
            <div className="space-y-2">
              {recentDeliveries.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium">{(d.driver as any)?.name || 'Unknown driver'}</span>
                    <span className="text-muted-foreground ml-1">
                      · {new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <DeliveryStatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ── Warehouse (self-fetching) ─────────────────────────────────────────────────

function WarehouseContent({ warehouseId }: { warehouseId: string }) {
  const { data: w, isLoading, error, refetch } = useWarehouse(warehouseId);

  // Recent delivery batches dispatched from this warehouse
  const { data: recentBatches } = useQuery({
    queryKey: ['warehouse-batches', warehouseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_batches')
        .select('id, status, created_at, driver:drivers(name)')
        .eq('warehouse_id', warehouseId)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!warehouseId,
    staleTime: 30000,
  });

  if (isLoading) return <PanelSkeleton rows={10} />;
  if (error || !w) return <PanelError onRetry={() => refetch()} />;

  const capacityPct = w.total_capacity_m3 && w.used_capacity_m3
    ? Math.min(100, Math.round((w.used_capacity_m3 / w.total_capacity_m3) * 100))
    : null;

  const caps = w.capabilities;

  return (
    <div className="divide-y">
      {/* Identity */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Warehouse className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold leading-snug">{w.name}</h4>
            <div className="flex flex-wrap gap-1 mt-1">
              {w.code && <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-mono">{w.code}</Badge>}
              <Badge variant={w.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 h-4">
                {w.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {w.storage_mode === 'passive' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 h-4">Passive</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Capabilities chips */}
        <div className="flex gap-1.5">
          {caps.can_receive  && <CapBadge label="Receive"  />}
          {caps.can_dispatch && <CapBadge label="Dispatch" active />}
          {caps.can_store    && <CapBadge label="Store"    />}
        </div>
      </div>

      {/* Capacity */}
      {w.total_capacity_m3 && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Capacity">
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Total"
                value={`${w.total_capacity_m3.toFixed(0)} m³`}
              />
              <StatCard
                label="Used"
                value={w.used_capacity_m3 ? `${w.used_capacity_m3.toFixed(0)} m³` : '—'}
              />
            </div>
            {capacityPct !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Utilization</span>
                  <span className="font-medium text-foreground">{capacityPct}%</span>
                </div>
                <Progress value={capacityPct} className="h-1.5" />
              </div>
            )}
            {w.storage_conditions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {w.storage_conditions.map((c: string) => (
                  <Badge key={c} variant="secondary" className="text-[10px] gap-1 px-1.5 h-4">
                    <Thermometer className="h-2.5 w-2.5" />{c}
                  </Badge>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Storage zones */}
      {w.storage_zones && w.storage_zones.length > 0 && (
        <div className="px-4 py-4 space-y-3">
          <Section title={`Storage Zones (${w.storage_zones.length})`}>
            <div className="space-y-2">
              {w.storage_zones.map((z: any) => {
                const pct = z.capacity_m3 ? Math.min(100, Math.round((z.used_m3 / z.capacity_m3) * 100)) : 0;
                return (
                  <div key={z.id} className="bg-muted/40 rounded-lg px-2.5 py-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">{z.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1">{z.type}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{z.used_m3}/{z.capacity_m3} m³</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1" />
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      )}

      {/* Location */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Location">
          {(w.address || w.city) && (
            <Row icon={MapPin} value={[w.address, w.city, w.state].filter(Boolean).join(', ')} />
          )}
          {w.lat && w.lng && (
            <div className="bg-muted/40 rounded-lg px-2.5 py-2">
              <p className="text-xs text-muted-foreground mb-1">Coordinates</p>
              <CoordCopy lat={w.lat} lng={w.lng} />
            </div>
          )}
          {w.operating_hours && <Row icon={Clock} value={w.operating_hours} />}
        </Section>
      </div>

      {/* Contact */}
      {(w.contact_name || w.contact_phone || w.contact_email) && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Contact">
            {w.contact_name  && <Row icon={User}  value={w.contact_name} />}
            {w.contact_phone && (
              <a href={`tel:${w.contact_phone}`} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors">
                <Phone className="h-3.5 w-3.5 shrink-0" />{w.contact_phone}
              </a>
            )}
            {w.contact_email && (
              <a href={`mailto:${w.contact_email}`} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{w.contact_email}</span>
              </a>
            )}
          </Section>
        </div>
      )}

      {/* Recent deliveries */}
      {recentBatches && recentBatches.length > 0 && (
        <div className="px-4 py-4 space-y-3">
          <Section title="Recent Dispatches">
            <div className="space-y-2">
              {recentBatches.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium">{(b.driver as any)?.name || 'No driver'}</span>
                    <span className="text-muted-foreground ml-1">
                      · {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <DeliveryStatusBadge status={b.status} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* No dispatches state */}
      {recentBatches && recentBatches.length === 0 && (
        <div className="px-4 py-4">
          <div className="text-xs text-muted-foreground text-center py-2">No recent dispatches</div>
        </div>
      )}
    </div>
  );
}

// ── Driver ────────────────────────────────────────────────────────────────────

function DriverContent({ driver }: { driver: LiveDriver }) {
  if (!driver) return <PanelError />;

  const fmtTime = (d: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(d);
  const speedKmh = Math.round((driver.speed || 0) * 3.6);

  return (
    <div className="divide-y">
      {/* Identity */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold">{driver.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${STATUS_COLORS[driver.status]} text-white text-[10px] h-4 px-1.5`}>
                {STATUS_LABELS[driver.status]}
              </Badge>
              {driver.isOnline && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Online
                </span>
              )}
            </div>
          </div>
        </div>

        {driver.email && (
          <a href={`mailto:${driver.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Mail className="h-3.5 w-3.5" />{driver.email}
          </a>
        )}
        {driver.phone && (
          <a href={`tel:${driver.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="h-3.5 w-3.5" />{driver.phone}
          </a>
        )}
      </div>

      {/* Live telemetry */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Live Telemetry">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Speed" value={`${speedKmh} km/h`} />
            <StatCard label="Heading" value={`${Math.round(driver.heading || 0)}°`} />
            {driver.batteryLevel !== undefined && (
              <StatCard
                label="Battery"
                value={<span className={driver.batteryLevel < 20 ? 'text-red-500' : undefined}>{driver.batteryLevel}%</span>}
              />
            )}
            <StatCard label="GPS Accuracy" value={`±${Math.round(driver.accuracy)}m`} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last update: {fmtTime(driver.lastUpdate)}
          </div>
        </Section>
      </div>

      {/* Assignment */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Assignment">
          {driver.batchId ? (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                <Activity className="h-3 w-3" />Active Batch
              </div>
              <div className="font-mono text-xs text-muted-foreground">{driver.batchId.slice(0, 16)}…</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No active assignment</div>
          )}
          {driver.vehicleId && (
            <Row icon={Truck} label="Vehicle" value={driver.vehicleId.slice(0, 8) + '…'} />
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Vehicle ───────────────────────────────────────────────────────────────────

function VehicleContent({ vehicle }: { vehicle: LiveVehicle }) {
  if (!vehicle) return <PanelError />;

  const speedKmh = Math.round((vehicle.speed || 0) * 3.6);
  const fmtTime = (d: Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(d);

  return (
    <div className="divide-y">
      {/* Identity */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold">{vehicle.plate}</h4>
            <div className="text-sm text-muted-foreground mt-0.5">
              {[vehicle.make, vehicle.model, vehicle.type].filter(Boolean).join(' · ')}
            </div>
            <Badge variant={vehicle.isActive ? 'default' : 'secondary'} className="mt-1 text-[10px] h-4 px-1.5">
              {vehicle.isActive ? 'Active' : 'Idle'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Live telemetry */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Live Telemetry">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Speed" value={`${speedKmh} km/h`} />
            {vehicle.fuelLevel !== undefined && (
              <StatCard
                label="Fuel"
                value={<span className={vehicle.fuelLevel < 20 ? 'text-red-500' : undefined}>{vehicle.fuelLevel}%</span>}
              />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last update: {fmtTime(vehicle.lastUpdate)}
          </div>
        </Section>
      </div>

      {/* Payload / capacity */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Payload & Capacity">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilization</span>
              <span className="font-semibold">{Math.round(vehicle.utilization)}%</span>
            </div>
            <Progress value={vehicle.utilization} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Used: {Math.round(vehicle.capacity * vehicle.utilization / 100)} units</span>
              <span>Max: {vehicle.capacity} units</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Assignment */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Assignment">
          {vehicle.driverName ? (
            <Row icon={User} label="Driver" value={vehicle.driverName} />
          ) : (
            <div className="text-sm text-muted-foreground">No driver assigned</div>
          )}
          {vehicle.batchId && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <Package className="h-3 w-3" />Active Delivery
              </div>
              <div className="font-mono text-xs text-muted-foreground">{vehicle.batchId.slice(0, 16)}…</div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Delivery ──────────────────────────────────────────────────────────────────

function DeliveryContent({ delivery }: { delivery: LiveDelivery }) {
  if (!delivery) return <PanelError />;

  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(d);

  return (
    <div className="divide-y">
      {/* Identity */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold leading-snug">{delivery.name}</h4>
            <Badge className={`${STATUS_COLORS[delivery.driverStatus]} text-white mt-1 text-[10px] h-4 px-1.5`}>
              {STATUS_LABELS[delivery.driverStatus]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-4 space-y-3">
        <Section title="Progress">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Total" value={delivery.totalStops} sub="stops" />
            <StatCard label="Done"  value={delivery.completedStops} sub="stops" />
            <StatCard label="Left"  value={delivery.totalStops - delivery.completedStops} sub="stops" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Stop {delivery.currentStopIndex + 1} of {delivery.totalStops}</span>
              <span className="font-medium text-foreground">{Math.round(delivery.progress)}%</span>
            </div>
            <Progress value={delivery.progress} className="h-2" />
          </div>
          {delivery.startTime && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />Started: {fmtTime(delivery.startTime)}
            </div>
          )}
        </Section>
      </div>

      {/* Driver */}
      {delivery.driverName && (
        <div className="px-4 py-4">
          <Section title="Driver">
            <Row icon={User} value={delivery.driverName} />
          </Section>
        </div>
      )}

      {/* Stops */}
      <div className="px-4 py-4 space-y-3">
        <Section title={`Route Stops (${delivery.facilities.length})`}>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {delivery.facilities.map((fac, idx) => (
              <div
                key={fac.id}
                className={`flex items-start gap-2 p-2 rounded-lg text-xs transition-colors ${
                  idx === delivery.currentStopIndex
                    ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                    : fac.status === 'completed'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20'
                      : 'bg-muted/30'
                }`}
              >
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  fac.status === 'completed'  ? 'bg-emerald-500 text-white' :
                  idx === delivery.currentStopIndex ? 'bg-blue-500 text-white' :
                  'bg-muted-foreground/20 text-muted-foreground'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{fac.name}</p>
                  {fac.address && <p className="text-muted-foreground truncate">{fac.address}</p>}
                  {fac.arrivalTime && (
                    <p className="text-muted-foreground">
                      Arrived {fmtTime(fac.arrivalTime)}
                      {fac.departureTime && ` · Left ${fmtTime(fac.departureTime)}`}
                    </p>
                  )}
                </div>
                {fac.proofCaptured && (
                  <div className="flex items-center gap-0.5 text-emerald-600 shrink-0">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-[10px] font-medium">POD</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Shared UI bits ────────────────────────────────────────────────────────────

function CapBadge({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
      active ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-muted text-muted-foreground'
    }`}>
      <BadgeCheck className="h-2.5 w-2.5" />
      {label}
    </div>
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'in-progress': 'bg-blue-100 text-blue-700',
    completed:     'bg-emerald-100 text-emerald-700',
    assigned:      'bg-amber-100 text-amber-700',
    cancelled:     'bg-red-100 text-red-700',
    pending:       'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status.replace('-', ' ')}
    </span>
  );
}

function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-4 w-${i % 3 === 0 ? 'full' : i % 3 === 1 ? '3/4' : '1/2'} rounded`} />
      ))}
    </div>
  );
}

function PanelError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">Could not load details</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />Retry
        </Button>
      )}
    </div>
  );
}
