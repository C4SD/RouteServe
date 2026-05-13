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

function makeFacilityIcon(color: string, accepted: boolean): L.DivIcon {
  const opacity = accepted ? '1' : '0.55';
  const border = accepted ? 'white' : '#ccc';
  return L.divIcon({
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid ${border};box-shadow:0 1px 3px rgba(0,0,0,0.35);opacity:${opacity};"></div>`,
  });
}

interface CopilotReviewMapProps {
  result: CopilotGenerationResult;
  selectedZoneId: string | null;
  onZoneClick: (zone: SuggestedZone, warehouse: CopilotWarehouse) => void;
  onFacilityClick: (facility: CopilotFacility, zone?: SuggestedZone) => void;
}

export function CopilotReviewMap({
  result,
  selectedZoneId,
  onZoneClick,
  onFacilityClick,
}: CopilotReviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

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

    // Clear old layers
    layersRef.current.forEach(l => l.remove());
    layersRef.current = [];

    const bounds: [number, number][] = [];

    result.structures.forEach((structure, wi) => {
      const color = warehouseColor(wi);
      const { warehouse, zones } = structure;

      // Warehouse marker
      const wMarker = L.marker([warehouse.lat, warehouse.lng], {
        icon: makeWarehouseIcon(color),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindTooltip(warehouse.name, { permanent: false, direction: 'top' });

      layersRef.current.push(wMarker);
      bounds.push([warehouse.lat, warehouse.lng]);

      zones.forEach(zone => {
        const isSelected = zone.id === selectedZoneId;
        const isAccepted = zone.acceptance === 'accepted';

        // Convex-hull polygon for zone (approximate with a circle if ≤1 facility)
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
          // Single facility — draw a small circle
          const f = zone.facilities[0];
          const circle = L.circle([f.lat, f.lng], {
            radius: 2000,
            color,
            weight: 1.5,
            fillOpacity: 0.08,
          }).addTo(map);
          layersRef.current.push(circle);
        }

        // Facility markers
        zone.facilities.forEach(f => {
          const m = L.marker([f.lat, f.lng], {
            icon: makeFacilityIcon(color, isAccepted),
            zIndexOffset: 500,
          })
            .addTo(map)
            .bindTooltip(f.name, { permanent: false, direction: 'top' })
            .on('click', () => onFacilityClick(f, zone));

          layersRef.current.push(m);
          bounds.push([f.lat, f.lng]);
        });
      });

      // Out of coverage
      structure.out_of_coverage.forEach(f => {
        const m = L.marker([f.lat, f.lng], {
          icon: makeFacilityIcon('#94a3b8', false),
        })
          .addTo(map)
          .bindTooltip(`${f.name} (out of coverage)`, { permanent: false })
          .on('click', () => onFacilityClick(f));

        layersRef.current.push(m);
        bounds.push([f.lat, f.lng]);
      });
    });

    // Global out of coverage
    result.global_out_of_coverage.forEach(f => {
      const m = L.marker([f.lat, f.lng], {
        icon: makeFacilityIcon('#94a3b8', false),
      })
        .addTo(map)
        .bindTooltip(`${f.name} (out of coverage)`)
        .on('click', () => onFacilityClick(f));

      layersRef.current.push(m);
      bounds.push([f.lat, f.lng]);
    });

    // Fit bounds
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, selectedZoneId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-lg" />
    </div>
  );
}
