import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  Building2,
  MapPin,
  Search,
  AlertTriangle,
  X,
  Loader2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { calculateDistance } from '@/lib/routeOptimization';
import { useServiceAreaFacilities } from '@/hooks/useServiceAreas';
import { useCreateServicePolicy, runClusteringEngine, detectAnomalies } from '@/hooks/useServicePolicies';
import { ServiceArea } from '@/types/service-areas';
import {
  ClusterDraft,
  ClusteringMode,
  PolicyConstraints,
  ClusterAnomaly,
} from '@/types/service-policies';

// Cluster colour palette
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

interface FacilityRow {
  id: string;
  name: string;
  lga: string | null;
  lat: number | null;
  lng: number | null;
  type: string | null;
  level_of_care: string | null;
  distanceKm: number | null;
}

interface CreateServicePolicyWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceArea: ServiceArea;
}

type Step = 1 | 2;

export function CreateServicePolicyWizard({
  open,
  onOpenChange,
  serviceArea,
}: CreateServicePolicyWizardProps) {
  const { theme } = useTheme();
  const createMutation = useCreateServicePolicy();

  // ─── Step 1 state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ─── Step 2 state ────────────────────────────────────────────────────────
  const [clusteringMode, setClusteringMode] = useState<ClusteringMode>('lga');
  const [constraints, setConstraints] = useState<PolicyConstraints>({
    radius_km: 15,
    max_facilities_per_cluster: 30,
  });
  const [clusters, setClusters] = useState<ClusterDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [facilitySearch, setFacilitySearch] = useState('');

  // ─── Policy name & save state ─────────────────────────────────────────────
  const [policyName, setPolicyName] = useState('');
  const [policyCode, setPolicyCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Drag state for moving facilities between clusters
  const [draggingFacilityId, setDraggingFacilityId] = useState<string | null>(null);
  const [draggingFromCluster, setDraggingFromCluster] = useState<string | null>(null);

  // Manual mode: active cluster for click-to-assign
  const [activeClusterCode, setActiveClusterCode] = useState<string | null>(null);

  // ─── Data ─────────────────────────────────────────────────────────────────
  const { data: saFacilities, isLoading: facilitiesLoading } = useServiceAreaFacilities(
    serviceArea.id,
  );

  const warehouseLat = serviceArea.warehouses?.lat ?? null;
  const warehouseLng = serviceArea.warehouses?.lng ?? null;

  const facilities = useMemo<FacilityRow[]>(() => {
    if (!saFacilities) return [];
    return saFacilities.map(saf => {
      const f = saf.facilities;
      const dist =
        f?.lat && f?.lng && warehouseLat && warehouseLng
          ? Math.round(calculateDistance(warehouseLat, warehouseLng, f.lat, f.lng) * 10) / 10
          : null;
      return {
        id: f?.id ?? saf.facility_id,
        name: f?.name ?? '—',
        lga: f?.lga ?? null,
        lat: f?.lat ?? null,
        lng: f?.lng ?? null,
        type: f?.type ?? null,
        level_of_care: f?.level_of_care ?? null,
        distanceKm: dist,
      };
    });
  }, [saFacilities, warehouseLat, warehouseLng]);

  const facilityMap = useMemo(
    () => new Map(facilities.map(f => [f.id, f])),
    [facilities],
  );

  // Facilities not yet in any cluster
  const assignedFacilityIds = useMemo(
    () => new Set(clusters.flatMap(c => c.facilityIds)),
    [clusters],
  );

  const filteredFacilities = useMemo(() => {
    const q = facilitySearch.toLowerCase();
    return facilities.filter(
      f =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.lga || '').toLowerCase().includes(q),
    );
  }, [facilities, facilitySearch]);

  // ─── Anomalies ────────────────────────────────────────────────────────────
  const anomalies = useMemo<ClusterAnomaly[]>(() => {
    if (clusters.length === 0) return [];
    return detectAnomalies(
      clusters,
      facilityMap as any,
      warehouseLat,
      warehouseLng,
      constraints.max_facilities_per_cluster,
    );
  }, [clusters, facilityMap, warehouseLat, warehouseLng, constraints]);

  // ─── Map refs ─────────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setClusters([]);
      setExpandedCluster(null);
      setFacilitySearch('');
      setActiveClusterCode(null);
      setPolicyName('');
      setPolicyCode('');
      setClusteringMode('lga');
      setConstraints({ radius_km: 15, max_facilities_per_cluster: 30 });
    }
  }, [open]);

  // ─── Map init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized

    const center: [number, number] =
      warehouseLat && warehouseLng
        ? [warehouseLng, warehouseLat]
        : [8.52, 12.0];

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

    map.on('load', () => {
      setTimeout(() => map.resize(), 150);
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    // Keep pulsing resize until style has loaded (style fetch can exceed 500ms)
    let resizeCount = 0;
    const resizeInterval = setInterval(() => {
      if (mapRef.current) mapRef.current.resize();
      resizeCount++;
      if (resizeCount > 30) clearInterval(resizeInterval);
    }, 100);

    return () => {
      clearInterval(resizeInterval);
      resizeObserver.disconnect();
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [step, theme, warehouseLat, warehouseLng]);

  // ─── Map markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || step !== 2) return;
    const map = mapRef.current;

    // Clear existing
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    // Warehouse marker
    if (warehouseLat && warehouseLng) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="
        width:36px;height:36px;
        background:${tw.blue[600]};
        border:3px solid white;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 0 5px rgba(59,130,246,0.2),0 2px 8px rgba(0,0,0,0.3);
        font-size:14px;color:white;font-weight:700;
      ">W</div>`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([warehouseLng, warehouseLat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>${serviceArea.warehouses?.name || 'Warehouse'}</strong>`,
          ),
        )
        .addTo(map);
      markersRef.current.set('warehouse', marker);
    }

    // Facility markers
    facilities.forEach(f => {
      if (!f.lat || !f.lng) return;

      // Find which cluster this facility is in
      const clusterIdx = clusters.findIndex(c => c.facilityIds.includes(f.id));
      const color = clusterIdx >= 0 ? clusterColor(clusterIdx) : tw.gray[400];
      const clusterCode = clusterIdx >= 0 ? clusters[clusterIdx].code : null;
      const isAssigned = clusterIdx >= 0;

      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      el.innerHTML = `<div style="
        width:22px;height:22px;
        background:${color};
        border:2px solid white;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 5px rgba(0,0,0,0.25);
        color:white;font-size:9px;font-weight:700;
        opacity:${isAssigned ? 1 : 0.4};
      ">${clusterCode ? clusterCode.replace('Z', '') : ''}</div>`;

      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
        `<div style="padding:4px;min-width:130px;">
          <strong style="font-size:13px;">${f.name}</strong>
          <div style="font-size:11px;color:${tw.gray[500]};margin-top:2px;">
            ${f.lga || 'Unknown LGA'}${f.distanceKm ? ` · ${f.distanceKm} km` : ''}
          </div>
          ${clusterCode ? `<div style="font-size:11px;color:${color};margin-top:3px;font-weight:600;">${clusterCode}</div>` : ''}
        </div>`,
      );

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([f.lng, f.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', e => {
        e.stopPropagation();
        marker.togglePopup();
      });

      markersRef.current.set(f.id, marker);
    });
  }, [step, facilities, clusters, warehouseLat, warehouseLng, serviceArea.warehouses?.name]);

  // ─── Generate clusters ────────────────────────────────────────────────────
  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const drafts = runClusteringEngine({
        facilities: facilities.map(f => ({
          id: f.id,
          name: f.name,
          lat: f.lat,
          lng: f.lng,
          lga: f.lga,
        })),
        mode: clusteringMode,
        constraints,
        warehouseLat,
        warehouseLng,
      });
      setClusters(drafts);
      setExpandedCluster(drafts[0]?.code ?? null);
      setIsGenerating(false);
    }, 50);
  };

  // ─── Drag & drop facilities between clusters ──────────────────────────────
  const moveFacility = useCallback(
    (facilityId: string, fromCode: string, toCode: string) => {
      if (fromCode === toCode) return;
      setClusters(prev =>
        prev.map(c => {
          if (c.code === fromCode) {
            return { ...c, facilityIds: c.facilityIds.filter(id => id !== facilityId) };
          }
          if (c.code === toCode) {
            return { ...c, facilityIds: [...c.facilityIds, facilityId] };
          }
          return c;
        }),
      );
    },
    [],
  );

  const removeFacilityFromCluster = useCallback((facilityId: string, clusterCode: string) => {
    setClusters(prev =>
      prev.map(c =>
        c.code === clusterCode
          ? { ...c, facilityIds: c.facilityIds.filter(id => id !== facilityId) }
          : c,
      ),
    );
  }, []);

  const deleteEmptyClusters = () => {
    setClusters(prev => prev.filter(c => c.facilityIds.length > 0));
  };

  // Manual mode: add a new empty cluster
  const addManualCluster = useCallback(() => {
    const code = `Z${clusters.length + 1}`;
    const newCluster: ClusterDraft = { code, name: '', facilityIds: [] };
    setClusters(prev => [...prev, newCluster]);
    setActiveClusterCode(code);
    setExpandedCluster(code);
  }, [clusters.length]);

  // Manual mode: click a facility in the left panel to assign/unassign from active cluster
  const toggleFacilityAssignment = useCallback(
    (facilityId: string) => {
      if (!activeClusterCode) return;
      setClusters(prev => {
        const isInActive = prev.find(c => c.code === activeClusterCode)?.facilityIds.includes(facilityId);
        return prev.map(c => {
          if (c.code === activeClusterCode) {
            return {
              ...c,
              facilityIds: isInActive
                ? c.facilityIds.filter(id => id !== facilityId)
                : [...c.facilityIds, facilityId],
            };
          }
          // Remove from any other cluster when assigning
          if (!isInActive) {
            return { ...c, facilityIds: c.facilityIds.filter(id => id !== facilityId) };
          }
          return c;
        });
      });
    },
    [activeClusterCode],
  );

  // ─── Validation ───────────────────────────────────────────────────────────
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (clusters.length === 0) return errors;

    // No empty clusters
    const empty = clusters.filter(c => c.facilityIds.length === 0);
    if (empty.length > 0) {
      errors.push(`Empty clusters: ${empty.map(c => c.code).join(', ')}`);
    }

    // No duplicates
    const allIds = clusters.flatMap(c => c.facilityIds);
    const dupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
    if (dupes.length > 0) {
      errors.push('Some facilities appear in multiple clusters');
    }

    return errors;
  }, [clusters]);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!policyName.trim() || clusters.length === 0) return;
    setIsSaving(true);
    try {
      await createMutation.mutateAsync({
        name: policyName.trim(),
        code: policyCode.trim() || undefined,
        service_area_id: serviceArea.id,
        clustering_mode: clusteringMode,
        constraints,
        clusters: clusters.map(c => ({
          code: c.code,
          name: c.name,
          facility_ids: c.facilityIds,
        })),
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canSave =
    policyName.trim().length > 0 &&
    clusters.length > 0 &&
    validation.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step === 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {step > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
              </div>
              <span className={step === 1 ? 'font-medium' : 'text-muted-foreground'}>
                Context
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                2
              </div>
              <span className={step === 2 ? 'font-medium' : 'text-muted-foreground'}>
                Build Clusters
              </span>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {serviceArea.name}
            </div>
          </div>
          <DialogTitle className="sr-only">New Service Policy</DialogTitle>
          <DialogDescription className="sr-only">
            Create a service policy by clustering facilities under {serviceArea.name}
          </DialogDescription>
        </DialogHeader>

        {/* ─── STEP 1: Context ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Info */}
            <div className="w-[340px] shrink-0 border-r flex flex-col p-6 gap-6 overflow-y-auto">
              <div>
                <h2 className="text-lg font-semibold">New Service Policy</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  A service policy groups facilities under a service area into named operational
                  clusters (Z1, Z2…)
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Zone</Label>
                  <div className="rounded-md border px-3 py-2 bg-muted/40 text-sm">
                    {serviceArea.zones?.name || '—'}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Service Area</Label>
                  <div className="rounded-md border px-3 py-2 bg-muted/40 text-sm font-medium">
                    {serviceArea.name}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Warehouse</Label>
                  <div className="rounded-md border px-3 py-2 bg-muted/40 text-sm">
                    {serviceArea.warehouses?.name || '—'}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  {facilitiesLoading ? (
                    'Loading facilities…'
                  ) : (
                    `${facilities.length} facilities in this service area`
                  )}
                </div>
                {warehouseLat && warehouseLng && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Warehouse coordinates available — proximity clustering enabled
                  </div>
                )}
              </div>

              <div className="mt-auto">
                <Button
                  className="w-full"
                  onClick={() => setStep(2)}
                  disabled={facilitiesLoading || facilities.length === 0}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {facilities.length === 0 && !facilitiesLoading && (
                  <p className="text-xs text-destructive mt-2 text-center">
                    No facilities assigned to this service area
                  </p>
                )}
              </div>
            </div>

            {/* Right: Tact Map */}
            <TactMapStep1
              facilities={facilities}
              warehouseLat={warehouseLat}
              warehouseLng={warehouseLng}
              warehouseName={serviceArea.warehouses?.name}
              theme={theme}
            />
          </div>
        )}

        {/* ─── STEP 2: Build Clusters ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-1 overflow-hidden">
            {/* Col 1: Facility list */}
            <div className="w-[280px] shrink-0 border-r flex flex-col overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b shrink-0">
                <p className="font-medium text-sm">Facilities</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {facilities.length} in service area
                </p>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search…"
                    value={facilitySearch}
                    onChange={e => setFacilitySearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                {/* Manual mode: active cluster selector */}
                {clusteringMode === 'manual' && clusters.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Click facility to assign to:</p>
                    <div className="flex flex-wrap gap-1">
                      {clusters.map((c, i) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setActiveClusterCode(prev => prev === c.code ? null : c.code)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold transition-colors ${
                            activeClusterCode === c.code
                              ? 'text-white border-transparent'
                              : 'bg-transparent hover:bg-muted/50'
                          }`}
                          style={{
                            backgroundColor: activeClusterCode === c.code ? clusterColor(i) : undefined,
                            borderColor: activeClusterCode === c.code ? 'transparent' : clusterColor(i),
                            color: activeClusterCode === c.code ? 'white' : clusterColor(i),
                          }}
                        >
                          {c.code}
                        </button>
                      ))}
                    </div>
                    {!activeClusterCode && (
                      <p className="text-[10px] text-muted-foreground mt-1">Select a cluster above to enable assignment</p>
                    )}
                  </div>
                )}
                {clusteringMode === 'manual' && clusters.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Add clusters in the right panel, then click facilities to assign them.
                  </p>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {filteredFacilities.map(f => {
                    const clusterIdx = clusters.findIndex(c => c.facilityIds.includes(f.id));
                    const color = clusterIdx >= 0 ? clusterColor(clusterIdx) : undefined;
                    const clusterCode = clusterIdx >= 0 ? clusters[clusterIdx].code : null;
                    const isManual = clusteringMode === 'manual';
                    const isInActiveCluster = activeClusterCode
                      ? clusters.find(c => c.code === activeClusterCode)?.facilityIds.includes(f.id)
                      : false;

                    return (
                      <div
                        key={f.id}
                        onClick={isManual && activeClusterCode ? () => toggleFacilityAssignment(f.id) : undefined}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs group transition-colors ${
                          isManual && activeClusterCode
                            ? isInActiveCluster
                              ? 'bg-primary/10 cursor-pointer hover:bg-primary/20'
                              : 'cursor-pointer hover:bg-muted/60'
                            : 'hover:bg-muted/60'
                        }`}
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0 border transition-colors"
                          style={{
                            backgroundColor: color || 'transparent',
                            borderColor: color || 'currentColor',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{f.name}</p>
                          <p className="text-muted-foreground truncate">
                            {f.lga || 'Unknown LGA'}
                            {f.distanceKm ? ` · ${f.distanceKm}km` : ''}
                          </p>
                        </div>
                        {clusterCode && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4 shrink-0"
                            style={{ borderColor: color, color }}
                          >
                            {clusterCode}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Col 2: Tact Map */}
            <div className="flex-1 relative overflow-hidden">
              <div ref={mapContainerRef} className="absolute inset-0" />

              {/* Cluster colour legend overlay */}
              {clusters.length > 0 && (
                <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg border px-3 py-2 shadow-md max-w-[200px]">
                  <p className="text-xs font-medium mb-1.5">Clusters</p>
                  <div className="space-y-1">
                    {clusters.map((c, i) => (
                      <div key={c.code} className="flex items-center gap-2 text-xs">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: clusterColor(i) }}
                        />
                        <span className="font-mono font-medium">{c.code}</span>
                        <span className="text-muted-foreground">{c.facilityIds.length} fac.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Col 3: Service Logic Panel */}
            <div className="w-[360px] shrink-0 border-l flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                  {/* Section A: Clustering Mode */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Clustering Mode
                    </p>
                    <div className="space-y-2">
                      {(
                        [
                          { value: 'manual', label: 'Manual', desc: 'Drag facilities into clusters yourself' },
                          { value: 'lga', label: 'LGA-based', desc: 'Group by Local Government Area' },
                          { value: 'proximity', label: 'Proximity-based', desc: 'Group by distance radius' },
                        ] as Array<{ value: ClusteringMode; label: string; desc: string }>
                      ).map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                            clusteringMode === opt.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="clustering-mode"
                            value={opt.value}
                            checked={clusteringMode === opt.value}
                            onChange={() => {
                              setClusteringMode(opt.value);
                              setClusters([]);
                              setActiveClusterCode(null);
                            }}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Section B: Constraints */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Constraints
                    </p>
                    <div className="space-y-3">
                      {clusteringMode === 'proximity' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Radius (km)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={200}
                            value={constraints.radius_km ?? 15}
                            onChange={e =>
                              setConstraints(prev => ({
                                ...prev,
                                radius_km: Number(e.target.value),
                              }))
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Max facilities per cluster (optional)</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="No limit"
                          value={constraints.max_facilities_per_cluster ?? ''}
                          onChange={e =>
                            setConstraints(prev => ({
                              ...prev,
                              max_facilities_per_cluster: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {clusteringMode === 'manual' ? (
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={addManualCluster}
                      disabled={facilities.length === 0}
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      Add Cluster
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={handleGenerate}
                      disabled={isGenerating || facilities.length === 0}
                    >
                      {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Layers className="mr-2 h-4 w-4" />
                      )}
                      Generate Clusters
                    </Button>
                  )}

                  <Separator />

                  {/* Section C: Facility Insights */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Facility Insights
                    </p>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead className="py-1.5 px-2 h-auto">Facility</TableHead>
                            <TableHead className="py-1.5 px-2 h-auto">LGA</TableHead>
                            <TableHead className="py-1.5 px-2 h-auto text-right">km</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {facilities.slice(0, 12).map(f => (
                            <TableRow key={f.id} className="text-[11px]">
                              <TableCell className="py-1 px-2 max-w-[100px] truncate">
                                {f.name}
                              </TableCell>
                              <TableCell className="py-1 px-2">{f.lga || '—'}</TableCell>
                              <TableCell className="py-1 px-2 text-right tabular-nums">
                                {f.distanceKm ?? '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {facilities.length > 12 && (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="py-1 px-2 text-center text-muted-foreground text-[11px]"
                              >
                                +{facilities.length - 12} more
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* ─── STEP 2 bottom: Cluster Review + Save ─────────────────────────── */}
        {step === 2 && clusters.length > 0 && (
          <div className="border-t shrink-0 flex flex-col max-h-[340px]">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">
                  {clusters.length} cluster{clusters.length !== 1 ? 's' : ''} generated
                </span>
                {anomalies.length > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {anomalies.length} flag{anomalies.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive text-xs h-7"
                onClick={deleteEmptyClusters}
              >
                Remove empty clusters
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-5 py-2 space-y-2">
                {clusters.map((cluster, clusterIdx) => {
                  const color = clusterColor(clusterIdx);
                  const isExpanded = expandedCluster === cluster.code;
                  const clusterFacilities = cluster.facilityIds
                    .map(id => facilityMap.get(id))
                    .filter(Boolean) as FacilityRow[];
                  const clusterAnomalies = anomalies.filter(
                    a => a.clusterCode === cluster.code,
                  );

                  return (
                    <div key={cluster.code} className="rounded-lg border overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2 bg-muted/30 hover:bg-muted/60 text-left"
                        onClick={() =>
                          setExpandedCluster(isExpanded ? null : cluster.code)
                        }
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-mono font-semibold text-sm" style={{ color }}>
                          {cluster.code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {cluster.facilityIds.length} facilities
                        </span>
                        {clusterAnomalies.length > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 ml-1" />
                        )}
                        <div className="ml-auto">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 py-2 space-y-1">
                          {clusterAnomalies.map((a, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1"
                            >
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                              {a.message}
                            </div>
                          ))}
                          {clusterFacilities.map(f => (
                            <div
                              key={f.id}
                              className="flex items-center gap-2 text-xs py-0.5"
                              draggable
                              onDragStart={() => {
                                setDraggingFacilityId(f.id);
                                setDraggingFromCluster(cluster.code);
                              }}
                              onDragEnd={() => {
                                setDraggingFacilityId(null);
                                setDraggingFromCluster(null);
                              }}
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab shrink-0" />
                              <span className="flex-1 truncate">{f.name}</span>
                              <span className="text-muted-foreground shrink-0">
                                {f.lga || '—'}
                              </span>
                              {f.distanceKm && (
                                <span className="text-muted-foreground tabular-nums shrink-0">
                                  {f.distanceKm}km
                                </span>
                              )}
                              <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0"
                                onClick={() => removeFacilityFromCluster(f.id, cluster.code)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}

                          {/* Drop zones for other clusters */}
                          {draggingFacilityId && draggingFromCluster !== cluster.code && (
                            <div
                              className="border-2 border-dashed rounded px-2 py-1.5 text-xs text-center text-muted-foreground"
                              style={{ borderColor: color }}
                              onDragOver={e => e.preventDefault()}
                              onDrop={() => {
                                if (draggingFacilityId && draggingFromCluster) {
                                  moveFacility(
                                    draggingFacilityId,
                                    draggingFromCluster,
                                    cluster.code,
                                  );
                                }
                              }}
                            >
                              Drop here to move to {cluster.code}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        <div className="border-t px-6 py-4 shrink-0 flex items-center gap-4">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <div className="ml-auto">
                <Button
                  onClick={() => setStep(2)}
                  disabled={facilitiesLoading || facilities.length === 0}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {/* Validation errors */}
              {validation.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {validation[0]}
                </div>
              )}

              <div className="ml-auto flex items-center gap-3">
                <Input
                  placeholder="Policy name *"
                  value={policyName}
                  onChange={e => setPolicyName(e.target.value)}
                  className="h-8 w-48 text-sm"
                />
                <Input
                  placeholder="Code (optional)"
                  value={policyCode}
                  onChange={e => setPolicyCode(e.target.value)}
                  className="h-8 w-32 text-sm font-mono"
                />
                <Button onClick={handleSave} disabled={!canSave || isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Save Policy
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1 Tact Map (standalone to avoid re-renders) ────────────────────────

interface TactMapStep1Props {
  facilities: FacilityRow[];
  warehouseLat: number | null;
  warehouseLng: number | null;
  warehouseName?: string;
  theme?: string;
}

function TactMapStep1({
  facilities,
  warehouseLat,
  warehouseLng,
  warehouseName,
  theme,
}: TactMapStep1Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (!mapContainerRef.current) return;

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

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    // Workaround for Radix Dialog animation causing blank maps
    let resizeCount = 0;
    const resizeInterval = setInterval(() => {
      map.resize();
      resizeCount++;
      if (resizeCount > 10) clearInterval(resizeInterval); // Stop after ~500ms
    }, 50);

    map.on('load', () => {
      // Warehouse marker
      if (warehouseLat && warehouseLng) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="
          width:36px;height:36px;
          background:${tw.blue[600]};
          border:3px solid white;
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 5px rgba(59,130,246,0.2),0 2px 8px rgba(0,0,0,0.3);
          font-size:14px;color:white;font-weight:700;
        ">W</div>`;
        new maplibregl.Marker({ element: el })
          .setLngLat([warehouseLng, warehouseLat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<strong>${warehouseName || 'Warehouse'}</strong>`))
          .addTo(map);
      }

      // Facility markers
      facilities.forEach(f => {
        if (!f.lat || !f.lng) return;
        const el = document.createElement('div');
        el.innerHTML = `<div style="
          width:18px;height:18px;
          background:${tw.gray[400]};
          border:2px solid white;
          border-radius:50%;
          box-shadow:0 1px 4px rgba(0,0,0,0.2);
        "></div>`;
        new maplibregl.Marker({ element: el })
          .setLngLat([f.lng, f.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
              `<div style="font-size:12px;padding:2px"><strong>${f.name}</strong><br/>${f.lga || ''}</div>`,
            ),
          )
          .addTo(map);
      });
    });

    return () => {
      clearInterval(resizeInterval);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [facilities, warehouseLat, warehouseLng, warehouseName, theme]);

  return (
    <div className="flex-1 relative">
      <div ref={mapContainerRef} className="absolute inset-0" />
    </div>
  );
}