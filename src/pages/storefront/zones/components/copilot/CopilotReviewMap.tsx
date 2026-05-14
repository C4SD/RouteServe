import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { haversineKm } from '@/lib/operations-copilot-engine';
import type {
  CopilotGenerationResult,
  SuggestedZone,
  CopilotFacility,
  CopilotWarehouse,
} from '@/types/operations-copilot';

const DEFAULT_CENTER: [number, number] = [12.0, 8.52];
const DEFAULT_ZOOM = 8;

const PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

function warehouseColor(idx: number) {
  return PALETTE[idx % PALETTE.length];
}

function makeWarehouseIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      </svg>
    </div>`,
  });
}

function makeFacilityIcon(color: string, accepted: boolean, highlighted = false): L.DivIcon {
  const size = highlighted ? 14 : 10;
  const half = size / 2;
  const opacity = accepted ? '1' : '0.55';
  const border = highlighted ? 'white' : accepted ? 'white' : '#ccc';
  const shadow = highlighted ? '0 0 0 3px rgba(255,255,255,0.6), 0 2px 6px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.35)';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${border};box-shadow:${shadow};opacity:${opacity};"></div>`,
  });
}

interface CopilotReviewMapProps {
  result: CopilotGenerationResult;
  selectedZoneId: string | null;
  highlightedFacilityIds?: string[] | null;
  onZoneClick: (zone: SuggestedZone, warehouse: CopilotWarehouse) => void;
  onFacilityClick: (facility: CopilotFacility, zone?: SuggestedZone) => void;
}

export function CopilotReviewMap({
  result,
  selectedZoneId,
  highlightedFacilityIds,
  onZoneClick,
  onFacilityClick,
}: CopilotReviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const prevResultIdRef = useRef<string | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render layers when result or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    layersRef.current.forEach(l => l.remove());
    layersRef.current = [];

    const allBounds: [number, number][] = [];
    const selectedZoneBounds: [number, number][] = [];
    const highlightedBounds: [number, number][] = [];
    const highlightSet = new Set(highlightedFacilityIds ?? []);

    // Route-path polylines (drawn first so they're under markers)
    if (highlightedFacilityIds && highlightedFacilityIds.length > 1) {
      const orderedFacilities: CopilotFacility[] = [];
      const facilityMap = new Map<string, CopilotFacility>();
      result.structures.forEach(s => s.zones.forEach(z => z.facilities.forEach(f => facilityMap.set(f.id, f))));

      highlightedFacilityIds.forEach(id => {
        const f = facilityMap.get(id);
        if (f) orderedFacilities.push(f);
      });

      if (orderedFacilities.length > 1) {
        const latlngs = orderedFacilities.map(f => [f.lat, f.lng] as [number, number]);
        const path = L.polyline(latlngs, {
          color: '#7c3aed',
          weight: 2.5,
          opacity: 0.85,
          dashArray: '8 4',
        }).addTo(map);
        layersRef.current.push(path);
      }
    }

    result.structures.forEach((structure, wi) => {
      const color = warehouseColor(wi);
      const { warehouse, zones } = structure;

      const wMarker = L.marker([warehouse.lat, warehouse.lng], {
        icon: makeWarehouseIcon(color),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindTooltip(warehouse.name, { permanent: false, direction: 'top' });

      layersRef.current.push(wMarker);
      allBounds.push([warehouse.lat, warehouse.lng]);

      zones.forEach(zone => {
        const isSelected = zone.id === selectedZoneId;
        const isAccepted = zone.acceptance === 'accepted';

        if (zone.facilities.length >= 3) {
          const latlngs = zone.facilities.map(f => [f.lat, f.lng] as [number, number]);
          const polygon = L.polygon(latlngs, {
            color,
            weight: isSelected ? 2.5 : 1.5,
            opacity: isSelected ? 0.9 : 0.5,
            fillOpacity: isSelected ? 0.15 : 0.06,
            dashArray: isAccepted ? undefined : '6 4',
          })
            .addTo(map)
            .on('click', () => onZoneClick(zone, warehouse));
          layersRef.current.push(polygon);
        } else if (zone.facilities.length > 0) {
          const f = zone.facilities[0];
          const circle = L.circle([f.lat, f.lng], {
            radius: 2000,
            color,
            weight: 1.5,
            fillOpacity: 0.08,
          }).addTo(map);
          layersRef.current.push(circle);
        }

        zone.facilities.forEach(f => {
          const isHighlighted = highlightSet.has(f.id);
          const m = L.marker([f.lat, f.lng], {
            icon: makeFacilityIcon(color, isAccepted, isHighlighted),
            zIndexOffset: isHighlighted ? 800 : 500,
          })
            .addTo(map)
            .bindTooltip(f.name, { permanent: false, direction: 'top' })
            .on('click', () => onFacilityClick(f, zone));

          layersRef.current.push(m);
          allBounds.push([f.lat, f.lng]);

          if (isSelected) selectedZoneBounds.push([f.lat, f.lng]);
          if (isHighlighted) highlightedBounds.push([f.lat, f.lng]);
        });
      });

      structure.out_of_coverage.forEach(f => {
        const m = L.marker([f.lat, f.lng], {
          icon: makeFacilityIcon('#94a3b8', false),
        })
          .addTo(map)
          .bindTooltip(`${f.name} (out of coverage)`, { permanent: false })
          .on('click', () => onFacilityClick(f));

        layersRef.current.push(m);
        allBounds.push([f.lat, f.lng]);
      });
    });

    result.global_out_of_coverage.forEach(f => {
      const m = L.marker([f.lat, f.lng], {
        icon: makeFacilityIcon('#94a3b8', false),
      })
        .addTo(map)
        .bindTooltip(`${f.name} (out of coverage)`)
        .on('click', () => onFacilityClick(f));

      layersRef.current.push(m);
      allBounds.push([f.lat, f.lng]);
    });

    // Determine whether this is the first render for this result
    const isNewResult = prevResultIdRef.current !== result.generated_at;
    prevResultIdRef.current = result.generated_at;

    if (highlightedBounds.length > 0) {
      const latLngBounds = L.latLngBounds(highlightedBounds).pad(0.3);
      isNewResult ? map.fitBounds(latLngBounds) : map.flyToBounds(latLngBounds, { duration: 0.8 });
    } else if (selectedZoneBounds.length > 0) {
      const latLngBounds = L.latLngBounds(selectedZoneBounds).pad(0.25);
      isNewResult ? map.fitBounds(latLngBounds) : map.flyToBounds(latLngBounds, { duration: 0.8 });
    } else if (allBounds.length > 0) {
      map.fitBounds(L.latLngBounds(allBounds).pad(0.1));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, selectedZoneId, highlightedFacilityIds]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-lg" />
    </div>
  );
}
