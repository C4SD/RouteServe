import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Truck, MapPin, Clock, Package } from 'lucide-react';
import { DeliveryBatch } from '@/types';
import { useDrivers } from '@/hooks/useDrivers';
import { useVehicles } from '@/hooks/useVehicles';
import { Skeleton } from '@/components/ui/skeleton';

interface ActiveDeliveriesPanelProps {
  batches: DeliveryBatch[];
  selectedBatchId: string | null;
  statusFilter: 'all' | 'planned' | 'assigned' | 'in-progress' | 'completed' | 'delayed';
  onBatchClick?: (batchId: string) => void;
  onFilterChange?: (filter: 'all' | 'planned' | 'assigned' | 'in-progress' | 'completed' | 'delayed') => void;
}

const ActiveDeliveriesPanel = ({
  batches,
  selectedBatchId,
  statusFilter,
  onBatchClick,
  onFilterChange
}: ActiveDeliveriesPanelProps) => {
  const { data: drivers = [], isLoading: driversLoading } = useDrivers();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  // Filter batches based on status filter — "all" includes every status
  const filteredBatches = batches.filter(batch => {
    if (statusFilter === 'all') return true;
    return batch.status === statusFilter;
  });

  // Count batches by status for tabs
  const statusCounts = {
    all: batches.length,
    planned: batches.filter(b => b.status === 'planned').length,
    assigned: batches.filter(b => b.status === 'assigned').length,
    'in-progress': batches.filter(b => b.status === 'in-progress').length,
    completed: batches.filter(b => b.status === 'completed').length,
    delayed: 0,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive';
      case 'high': return 'bg-warning';
      case 'medium': return 'bg-warning/70';
      default: return 'bg-primary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-progress': return 'bg-success';
      case 'assigned': return 'bg-primary';
      case 'planned': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in-progress': return '🚛 In Progress';
      case 'assigned': return '📋 Assigned';
      case 'planned': return '📝 Planned';
      case 'completed': return '✓ Completed';
      default: return status;
    }
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'Unassigned';
    if (driversLoading) return 'Loading...';
    return drivers.find(d => d.id === driverId)?.name || 'Unknown';
  };

  const getVehicleName = (vehicleId?: string) => {
    if (!vehicleId) return 'N/A';
    if (vehiclesLoading) return 'Loading...';
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.model} (${vehicle.plateNumber})` : 'N/A';
  };

  // Calculate progress based on time (simplified - in real app would track actual stops)
  const getProgress = (batch: DeliveryBatch) => {
    if (batch.status === 'assigned') return 0;
    if (batch.status === 'completed') return 100;
    // Simulate progress based on facilities count
    return Math.min(100, (batch.facilities.length / 5) * 100);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5" />
          Deliveries
        </CardTitle>
        
        {/* Status Filter Tabs */}
        <div className="flex gap-1 flex-wrap">
          {(['all', 'planned', 'assigned', 'in-progress', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => onFilterChange?.(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {status === 'all' ? 'All' :
               status === 'in-progress' ? 'In Progress' :
               status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1.5 opacity-70">({statusCounts[status]})</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 p-6 pt-0">
            {driversLoading || vehiclesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No deliveries found</p>
              </div>
            ) : (
              filteredBatches.map((batch) => {
                const progress = getProgress(batch);
                const completedStops = Math.floor((progress / 100) * batch.facilities.length);
                const isSelected = selectedBatchId === batch.id;
                
                return (
                  <Card 
                    key={batch.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'border-2 border-primary shadow-lg scale-[1.02]' 
                        : 'border hover:border-muted-foreground/50 hover:shadow-md'
                    }`}
                    onClick={() => onBatchClick?.(batch.id)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold mb-1">{batch.name}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={getStatusColor(batch.status)}>
                                {getStatusLabel(batch.status)}
                              </Badge>
                              <Badge variant="outline" className={getPriorityColor(batch.priority)}>
                                {batch.priority}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Driver & Vehicle */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Truck className="h-3 w-3" />
                            <span className="truncate">{getDriverName(batch.driverId)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{batch.facilities.length} stops</span>
                          </div>
                        </div>

                        {/* Enhanced Progress Display */}
                        <div className="bg-muted/50 rounded-lg p-3 border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-sm font-bold ${
                                  progress >= 70 ? 'bg-success/10 text-success border-success/20' :
                                  progress >= 30 ? 'bg-warning/10 text-warning border-warning/20' :
                                  'bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                Stop {completedStops}/{batch.facilities.length}
                              </Badge>
                              <div className="flex gap-0.5">
                                {Array.from({ length: batch.facilities.length }).map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full ${
                                      idx < completedStops ? 'bg-primary' : 'bg-muted-foreground/30'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          {batch.status === 'in-progress' && completedStops < batch.facilities.length && (
                            <div className="text-xs text-muted-foreground">
                              <div className="flex items-center gap-1 mb-1">
                                <MapPin className="h-3 w-3" />
                                <span className="font-medium">Current: {batch.facilities[completedStops]?.name || 'Unknown'}</span>
                              </div>
                              {completedStops + 1 < batch.facilities.length && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>Next: {batch.facilities[completedStops + 1]?.name} • ETA 15 min</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {batch.status === 'planned' && (
                            <div className="text-xs text-muted-foreground">
                              Scheduled — not yet assigned
                            </div>
                          )}
                          {batch.status === 'assigned' && (
                            <div className="text-xs text-muted-foreground">
                              Ready to depart from {batch.warehouseName}
                            </div>
                          )}
                          
                          {batch.status === 'completed' && (
                            <div className="text-xs text-success font-medium">
                              ✓ All stops completed
                            </div>
                          )}
                        </div>

                        {/* Programs */}
                        {batch.programs && batch.programs.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {batch.programs.slice(0, 2).map((p) => (
                              <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
                                {p}
                              </Badge>
                            ))}
                            {batch.programs.length > 2 && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{batch.programs.length - 2} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {batch.totalDistance}km
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.round(batch.estimatedDuration)}min
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {batch.medicationType}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ActiveDeliveriesPanel;
