/**
 * Vehicles Page - Multi-View with Collapsible Sidebar
 * Redesigned with RouteServe branding and improved spacing
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVehicles, useDeleteVehicle } from '@/hooks/vlms/useVehicles';
import { useVehiclesStore } from '@/stores/vlms/vehiclesStore';
import { VehicleConfiguratorDialog } from '@/components/vlms/vehicles/VehicleConfiguratorDialog';
import { VehicleFilters } from '@/components/vlms/vehicles/VehicleFilters';
import { VehicleViewToggle } from '@/components/vlms/vehicles/VehicleViewToggle';
import { VehicleGridView } from '@/components/vlms/vehicles/VehicleGridView';
import { VehicleListView } from '@/components/vlms/vehicles/VehicleListView';
import { VehicleKanbanView } from '@/components/vlms/vehicles/VehicleKanbanView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, ChevronRight, Package } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { getStatusColors } from '@/lib/designTokens';
import { PaginationControls, usePagination } from '@/components/ui/pagination-controls';
import { EmptyState } from '@/components/ui/empty-state';
import type { Database } from '@/integrations/supabase/types';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export default function VehiclesPage() {
  const navigate = useNavigate();
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Store state
  const filters = useVehiclesStore((state) => state.filters);
  const setFilters = useVehiclesStore((state) => state.setFilters);
  const clearFilters = useVehiclesStore((state) => state.clearFilters);
  const viewMode = useVehiclesStore((state) => state.viewMode);
  const setViewMode = useVehiclesStore((state) => state.setViewMode);
  const sidebarCollapsed = useVehiclesStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useVehiclesStore((state) => state.toggleSidebar);

  const { data: vehicles, isLoading } = useVehicles(filters);
  const deleteVehicle = useDeleteVehicle();

  // Handlers
  const handleView = (vehicle: Vehicle) => {
    navigate(`/fleetops/vlms/vehicles/${vehicle.id}`);
  };

  const handleEdit = (vehicle: Vehicle) => {
    navigate(`/fleetops/vlms/vehicles/${vehicle.id}/edit`);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (confirm(`Are you sure you want to delete vehicle ${vehicle.vehicle_id}?`)) {
      await deleteVehicle.mutateAsync(vehicle.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = getStatusColors(
      status as 'available' | 'in_use' | 'maintenance' | 'out_of_service'
    );

    const labels: Record<string, string> = {
      available: 'Available',
      in_use: 'In Use',
      maintenance: 'Maintenance',
      out_of_service: 'Out of Service',
      disposed: 'Disposed',
    };

    return (
      <Badge
        className={cn(
          'text-xs',
          statusColors.bg,
          statusColors.text,
          statusColors.border,
          'border'
        )}
      >
        {labels[status] || status}
      </Badge>
    );
  };

  // Filter vehicles by search query client-side
  const filteredVehicles = vehicles?.filter((vehicle) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      vehicle.make?.toLowerCase().includes(query) ||
      vehicle.model?.toLowerCase().includes(query) ||
      vehicle.license_plate?.toLowerCase().includes(query) ||
      vehicle.vehicle_id?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const PAGE_SIZE = 50;
  const pagination = usePagination({
    pageSize: PAGE_SIZE,
    totalItems: filteredVehicles?.length || 0,
  });

  // Paginated vehicles
  const paginatedVehicles = filteredVehicles?.slice(
    pagination.startIndex,
    pagination.endIndex
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card px-6 py-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Vehicle Management
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Manage your fleet vehicles
            </p>
          </div>
          <div className="flex items-center gap-3">
            <VehicleViewToggle value={viewMode} onValueChange={setViewMode} />
            <Button onClick={() => setIsConfiguratorOpen(true)}>
              <Plus data-icon="inline-start" />
              Add Vehicle
            </Button>
          </div>
        </div>
      </div>

      {/* Vehicle Configurator Dialog */}
      <VehicleConfiguratorDialog
        open={isConfiguratorOpen}
        onOpenChange={setIsConfiguratorOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Filter Sidebar - Collapsible */}
        <aside
          className={cn(
            'border-r border-border bg-card transition-all duration-300 flex-shrink-0 overflow-y-auto',
            sidebarCollapsed ? 'w-0 border-r-0' : 'w-80'
          )}
        >
          {!sidebarCollapsed && (
            <div className="h-full p-4">
              <VehicleFilters
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={clearFilters}
                onCollapse={toggleSidebar}
              />
            </div>
          )}
        </aside>

        {/* Expand Sidebar Button - Shows when collapsed */}
        {sidebarCollapsed && (
          <div className="flex-shrink-0 border-r border-border bg-card">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="m-2"
              aria-label="Expand sidebar"
            >
              <ChevronRight />
            </Button>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search Bar */}
          <div className="border-b border-border bg-card px-6 py-3 flex-shrink-0">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Quick search vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-10"
              />
            </div>
          </div>

          {/* Content - List/Card/Table Views */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <LoadingSpinner size="lg" text="Loading vehicles..." />
              </div>
            ) : filteredVehicles && filteredVehicles.length > 0 ? (
              <div className="flex flex-col gap-6 h-full">
                <div className="flex-1">
                  {/* List View */}
                  {viewMode === 'list' && (
                    <VehicleListView
                      vehicles={paginatedVehicles || []}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )}

                  {/* Card/Grid View */}
                  {viewMode === 'card' && (
                    <VehicleGridView
                      vehicles={paginatedVehicles || []}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )}

                  {/* Kanban View - Status Board */}
                  {viewMode === 'kanban' && (
                    <VehicleKanbanView
                      vehicles={paginatedVehicles || []}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <PaginationControls
                    {...pagination}
                    isLoading={isLoading}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={Package}
                  title="No vehicles found"
                  description={
                    searchQuery
                      ? 'No vehicles match your current search or filters. Try adjusting your criteria.'
                      : 'Get started by adding your first vehicle to the fleet.'
                  }
                  action={
                    <Button onClick={() => setIsConfiguratorOpen(true)}>
                      <Plus data-icon="inline-start" />
                      Add Vehicle
                    </Button>
                  }
                  variant="dashed"
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
