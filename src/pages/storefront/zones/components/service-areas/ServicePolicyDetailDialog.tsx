import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Layers,
  Building2,
  MapPin,
  Clock,
  X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tw } from '@/lib/colors';
import { getMapLibreStyle } from '@/lib/mapConfig';
import { useServicePolicyDetail } from '@/hooks/useServicePolicies';
import { ServiceArea } from '@/types/service-areas';
import { PolicyCluster } from '@/types/service-policies';

// Must match CreateServicePolicyWizard
const CLUSTER_COLORS = [
  tw.blue[500],
  tw.emerald[500],
  tw.violet[500],
  tw.orange[500],
  tw.pink[500],
  tw.cyan[500],
  tw.amber[500],
  tw.red[500],
];

function clusterColor(idx: number) {
  return CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
}

const modeLabels: Record<string, string> = {
  manual: 'Manual',
  lga: 'LGA-based',
  proximity: 'Proximity',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// Andrew's monotone chain convex hull — operates on [lng, lat] pairs
function convexHull(pts: [number, number][]): [number, number][] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

// Inflate hull outward from its centroid (paddingDeg ≈ 3–5 km)
function expandHull(hull: [number, number][], paddingDeg = 0.04): [number, number][] {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  return hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
    return [x + (dx / len) * paddingDeg, y + (dy / len) * paddingDeg] as [number, number];
  });
}

// Circle approximation for single-point or 2-point clusters
function circleRing(lng: number, lat: number, radiusDeg = 0.06, steps = 32): [number, number][] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return [lng + Math.cos(a) * radiusDeg, lat + Math.sin(a) * radiusDeg * 0.9] as [number, number];
  });
}

// Build a closed GeoJSON ring for a cluster's facility points
function buildClusterRing(
  facilities: Array<{ lat: number | null; lng: number | null }>,
): [number, number][] | null {
  const pts = facilities
    .filter((f): f is { lat: number; lng: number } => f.lat != null && f.lng != null)
    .map((f) => [f.lng, f.lat] as [number, number]);

  if (pts.length === 0) return null;

  if (pts.length === 1) return circleRing(pts[0][0], pts[0][1]);

  if (pts.length === 2) {
    const mid: [number, number] = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    return circleRing(mid[0], mid[1], 0.07);
  }

  const hull = convexHull(pts);
  return expandHull(hull, 0.035);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ServicePolicyDetailDialogProps {
  policyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceArea: ServiceArea;
}

export function ServicePolicyDetailDialog({
  policyId,
  open,
  onOpenChange,
  serviceArea,
}: ServicePolicyDetailDialogProps) {
  const { theme } = useTheme();
  const { data, isLoading } = useServicePolicyDetail(open ? policyId : null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // marker DOM elements keyed by cluster.id (for opacity control)
  const markerElsByClusterRef = useRef<Record<string, HTMLElement[]>>({});
  // all facility + warehouse coords for full-extent zoom
  const allCoordsRef = useRef<[number, number][]>([]);

  const policy = data?.policy;
  const clusters = data?.clusters ?? [];
  const totalFacilities = clusters.reduce((s, c) => s + (c.facilities?.length ?? 0), 0);

  const warehouseLat = serviceArea.warehouses?.lat;
  const warehouseLng = serviceArea.warehouses?.lng;

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) setSelectedClusterId(null);
  }, [open]);

  // ─── Map initialisation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !mapContainerRef.current || isLoading || clusters.length === 0) return;
    if (mapRef.current) return; // already initialised

    const center: [number, number] =
      warehouseLat && warehouseLng ? [warehouseLng, warehouseLat] : [8.52, 12.0];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapLibreStyle(theme as 'light' | 'dark' | 'system' | undefined),
      center,
      zoom: 9,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    
    map.on('styleimagemissing', (e) => {
      if (map && !map.hasImage(e.id)) {
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);

    let resizeCount = 0;
    const resizeInterval = setInterval(() => {
      map.resize();
      resizeCount++;
      if (resizeCount > 10) clearInterval(resizeInterval);
    }, 50);

    map.on('load', () => {
      // ── Geo-fence polygon layers per cluster ──────────────────────────────
      clusters.forEach((cluster, clusterIdx) => {
        const color = clusterColor(clusterIdx);
        const facCoords = (cluster.facilities || [])
          .map((pcf) => pcf.facilities)
          .filter((f): f is NonNullable<typeof f> => f !== null && f !== undefined);

        const ring = buildClusterRing(facCoords);
        if (!ring || ring.length < 3) return;

        const sourceId = `cluster-src-${cluster.id}`;
        const fillId = `cluster-fill-${cluster.id}`;
        const outlineId = `cluster-outline-${cluster.id}`;

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              // GeoJSON ring must close (first === last)
              coordinates: [[...ring, ring[0]]],
            },
            properties: {},
          },
        });

        map.addLayer({
          id: fillId,
          type: 'fill',
          source: sourceId,
          paint: { 'fill-color': color, 'fill-opacity': 0.13 },
        });

        map.addLayer({
          id: outlineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': color,
            'line-width': 1.8,
            'line-opacity': 0.65,
            'line-dasharray': [5, 3],
          },
        });
      });

      // ── Warehouse marker ──────────────────────────────────────────────────
      if (warehouseLat && warehouseLng) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="
          width:34px;height:34px;
          background:${tw.blue[600]};
          border:3px solid white;
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 5px rgba(59,130,246,0.2),0 2px 8px rgba(0,0,0,0.3);
          font-size:13px;color:white;font-weight:700;
        ">W</div>`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([warehouseLng, warehouseLat])
          .setPopup(
            new maplibregl.Popup({ offset: 24 }).setHTML(
              `<strong>${serviceArea.warehouses?.name || 'Warehouse'}</strong>`,
            ),
          )
          .addTo(map);
        markersRef.current.push(marker);
      }

      // ── Facility markers ──────────────────────────────────────────────────
      const elsByCluster: Record<string, HTMLElement[]> = {};

      clusters.forEach((cluster, clusterIdx) => {
        const color = clusterColor(clusterIdx);
        elsByCluster[cluster.id] = [];

        (cluster.facilities || []).forEach((pcf) => {
          const f = pcf.facilities;
          if (!f?.lat || !f?.lng) return;

          const el = document.createElement('div');
          el.style.cursor = 'pointer';
          el.innerHTML = `<div style="
            width:20px;height:20px;
            background:${color};
            border:2px solid white;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 1px 4px rgba(0,0,0,0.25);
            color:white;font-size:8px;font-weight:700;
            transition:opacity 0.2s ease;
          ">${cluster.code.replace('Z', '')}</div>`;

          const popup = new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
            `<div style="padding:3px;min-width:120px;">
              <strong style="font-size:12px;">${f.name}</strong>
              <div style="font-size:11px;color:${tw.gray[500]};margin-top:1px;">${f.lga || '—'}</div>
              <div style="font-size:11px;color:${color};margin-top:2px;font-weight:600;">${cluster.code}</div>
            </div>`,
          );

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([f.lng, f.lat])
            .setPopup(popup)
            .addTo(map);

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            marker.togglePopup();
          });

          markersRef.current.push(marker);
          elsByCluster[cluster.id].push(el);
        });
      });

      markerElsByClusterRef.current = elsByCluster;

      // ── Fit to all facilities + warehouse ─────────────────────────────────
      const allCoords = clusters.flatMap((c) =>
        (c.facilities || [])
          .map((pcf) => pcf.facilities)
          .filter((f): f is NonNullable<typeof f> => !!f?.lat && !!f?.lng)
          .map((f) => [f.lng, f.lat] as [number, number]),
      );
      if (warehouseLat && warehouseLng) allCoords.push([warehouseLng, warehouseLat]);
      allCoordsRef.current = allCoords;

      if (allCoords.length > 1) {
        const bounds = allCoords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(allCoords[0], allCoords[0]),
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
      }
    });

    return () => {
      clearInterval(resizeInterval);
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      markerElsByClusterRef.current = {};
      allCoordsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [open, isLoading, clusters, warehouseLat, warehouseLng, theme]);

  // ─── Selection effect — update layers + markers + camera ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applySelection = () => {
      // Layer opacity
      clusters.forEach((cluster) => {
        const fillId = `cluster-fill-${cluster.id}`;
        const outlineId = `cluster-outline-${cluster.id}`;
        const isFocused = selectedClusterId === null || selectedClusterId === cluster.id;

        if (map.getLayer(fillId)) {
          map.setPaintProperty(fillId, 'fill-opacity', selectedClusterId === null ? 0.13 : isFocused ? 0.28 : 0.04);
        }
        if (map.getLayer(outlineId)) {
          map.setPaintProperty(outlineId, 'line-opacity', selectedClusterId === null ? 0.65 : isFocused ? 1 : 0.15);
          map.setPaintProperty(outlineId, 'line-width', selectedClusterId === null ? 1.8 : isFocused ? 2.5 : 1);
        }
      });

      // Marker opacity
      Object.entries(markerElsByClusterRef.current).forEach(([clusterId, els]) => {
        const isFocused = selectedClusterId === null || clusterId === selectedClusterId;
        els.forEach((el) => {
          const inner = el.firstElementChild as HTMLElement | null;
          if (inner) inner.style.opacity = isFocused ? '1' : '0.18';
        });
      });

      // Camera
      if (selectedClusterId) {
        const cluster = clusters.find((c) => c.id === selectedClusterId);
        const pts = (cluster?.facilities || [])
          .map((pcf) => pcf.facilities)
          .filter((f): f is NonNullable<typeof f> => !!f?.lat && !!f?.lng)
          .map((f) => [f.lng, f.lat] as [number, number]);

        if (pts.length > 0) {
          const bounds = pts.reduce(
            (b, c) => b.extend(c),
            new maplibregl.LngLatBounds(pts[0], pts[0]),
          );
          map.fitBounds(bounds, { padding: 90, maxZoom: 13, duration: 700 });
        }
      } else {
        const allCoords = allCoordsRef.current;
        if (allCoords.length > 1) {
          const bounds = allCoords.reduce(
            (b, c) => b.extend(c),
            new maplibregl.LngLatBounds(allCoords[0], allCoords[0]),
          );
          map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 700 });
        }
      }
    };

    if (map.isStyleLoaded()) {
      applySelection();
    } else {
      map.once('idle', applySelection);
    }
  }, [selectedClusterId, clusters]);

  // Table rows: all clusters or just the selected one
  const tableRows = selectedClusterId
    ? clusters.filter((c) => c.id === selectedClusterId)
    : clusters;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full h-[85vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">
                {isLoading ? <Skeleton className="h-6 w-48" /> : policy?.name}
              </DialogTitle>
              <DialogDescription className="mt-1" asChild>
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <Skeleton className="h-4 w-32 mt-1" />
                  ) : (
                    <>
                      <span>{serviceArea.name}</span>
                      {policy?.code && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-mono text-xs">{policy.code}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </DialogDescription>
            </div>
            {!isLoading && policy && (
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">
                  {modeLabels[policy.clustering_mode] || policy.clustering_mode}
                </Badge>
                <Badge className={`text-xs ${statusColors[policy.status] || ''}`}>
                  {policy.status}
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Stats row */}
        {!isLoading && policy && (
          <div className="grid grid-cols-3 border-b divide-x shrink-0">
            <StatCell
              icon={<Layers className="h-4 w-4" />}
              label="Clusters"
              value={clusters.length}
            />
            <StatCell
              icon={<Building2 className="h-4 w-4" />}
              label="Facilities"
              value={totalFacilities}
            />
            <StatCell
              icon={<Clock className="h-4 w-4" />}
              label="Created"
              value={new Date(policy.created_at).toLocaleDateString()}
            />
          </div>
        )}

        {/* Body: map + cluster overview */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Map */}
          <div className="flex-1 relative">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <>
                <div ref={mapContainerRef} className="absolute inset-0" />
                {clusters.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    No clusters
                  </div>
                )}
              </>
            )}
          </div>

          {/* Cluster overview panel */}
          <div className="w-[280px] shrink-0 border-l flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b shrink-0 flex items-center justify-between min-h-[42px]">
              <p className="font-medium text-sm leading-tight">
                {selectedClusterId
                  ? `${clusters.find((c) => c.id === selectedClusterId)?.code} — focused`
                  : 'Cluster Overview'}
              </p>
              {selectedClusterId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setSelectedClusterId(null)}
                  title="Show all clusters"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2.5 space-y-1.5">
                {isLoading ? (
                  [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)
                ) : clusters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No clusters defined
                  </p>
                ) : (
                  clusters.map((cluster, idx) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      colorIndex={idx}
                      isSelected={selectedClusterId === cluster.id}
                      onClick={() =>
                        setSelectedClusterId((prev) =>
                          prev === cluster.id ? null : cluster.id,
                        )
                      }
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Cluster facility detail table */}
        {!isLoading && clusters.length > 0 && (
          <div className="border-t shrink-0 max-h-[220px] overflow-auto">
            {selectedClusterId && (
              <div className="px-4 py-1.5 bg-muted/40 border-b flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Showing facilities for
                </span>
                <span
                  className="font-mono font-semibold text-xs"
                  style={{
                    color: clusterColor(clusters.findIndex((c) => c.id === selectedClusterId)),
                  }}
                >
                  {clusters.find((c) => c.id === selectedClusterId)?.code}
                </span>
                <button
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={() => setSelectedClusterId(null)}
                >
                  Show all
                </button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-background z-10">
                  <TableHead className="py-2">Cluster</TableHead>
                  <TableHead className="py-2">Facility</TableHead>
                  <TableHead className="py-2">LGA</TableHead>
                  <TableHead className="py-2">Type</TableHead>
                  <TableHead className="py-2">Level of Care</TableHead>
                  <TableHead className="py-2 whitespace-nowrap">Dist. to Hub</TableHead>
                  <TableHead className="py-2 whitespace-nowrap">Geo-Coordinates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.flatMap((cluster) => {
                  const colorIdx = clusters.indexOf(cluster);
                  return (cluster.facilities || []).map((pcf, i) => {
                    const f = pcf.facilities;
                    const distKm =
                      f?.lat && f?.lng && warehouseLat && warehouseLng
                        ? haversine(warehouseLat, warehouseLng, f.lat, f.lng)
                        : null;
                    return (
                      <TableRow key={pcf.id} className="text-xs">
                        {i === 0 ? (
                          <TableCell
                            rowSpan={cluster.facilities?.length ?? 1}
                            className="align-top py-1.5 font-mono font-semibold"
                            style={{ color: clusterColor(colorIdx) }}
                          >
                            {cluster.code}
                          </TableCell>
                        ) : null}
                        <TableCell className="py-1.5">{f?.name || '—'}</TableCell>
                        <TableCell className="py-1.5">{f?.lga || '—'}</TableCell>
                        <TableCell className="py-1.5 capitalize">{f?.type || '—'}</TableCell>
                        <TableCell className="py-1.5">{f?.level_of_care || '—'}</TableCell>
                        <TableCell className="py-1.5 font-mono tabular-nums">
                          {distKm != null ? (
                            <span className="whitespace-nowrap">{distKm.toFixed(1)} km</span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                          {f?.lat != null && f?.lng != null
                            ? `${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ClusterCard({
  cluster,
  colorIndex,
  isSelected,
  onClick,
}: {
  cluster: PolicyCluster;
  colorIndex: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = clusterColor(colorIndex);
  const facilities = cluster.facilities || [];
  const lgas = [...new Set(facilities.map((f) => f.facilities?.lga).filter(Boolean))];

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg overflow-hidden transition-all cursor-pointer hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        border: isSelected ? `2px solid ${color}` : '1px solid hsl(var(--border))',
        boxShadow: isSelected ? `0 0 0 3px ${color}22` : undefined,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <span className="font-mono font-bold text-sm" style={{ color }}>
          {cluster.code}
        </span>
        {cluster.name && (
          <span className="text-xs text-muted-foreground truncate flex-1">{cluster.name}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Building2 className="h-3 w-3" />
          {facilities.length}
        </div>
      </div>

      {/* LGA summary */}
      {lgas.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {lgas.slice(0, 3).map((lga) => (
            <Badge key={lga} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {lga}
            </Badge>
          ))}
          {lgas.length > 3 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              +{lgas.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Avg distance */}
      {cluster.avg_distance_km != null && (
        <div className="px-3 pb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          Avg {cluster.avg_distance_km.toFixed(1)} km to hub
        </div>
      )}
    </button>
  );
}
