/**
 * VehicleListItem Component
 * Horizontal card for list view display (inspired by reference image)
 * Uses RouteServe design system branding
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Edit, Trash2, Fuel, Gauge, Calendar, MapPin } from 'lucide-react';
import { VehicleImage } from './VehicleImage';
import { cn } from '@/lib/utils';
import { getStatusColors } from '@/lib/designTokens';
import type { Database } from '@/integrations/supabase/types';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

interface VehicleListItemProps {
  vehicle: Vehicle;
  onView?: (vehicle: Vehicle) => void;
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicle: Vehicle) => void;
}

export function VehicleListItem({ vehicle, onView, onEdit, onDelete }: VehicleListItemProps) {
  const statusColors = getStatusColors(
    vehicle.status as 'available' | 'in_use' | 'maintenance' | 'out_of_service'
  );

  const formatMileage = (mileage?: number | null) => {
    if (!mileage) return 'N/A';
    return `${mileage.toLocaleString()} km`;
  };

  const formatPrice = (price?: number | null) => {
    if (!price) return null;
    return `$${price.toLocaleString()}`;
  };

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-l-4"
      style={{
        borderLeftColor: vehicle.status === 'available' ? 'oklch(0.5770 0.2450 27.3250)' :
                         vehicle.status === 'in_use' ? 'oklch(0.6420 0.2100 60.9375)' :
                         vehicle.status === 'maintenance' ? 'oklch(0.6925 0.1765 81.5625)' :
                         'oklch(0.6310 0.1965 21.5625)'
      }}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-5">
          {/* Vehicle Image - Left */}
          <VehicleImage
            src={vehicle.thumbnail_url || vehicle.photo_url}
            alt={`${vehicle.make} ${vehicle.model}`}
            aiGenerated={vehicle.ai_generated || false}
            vehicleType={vehicle.type || vehicle.vehicle_type}
            make={vehicle.make}
            model={vehicle.model}
            className="w-32 h-24 rounded-lg overflow-hidden flex-shrink-0"
            fallbackClassName="w-32 h-24 rounded-lg"
          />

          {/* Main Content - Center */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {vehicle.make} {vehicle.model}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {vehicle.year || 'N/A'} • {vehicle.type || 'N/A'}
                </p>
              </div>

              {/* Status Badge */}
              <Badge
                className={cn(
                  'text-xs font-medium',
                  statusColors.bg,
                  statusColors.text,
                  statusColors.border,
                  'border'
                )}
              >
                {vehicle.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {/* License Plate */}
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-muted border border-border rounded font-mono text-xs font-medium">
                  {vehicle.license_plate || 'NO PLATE'}
                </div>
              </div>

              {/* Fuel Type */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Fuel className="h-4 w-4 flex-shrink-0" />
                <span className="truncate capitalize">{vehicle.fuel_type || 'N/A'}</span>
              </div>

              {/* Year */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{vehicle.year || 'N/A'}</span>
              </div>

              {/* Mileage */}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Gauge className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{formatMileage(vehicle.current_mileage)}</span>
              </div>
            </div>

            {/* Additional Info Row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {vehicle.current_location_id && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">Location #{vehicle.current_location_id.slice(0, 8)}</span>
                </div>
              )}

              {vehicle.vin && (
                <div className="truncate">
                  VIN: <span className="font-mono">{vehicle.vin}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Price/Actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* Price/Value */}
            {formatPrice(vehicle.current_book_value || vehicle.purchase_price) && (
              <div className="text-right">
                <div className="text-lg font-semibold text-primary">
                  {formatPrice(vehicle.current_book_value || vehicle.purchase_price)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {vehicle.current_book_value ? 'Book Value' : 'Purchase Price'}
                </div>
              </div>
            )}

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView?.(vehicle)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit?.(vehicle)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete?.(vehicle)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
