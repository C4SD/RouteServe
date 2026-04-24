import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PaginationControls, usePagination } from '@/components/ui/pagination-controls';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';
import { getVehicleStateColors } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  licensePlate: string;
  state: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  mileage: number;
}

interface VehicleTableProps {
  vehicles: Vehicle[];
}

export function VehicleTable({ vehicles }: VehicleTableProps) {
  const pagination = usePagination({
    pageSize: 10,
    totalItems: vehicles?.length || 0,
  });

  if (!vehicles || vehicles.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No vehicles found"
        description="Add your first vehicle to get started"
      />
    );
  }

  const paginatedVehicles = vehicles.slice(
    pagination.startIndex,
    pagination.endIndex
  );

  return (
    <div className="space-y-biko-4">
      <div className="rounded-biko-md border shadow-biko-sm bg-biko-surface-1 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle ID</TableHead>
              <TableHead>Make & Model</TableHead>
              <TableHead>License Plate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Mileage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedVehicles.map((vehicle) => {
              const stateColors = getVehicleStateColors(vehicle.state);
              
              return (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-medium">{vehicle.id}</TableCell>
                  <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                  <TableCell>{vehicle.licensePlate}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={cn(stateColors.bg, stateColors.text, stateColors.border)}
                    >
                      {vehicle.state.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{vehicle.mileage.toLocaleString()} mi</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationControls {...pagination} />
    </div>
  );
}