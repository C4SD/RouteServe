/**
 * MapMarkerPopup - Floating card that appears when a map marker is clicked.
 * Positioned in screen-space (pixel coords) above the clicked marker.
 */

import { useState } from 'react';
import { X, MapPin, Copy, Check, Building2, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MarkerPopupData {
  type: 'facility' | 'warehouse';
  id: string;
  name: string;
  /** Facility type or warehouse type */
  subtype?: string | null;
  lga?: string | null;
  /** Warehouse code */
  code?: string | null;
  isActive?: boolean;
  lat: number;
  lng: number;
}

interface MapMarkerPopupProps {
  data: MarkerPopupData;
  screenPos: { x: number; y: number };
  onClose: () => void;
}

const CARD_WIDTH = 232;

export function MapMarkerPopup({ data, screenPos, onClose }: MapMarkerPopupProps) {
  const [copied, setCopied] = useState(false);

  const coords = `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(coords);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: screenPos.x - CARD_WIDTH / 2,
    top: screenPos.y - 12,
    transform: 'translateY(-100%)',
    width: CARD_WIDTH,
    zIndex: 30,
    pointerEvents: 'all',
  };

  return (
    <div style={style}>
      {/* Card */}
      <div className="bg-card border rounded-xl shadow-2xl overflow-visible">
        {/* Header */}
        <div className="relative px-3 pt-3 pb-2 bg-muted/40 rounded-t-xl">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-start gap-2 pr-6">
            <div className="mt-0.5 shrink-0">
              {data.type === 'facility' ? (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Warehouse className="h-3.5 w-3.5 text-amber-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug line-clamp-2">{data.name}</p>
            </div>
          </div>

          {/* Badges row */}
          {(data.subtype || data.code || data.isActive === false) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap pl-9">
              {data.subtype && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                  {data.subtype}
                </Badge>
              )}
              {data.code && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none font-mono">
                  {data.code}
                </Badge>
              )}
              {data.isActive === false && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                  Inactive
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2">
          {data.lga && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{data.lga}</span>
            </div>
          )}

          {/* Coordinates with copy */}
          <button
            onClick={copyCoords}
            className="flex items-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors group rounded px-1.5 py-1 -mx-1.5 hover:bg-muted"
            title="Copy coordinates"
          >
            <span className="font-mono flex-1 text-left tabular-nums">{coords}</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Copy className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </div>
      </div>

      {/* Pointer triangle pointing down toward the marker */}
      <div className="flex justify-center">
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid hsl(var(--border))',
          }}
        />
      </div>
      <div className="flex justify-center" style={{ marginTop: -7 }}>
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: '7px solid hsl(var(--card))',
          }}
        />
      </div>
    </div>
  );
}
