/**
 * VLMS Vehicle Onboarding - Category Tile Component
 * Individual tile for displaying a vehicle category
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Truck, Car, Bus, Bike, Forklift, Container, Package, CircleHelp, type LucideIcon } from 'lucide-react';

const VEHICLE_ICONS: Record<string, LucideIcon> = {
  Truck, Car, Bus, Bike, Forklift, Container, Package,
};

function resolveVehicleIcon(name: string | undefined | null): LucideIcon {
  if (!name) return Truck;
  return VEHICLE_ICONS[name] ?? CircleHelp;
}
import type { VehicleCategory } from '@/types/vlms-onboarding';

interface CategoryTileProps {
  category: VehicleCategory;
  isSelected: boolean;
  onSelect: () => void;
}

export function CategoryTile({ category, isSelected, onSelect }: CategoryTileProps) {
  // Get the icon component dynamically
  const IconComponent = resolveVehicleIcon(category.icon_name);

  const isEU = category.source === 'eu';
  const isRouteServe = category.source === 'biko';

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        'border-2',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
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
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Icon */}
          <div
            className={cn(
              'rounded-full p-4 transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <IconComponent className="h-8 w-8" />
          </div>

          {/* Category Name */}
          <div className="space-y-1">
            <h3 className="font-semibold text-base leading-tight">
              {category.display_name}
            </h3>

            {/* Category Code Badge */}
            <Badge
              variant={isEU ? 'default' : 'secondary'}
              className="text-xs"
            >
              {category.code}
            </Badge>
          </div>

          {/* Description */}
          {category.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {category.description}
            </p>
          )}

          {/* Source Badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              isEU && 'border-primary text-primary',
              isRouteServe && 'border-warning text-warning'
            )}
          >
            {isEU ? '🇪🇺 EU Standard' : '🚀 RouteServe'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
