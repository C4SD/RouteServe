import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Layers, Building2, Warehouse, Maximize2, Minimize2,
  ZoomIn, ZoomOut, LocateFixed, Crosshair, MapIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFacilities } from '@/hooks/useFacilities';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { OperationalZone } from '@/types/zones';

const DEFAULT_CENTER: [number, number] = [12.0, 8.52];
const DEFAULT_ZOOM = 10;

function createFacilityIcon(type?: string): L.DivIcon {
  const colorMap: Record<string, string> = {
    hospital: '#ef4444',
    clinic: '#3b82f6',
    pharmacy: '#22c55e',
    health_center: '#a855f7',
  };
  const color = colorMap[type || ''] || '#6b7280';
  return L.divIcon({
    className: '',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer;"></div>`,
  });
}

function createWarehouseIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0078A0,#006080);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
    </div>`,
  });
}

const ZONE_PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

interface ZoneMapViewProps {
  zones: OperationalZone[];
  onZoneSelect: (zone: OperationalZone) => void;
}

export function ZoneMapView({ zones, onZoneSelect }: ZoneMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const facilityMarkersRef = useRef<L.Marker[]>([]);
  const warehouseMarkersRef = useRef<L.Marker[]>([]);
  const zoneLayersRef = useRef<L.Layer[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showWarehouses, setShowWarehouses] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  const { data: facilitiesData } = useFacilities();
  const facilities = facilitiesData?.facilities ?? [];

  const { data: warehousesList } = useQuery({
    queryKey: ['warehouses-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    const updateCoords = () => {
      const center = map.getCenter();
      setCoordinates({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    };
    map.on('moveend', updateCoords);
    map.on('zoomend', updateCoords);
    updateCoords();

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Facility markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    facilityMarkersRef.current.forEach(m => m.remove());
    facilityMarkersRef.current = [];

    if (!showFacilities) return;

    facilities.forEach((f: any) => {
      if (typeof f.lat !== 'number' || typeof f.lng !== 'number') return;
      if (f.lat === 0 && f.lng === 0) return;

      const marker = L.marker([f.lat, f.lng], { icon: createFacilityIcon(f.type) })
        .bindPopup(`
          <div style="min-width:180px">
            <strong>${f.name}</strong><br/>
            <span style="color:#666;font-size:12px">${f.type || 'Facility'} ${f.level_of_care ? '&middot; ' + f.level_of_care : ''}</span><br/>
            <span style="font-size:11px;color:#888">${f.lga || ''} ${f.ward ? '&middot; ' + f.ward : ''}</span><br/>
            <span style="font-size:11px;color:#999">${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}</span>
          </div>
        `)
        .addTo(map);

      facilityMarkersRef.current.push(marker);
    });
  }, [mapReady, facilities, showFacilities]);

  // Warehouse markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    warehouseMarkersRef.current.forEach(m => m.remove());
    warehouseMarkersRef.current = [];

    if (!showWarehouses || !warehousesList) return;

    warehousesList.forEach((wh: any) => {
      if (typeof wh.lat !== 'number' || typeof wh.lng !== 'number') return;

      const marker = L.marker([wh.lat, wh.lng], { icon: createWarehouseIcon(), zIndexOffset: 1000 })
        .bindPopup(`
          <div style="min-width:150px">
            <strong>${wh.name}</strong><br/>
            <span style="color:#0078A0;font-size:12px">Warehouse</span><br/>
            <span style="font-size:11px;color:#999">${wh.lat.toFixed(6)}, ${wh.lng.toFixed(6)}</span>
          </div>
        `)
        .addTo(map);

      warehouseMarkersRef.current.push(marker);
    });
  }, [mapReady, warehousesList, showWarehouses]);

  // Zone boundaries
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    zoneLayersRef.current.forEach(l => map.removeLayer(l));
    zoneLayersRef.current = [];

    if (!showZones) return;

    zones.forEach((zone, idx) => {
      const geometry = zone.metadata?.geometry;
      const color = (zone.metadata?.color as string) || ZONE_PALETTE[idx % ZONE_PALETTE.length];
      const popupHtml = `
        <div>
          <strong>${zone.name}</strong><br/>
          <span style="color:#666;font-size:12px">Code: ${zone.code || 'N/A'}</span><br/>
          ${zone.description ? `<span style="font-size:11px;color:#888">${zone.description}</span>` : ''}
        </div>
      `;

      if (geometry?.coordinates) {
        try {
          const layer = L.geoJSON(geometry as any, {
            style: {
              color,
              weight: 2,
              opacity: 0.7,
              fillColor: color,
              fillOpacity: 0.1,
              dashArray: '6,4',
            },
          })
            .bindPopup(popupHtml)
            .on('click', () => onZoneSelect(zone))
            .addTo(map);

          zoneLayersRef.current.push(layer);
        } catch {
          // Skip invalid geometry
        }
      } else if (zone.region_center?.lat && zone.region_center?.lng) {
        // Zone has a center point but no polygon — render as a labelled circle marker
        const circle = L.circleMarker([zone.region_center.lat, zone.region_center.lng], {
          radius: 14,
          fillColor: color,
          color: '#fff',
          weight: 2,
          fillOpacity: 0.7,
        })
          .bindPopup(popupHtml)
          .on('click', () => onZoneSelect(zone))
          .addTo(map);

        const label = L.marker([zone.region_center.lat, zone.region_center.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              background:${color};color:white;border-radius:50%;
              width:28px;height:28px;display:flex;align-items:center;justify-content:center;
              font-size:9px;font-weight:bold;border:2px solid white;
              box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:pointer;text-align:center;
              overflow:hidden;padding:2px;
            ">${zone.code || zone.name.slice(0, 2).toUpperCase()}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        })
          .bindPopup(popupHtml)
          .on('click', () => onZoneSelect(zone))
          .addTo(map);

        zoneLayersRef.current.push(circle, label);
      }
    });
  }, [mapReady, zones, showZones, onZoneSelect]);

  const handleLocate = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = L.latLngBounds([]);
    facilityMarkersRef.current.forEach(m => bounds.extend(m.getLatLng()));
    warehouseMarkersRef.current.forEach(m => bounds.extend(m.getLatLng()));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  };

  return (
    <Card className={cn(
      isFullscreen && 'fixed inset-0 z-50 rounded-none border-none m-0'
    )}>
      <CardContent className="p-0 h-full">
        <div className={cn('relative', isFullscreen ? 'h-full' : '')}>
          <div
            ref={mapContainerRef}
            className={cn(
              'w-full rounded-lg overflow-hidden',
              isFullscreen ? 'h-full rounded-none' : 'h-[550px]'
            )}
          />

          {/* Layer toggles */}
          <div className="absolute top-3 left-3 z-[1000] flex flex-wrap gap-1.5">
            <Button
              variant={showZones ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 shadow-md bg-background/95 backdrop-blur-sm"
              onClick={() => setShowZones(prev => !prev)}
            >
              <Layers className="h-3.5 w-3.5" />
              Zones
            </Button>
            <Button
              variant={showFacilities ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 shadow-md bg-background/95 backdrop-blur-sm"
              onClick={() => setShowFacilities(prev => !prev)}
            >
              <Building2 className="h-3.5 w-3.5" />
              Facilities
            </Button>
            <Button
              variant={showWarehouses ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 shadow-md bg-background/95 backdrop-blur-sm"
              onClick={() => setShowWarehouses(prev => !prev)}
            >
              <Warehouse className="h-3.5 w-3.5" />
              Warehouses
            </Button>
          </div>

          {/* Map controls (top-right) */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
            <div style={{ background: '#fff', borderRadius: 4, boxShadow: '0 0 0 2px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleFullscreen}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 29, height: 29, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand map'}
                  >
                    {isFullscreen ? <Minimize2 style={{ width: 15, height: 15, color: '#333' }} /> : <Maximize2 style={{ width: 15, height: 15, color: '#333' }} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{isFullscreen ? 'Exit fullscreen' : 'Expand map'}</TooltipContent>
              </Tooltip>
            </div>

            <div style={{ background: '#fff', borderRadius: 4, boxShadow: '0 0 0 2px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <button onClick={() => mapRef.current?.zoomIn()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 29, height: 29, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <ZoomIn style={{ width: 15, height: 15, color: '#333' }} />
              </button>
              <div style={{ borderTop: '1px solid #ddd' }} />
              <button onClick={() => mapRef.current?.zoomOut()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 29, height: 29, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <ZoomOut style={{ width: 15, height: 15, color: '#333' }} />
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: 4, boxShadow: '0 0 0 2px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleLocate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 29, height: 29, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <LocateFixed style={{ width: 15, height: 15, color: '#333' }} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Fit to data</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Coordinate HUD */}
          {coordinates && (
            <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/90 backdrop-blur-sm shadow text-xs font-mono text-muted-foreground">
              <Crosshair className="h-3 w-3" />
              <span>{coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                z{coordinates.zoom.toFixed(0)}
              </Badge>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 right-3 z-[1000] px-3 py-2 rounded-md bg-background/90 backdrop-blur-sm shadow text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', border: '1px solid white' }} />
              <span>Hospital</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', border: '1px solid white' }} />
              <span>Clinic</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '1px solid white' }} />
              <span>Pharmacy</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#a855f7', border: '1px solid white' }} />
              <span>Health Center</span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg,#0078A0,#006080)', border: '2px solid white' }} />
              <span>Warehouse</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
