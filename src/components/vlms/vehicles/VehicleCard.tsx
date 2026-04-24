/**
 * VehicleCard Component
 * Vertical card for grid view display
 * Uses BIKO design system branding
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
import { MoreVertical, Eye, Edit, Trash2, Fuel, Gauge } from 'lucide-react';
import { VehicleImage } from './VehicleImage';
import { cn } from '@/lib/utils';
import { getStatusColors } from '@/lib/designTokens';
import type { Database } from '@/integrations/supabase/types';
import { VehicleCapacityVisualizer } from './capacity/VehicleCapacityVisualizer';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

interface VehicleCardProps {
  vehicle: Vehicle;
  onView?: (vehicle: Vehicle) => void;
  onEdit?: (vehicle: Vehicle) => void;
  onDelete?: (vehicle: Vehicle) => void;
}


export function VehicleCard({ vehicle, onView, onEdit, onDelete }: VehicleCardProps) {
  const statusColors = getStatusColors(
    vehicle.status as 'available' | 'in_use' | 'maintenance' | 'out_of_service'
  );

  const formatMileage = (mileage?: number | null) => {
    if (!mileage) return 'N/A';
    return `${mileage.toLocaleString()} km`;
  };

  return (
    <Card className="group hover:shadow-md transition-shadow duration-200 overflow-hidden">
      {/* Vehicle Image */}
      <VehicleImage
        src={vehicle.thumbnail_url || vehicle.photo_url}
        alt={`${vehicle.make} ${vehicle.model}`}
        aiGenerated={vehicle.ai_generated || false}
        vehicleType={vehicle.type || vehicle.vehicle_type}
        make={vehicle.make}
        model={vehicle.model}
        className="h-48 w-full rounded-t-lg overflow-hidden"
        fallbackClassName="h-48 rounded-t-lg"
      />

      <CardContent className="p-5 space-y-4">
        {/* Header with Make/Model and Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {vehicle.make} {vehicle.model}
            </h3>
            <p className="text-sm text-muted-foreground">{vehicle.year || 'N/A'}</p>
          </div>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* License Plate */}
        {vehicle.license_plate && (
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono font-medium">
              {vehicle.license_plate}
            </div>
          </div>
        )}

        {/* Capacity Visualizer */}
        {(vehicle.capacity_kg || vehicle.capacity_m3) && (
          <div className="flex justify-center py-2 border-y border-border bg-muted/30">
            <VehicleCapacityVisualizer
              vehicleType={vehicle.vehicle_type || vehicle.type || undefined}
              make={vehicle.make || undefined}
              model={vehicle.model || undefined}
              maxWeight={vehicle.capacity_kg || undefined}
              maxVolume={vehicle.capacity_m3 || undefined}
              size="sm"
              showLabel={false}
              showMetrics={false}
            />
          </div>
        )}

        {/* Key Specs */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Fuel className="h-3.5 w-3.5" />
            <span className="truncate capitalize">{vehicle.fuel_type || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            <span className="truncate">{formatMileage(vehicle.current_mileage)}</span>
          </div>
        </div>

        {/* Type Badge */}
        {vehicle.type && (
          <div>
            <Badge variant="outline" className="text-xs">
              {vehicle.type}
            </Badge>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Badge
            className={cn(
              'text-xs',
              statusColors.bg,
              statusColors.text,
              statusColors.border,
              'border'
            )}
          >
            {vehicle.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
          </Badge>

          {vehicle.current_location_id && (
            <span className="text-xs text-muted-foreground truncate">
              Location #{vehicle.current_location_id.slice(0, 8)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
