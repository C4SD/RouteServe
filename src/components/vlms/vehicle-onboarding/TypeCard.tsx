/**
 * VLMS Vehicle Onboarding - Type Card Component
 * Individual card for displaying a vehicle type
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Package, Weight, Truck, Car, Bus, Bike, Forklift, Container, CircleHelp, type LucideIcon } from 'lucide-react';

// Fixed icon map — avoids `import * as LucideIcons` which defeats tree-shaking
const VEHICLE_ICONS: Record<string, LucideIcon> = {
  Truck, Car, Bus, Bike, Forklift, Container, Package,
};

function resolveVehicleIcon(name: string | undefined | null): LucideIcon {
  if (!name) return Truck;
  return VEHICLE_ICONS[name] ?? CircleHelp;
}
import type { VehicleType } from '@/types/vlms-onboarding';
import { formatVolume, formatWeight } from '@/lib/vlms/capacityCalculations';

interface TypeCardProps {
  type: VehicleType;
  isSelected: boolean;
  onSelect: () => void;
}

export function TypeCard({ type, isSelected, onSelect }: TypeCardProps) {
  // Get the icon component dynamically
  const IconComponent = resolveVehicleIcon(type.icon_name);

  const hasCapacityInfo = type.default_capacity_kg || type.default_capacity_m3;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-lg',
        'border-2 h-full',
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg scale-105'
          : 'border-border hover:border-primary/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'rounded-lg p-3 transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <IconComponent className="h-6 w-6" />
          </div>

          {type.code && (
            <Badge variant="outline" className="text-xs">
              {type.code}
            </Badge>
          )}
        </div>

        <CardTitle className="text-lg mt-3">{type.name}</CardTitle>

        {type.description && (
          <CardDescription className="text-sm line-clamp-2">
            {type.description}
          </CardDescription>
        )}
      </CardHeader>

      {hasCapacityInfo && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Default Capacity
            </div>

            <div className="flex flex-wrap gap-2">
              {type.default_capacity_kg && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{formatWeight(type.default_capacity_kg)}</span>
                </div>
              )}

              {type.default_capacity_m3 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{formatVolume(type.default_capacity_m3)}</span>
                </div>
              )}
            </div>

            {/* Tier count badge */}
            {type.default_tier_config && Array.isArray(type.default_tier_config) && type.default_tier_config.length > 0 && (
              <Badge variant="secondary" className="text-xs mt-2">
                {type.default_tier_config.length} tier{type.default_tier_config.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
