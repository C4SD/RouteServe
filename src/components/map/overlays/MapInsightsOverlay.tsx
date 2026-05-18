import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Route, Ruler, Clock, Warehouse } from 'lucide-react';
import { calculateDistance } from '@/lib/routeOptimization';
import type { FacilityClickPayload } from '@/components/map/layers/RoutePolylinesLayer';

export interface RouteInsightsData {
  routeId: string;
  routeName: string;
  status: string;
  isSandbox: boolean;
  facilityCount: number;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  warehouseName: string;
  warehouseLat: number;
  warehouseLng: number;
  facilities: Array<{ lat: number; lng: number; name: string }>;
}

interface MapInsightsOverlayProps {
  selectedFacility: FacilityClickPayload | null;
  selectedRoute: RouteInsightsData | null;
  onClose: () => void;
}

function formatDistance(km: number | null | undefined): string {
  if (km == null) return '—';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function MetricRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function FacilityInsights({ facility, onClose }: { facility: FacilityClickPayload; onClose: () => void }) {
  return (
    <Card className="bg-background/95 backdrop-blur border shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Facility Insights
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div>
          <div className="font-semibold text-sm">{facility.facilityName}</div>
          <div className="flex gap-2 mt-1">
            {facility.facilityType && (
              <Badge variant="outline" className="text-xs">{facility.facilityType}</Badge>
            )}
            {facility.facilityLga && (
              <Badge variant="secondary" className="text-xs">{facility.facilityLga}</Badge>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          {facility.distanceToWarehouseKm != null && (
            <MetricRow
              icon={Warehouse}
              label="To warehouse"
              value={formatDistance(facility.distanceToWarehouseKm)}
            />
          )}
          {facility.distanceToPreviousKm != null && (
            <MetricRow
              icon={Ruler}
              label="From prev stop"
              value={formatDistance(facility.distanceToPreviousKm)}
            />
          )}
          {facility.distanceToNextKm != null && (
            <MetricRow
              icon={Ruler}
              label="To next stop"
              value={formatDistance(facility.distanceToNextKm)}
            />
          )}
          {facility.sequenceOrder != null && facility.totalFacilities != null && (
            <MetricRow
              icon={Route}
              label="Sequence"
              value={`#${facility.sequenceOrder} of ${facility.totalFacilities}`}
            />
          )}
        </div>

        {(facility.routeName || facility.warehouseName) && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground space-y-0.5">
              {facility.routeName && <div>Route: {facility.routeName}</div>}
              {facility.warehouseName && <div>Warehouse: {facility.warehouseName}</div>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RouteInsights({ route, onClose }: { route: RouteInsightsData; onClose: () => void }) {
  // Calculate average stop spacing from facilities + warehouse
  let avgSpacing = 0;
  if (route.facilities.length >= 2) {
    let totalDist = 0;
    // Warehouse to first facility
    totalDist += calculateDistance(
      route.warehouseLat, route.warehouseLng,
      route.facilities[0].lat, route.facilities[0].lng
    );
    for (let i = 1; i < route.facilities.length; i++) {
      totalDist += calculateDistance(
        route.facilities[i - 1].lat, route.facilities[i - 1].lng,
        route.facilities[i].lat, route.facilities[i].lng
      );
    }
    avgSpacing = totalDist / route.facilities.length;
  }

  return (
    <Card className="bg-background/95 backdrop-blur border shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Route className="h-4 w-4" />
            Route Insights
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div>
          <div className="font-semibold text-sm">{route.routeName}</div>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{route.status}</Badge>
            {route.isSandbox && <Badge variant="secondary" className="text-xs">Sandbox</Badge>}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <MetricRow
            icon={MapPin}
            label="Facilities"
            value={String(route.facilityCount)}
          />
          {route.totalDistanceKm != null && (
            <MetricRow
              icon={Ruler}
              label="Total distance"
              value={formatDistance(route.totalDistanceKm)}
            />
          )}
          {route.estimatedDurationMin != null && (
            <MetricRow
              icon={Clock}
              label="Est. duration"
              value={`${Math.ceil(route.estimatedDurationMin / 60)} hrs`}
            />
          )}
          {avgSpacing > 0 && (
            <MetricRow
              icon={Ruler}
              label="Avg stop spacing"
              value={formatDistance(avgSpacing)}
            />
          )}
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground">
          <div>Warehouse: {route.warehouseName}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MapInsightsOverlay({ selectedFacility, selectedRoute, onClose }: MapInsightsOverlayProps) {
  if (selectedFacility) {
    return <FacilityInsights facility={selectedFacility} onClose={onClose} />;
  }
  if (selectedRoute) {
    return <RouteInsights route={selectedRoute} onClose={onClose} />;
  }
  return null;
}
