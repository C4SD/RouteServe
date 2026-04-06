import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { formatWeight } from '@/lib/vlms/capacityCalculations';
import { VehicleWithRelations } from '@/types/vlms';
import { TierConfig } from '@/types/vlms-onboarding';
import { getVehicleSilhouette } from '@/lib/vehicleUtils';
import { cn } from '@/lib/utils';

interface VehicleCapacityCardProps {
  vehicle: VehicleWithRelations;
  currentWeight?: number; // Optional current load for visualization
  currentVolume?: number; // Optional current volume for visualization
}

function getCapacityColor(pct: number): string {
  if (pct >= 90) return 'text-red-500';
  if (pct >= 70) return 'text-blue-500';
  if (pct >= 40) return 'text-green-500';
  return 'text-muted-foreground';
}

export function VehicleCapacityCard({ vehicle, currentWeight, currentVolume }: VehicleCapacityCardProps) {
  // Extract tiers array from tiered_config object
  const tieredConfig = vehicle.tiered_config as any;
  const tierConfigs: TierConfig[] = tieredConfig?.tiers || [];

  // Sort tiers by order (Upper first for visual display)
  const sortedTiers = [...tierConfigs].sort((a, b) => (b.tier_order || 0) - (a.tier_order || 0));

  // Capacity percentage
  const maxWeight = vehicle.capacity_kg || 0;
  const weightPct = maxWeight > 0 ? Math.min(Math.round(((currentWeight || 0) / maxWeight) * 100), 100) : 0;
  const silhouetteSrc = getVehicleSilhouette(
    (vehicle as any).type || vehicle.vehicle_type,
    vehicle.make,
    vehicle.model,
  );
  const capacityColor = getCapacityColor(weightPct);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Vehicle Capacity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Silhouette card with capacity overlay */}
        <div className="flex justify-center py-4 border-b">
          <div className="relative w-80 h-40 flex items-center justify-center">
            <img
              src={silhouetteSrc}
              alt={`${vehicle.make || ''} ${vehicle.model} silhouette`}
              className="h-full w-full object-contain opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className={cn('text-6xl font-bold drop-shadow-lg', capacityColor)}>
                {weightPct}%
              </span>
            </div>
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground -mt-2 pb-2 border-b">
          Weight: {formatWeight(currentWeight || 0)} / {formatWeight(maxWeight)}
        </div>

        {/* Payload Capacity Header */}
        {vehicle.capacity_kg && (
          <div className="pb-4 border-b">
            <div className="text-sm text-muted-foreground mb-1">Payload Capacity</div>
            <div className="text-2xl font-bold">{formatWeight(vehicle.capacity_kg)}</div>
          </div>
        )}

        {/* Tier Visualization */}
        {sortedTiers.length > 0 ? (
          <div className="space-y-3">
            {sortedTiers.map((tier) => (
              <div key={tier.tier_order}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{tier.tier_name}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {tier.max_weight_kg ? formatWeight(tier.max_weight_kg) : ''}
                  </span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {/* Render boxes based on capacity percentage */}
                  {Array.from({ length: Math.max(1, Math.ceil((tier.weight_pct || 0) / 10)) }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 w-12 border-2 rounded bg-muted/50 hover:bg-muted transition-colors"
                      title={`${tier.tier_name} capacity slot`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8">
            No tier configuration available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
