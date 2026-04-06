import { MoreHorizontal, Edit, Trash, Eye, MapPin, Phone, Zap, ZapOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Warehouse } from '@/types/warehouse';
import { useDeleteWarehouse } from '@/hooks/useWarehouses';

interface WarehouseTableProps {
  warehouses: Warehouse[];
  allWarehouses?: Warehouse[];
  isLoading: boolean;
  onWarehouseClick: (warehouse: Warehouse) => void;
  onEdit: (warehouse: Warehouse) => void;
  selectedWarehouseId?: string;
  page: number;
  totalPages: number;
  totalWarehouses: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export function WarehouseTable({
  warehouses,
  allWarehouses,
  isLoading,
  onWarehouseClick,
  onEdit,
  selectedWarehouseId,
  page,
  totalPages,
  totalWarehouses,
  onPageChange,
  pageSize = 50,
}: WarehouseTableProps) {
  const deleteWarehouse = useDeleteWarehouse();

  const handleDelete = (warehouse: Warehouse) => {
    if (confirm(`Are you sure you want to delete "${warehouse.name}"?`)) {
      deleteWarehouse.mutate(warehouse.id);
    }
  };

  const getUtilization = (warehouse: Warehouse) => {
    if (!warehouse.total_capacity_m3 || warehouse.total_capacity_m3 === 0) return 0;
    return ((warehouse.used_capacity_m3 || 0) / warehouse.total_capacity_m3) * 100;
  };

  const getParentName = (warehouse: Warehouse): string | null => {
    if (!warehouse.parent_id) return null;
    const parent = (allWarehouses || warehouses).find(w => w.id === warehouse.parent_id);
    return parent?.name || null;
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>No warehouses found</p>
        <p className="text-sm">Add a new warehouse to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="inline-block min-w-full align-middle">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 border-b">
              <TableRow>
                <TableHead className="min-w-[200px]">Warehouse</TableHead>
                <TableHead className="min-w-[100px]">Code</TableHead>
                <TableHead className="min-w-[120px]">Parent</TableHead>
                <TableHead className="min-w-[120px]">Location</TableHead>
                <TableHead className="min-w-[140px]">Contact</TableHead>
                <TableHead className="text-right min-w-[110px]">Capacity</TableHead>
                <TableHead className="min-w-[180px]">Utilization</TableHead>
                <TableHead className="min-w-[100px]">Storage</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {warehouses.map((warehouse) => {
              const utilization = getUtilization(warehouse);
              const parentName = getParentName(warehouse);

              return (
                <TableRow
                  key={warehouse.id}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    selectedWarehouseId === warehouse.id && 'bg-blue-50'
                  )}
                  onClick={() => onWarehouseClick(warehouse)}
                >
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium">{warehouse.name}</p>
                        {warehouse.parent_id && (
                          <Badge variant="outline" className="text-[10px] px-1.5 bg-purple-50 text-purple-700 border-purple-200">
                            Store
                          </Badge>
                        )}
                      </div>
                      {warehouse.address && (
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {warehouse.address}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {warehouse.code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {parentName ? (
                      <span className="text-sm text-muted-foreground">{parentName}</span>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Root</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{warehouse.city || warehouse.state || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {warehouse.contact_name ? (
                      <div className="space-y-1">
                        <p className="text-sm">{warehouse.contact_name}</p>
                        {warehouse.contact_phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{warehouse.contact_phone}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {warehouse.total_capacity_m3 ? (
                      <span className="font-mono">
                        {warehouse.total_capacity_m3.toLocaleString()} m³
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {warehouse.total_capacity_m3 ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>{utilization.toFixed(1)}%</span>
                          <span className="text-muted-foreground">
                            {(warehouse.used_capacity_m3 || 0).toLocaleString()} / {warehouse.total_capacity_m3.toLocaleString()}
                          </span>
                        </div>
                        <Progress
                          value={utilization}
                          className={cn(
                            'h-2',
                            utilization > 90 && '[&>div]:bg-red-500',
                            utilization > 70 && utilization <= 90 && '[&>div]:bg-yellow-500'
                          )}
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {warehouse.storage_mode === 'active' ? (
                      <Badge className="bg-green-100 text-green-800 gap-1">
                        <Zap className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <ZapOff className="h-3 w-3" />
                        Passive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onWarehouseClick(warehouse);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onEdit(warehouse);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(warehouse);
                          }}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex-shrink-0 border-t p-4 flex items-center justify-between bg-background">
        <p className="text-sm text-muted-foreground">
          Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalWarehouses)} of {totalWarehouses} warehouses
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
