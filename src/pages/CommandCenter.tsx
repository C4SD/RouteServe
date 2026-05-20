import { useState, useMemo, lazy, Suspense } from 'react';
import { Facility, Warehouse, DeliveryBatch } from '@/types';
import KPIMetrics from '@/components/dashboard/KPIMetrics';
import FleetStatus from '@/components/dashboard/FleetStatus';
import ActiveDeliveriesPanel from '@/components/delivery/ActiveDeliveriesPanel';

const DashboardMapLibre = lazy(() =>
  import('@/components/map/DashboardMapLibre').then(m => ({ default: m.DashboardMapLibre }))
);
import ActivityTimeline from '@/components/dashboard/ActivityTimeline';
import BatchDetailsPanel from '@/components/delivery/BatchDetailsPanel';
import { RefreshCw, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useRealtimeBatches } from '@/hooks/useRealtimeBatches';
import { useRealtimeDrivers } from '@/hooks/useRealtimeDrivers';
import { useRealtimeRouteProgress } from '@/hooks/useRealtimeRouteProgress';
import { useNavigate } from 'react-router-dom';
import { UnifiedWorkflowDialog } from '@/components/unified-workflow';

interface CommandCenterProps {
  facilities: Facility[];
  warehouses: Warehouse[];
  batches: DeliveryBatch[];
}

const CommandCenter = ({ facilities, warehouses, batches }: CommandCenterProps) => {
  const navigate = useNavigate();
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'assigned' | 'in-progress' | 'completed' | 'delayed'>('all');
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null
  });
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);

  // Enable real-time updates
  useRealtimeBatches();
  useRealtimeDrivers();
  useRealtimeRouteProgress();

  const selectedBatch = useMemo(() => 
    batches.find(b => b.id === selectedBatchId),
    [batches, selectedBatchId]
  );

  const handleRefresh = () => {
    setLastRefresh(new Date());
    toast.success('Data refreshed', {
      description: `Updated at ${new Date().toLocaleTimeString()}`
    });
  };

  const handleBatchClick = (batchId: string) => {
    if (selectedBatchId === batchId) {
      setSelectedBatchId(null);
    } else {
      setSelectedBatchId(batchId);
      const batch = batches.find(b => b.id === batchId);
      if (batch) {
        toast.info(`Viewing ${batch.name}`, {
          description: `${batch.facilities.length} stops • ${batch.totalDistance}km`
        });
      }
    }
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-[2000px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Command Center</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Real-time operations dashboard • Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common operations and workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={() => setWorkflowDialogOpen(true)}
                variant="default"
                className="h-auto py-4 flex flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="font-semibold">Create Batch</span>
                </div>
                <span className="text-xs font-normal text-muted-foreground">
                  Start unified dispatch workflow
                </span>
              </Button>
              <Button
                onClick={() => navigate('/fleetops/drivers')}
                variant="outline"
                className="h-auto py-4 flex flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold">View Drivers</span>
                </div>
                <span className="text-xs font-normal text-muted-foreground">
                  Driver management & onboarding
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI Metrics & Fleet Status */}
        <div className="space-y-4">
          <KPIMetrics startDate={dateRange.start} endDate={dateRange.end} />
          <FleetStatus batches={batches} />
        </div>

        {/* Main Content: 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT: Active Deliveries List */}
          <div className="lg:col-span-1">
            <ActiveDeliveriesPanel 
              batches={batches}
              selectedBatchId={selectedBatchId}
              statusFilter={statusFilter}
              onBatchClick={handleBatchClick}
              onFilterChange={setStatusFilter}
            />
          </div>

          {/* RIGHT: Map + Details */}
          <div className="lg:col-span-2 space-y-4">
            <Suspense fallback={<div className="rounded-lg border border-border h-[500px] bg-muted animate-pulse" />}>
              <DashboardMapLibre
                facilities={facilities}
                warehouses={warehouses}
                batches={batches}
                selectedBatchId={selectedBatchId}
                onBatchClick={handleBatchClick}
                className="rounded-lg overflow-hidden shadow-sm border border-border h-[500px]"
              />
            </Suspense>

            {/* Batch Details Panel */}
            {selectedBatch && (
              <BatchDetailsPanel 
                batch={selectedBatch}
                onClose={() => setSelectedBatchId(null)}
              />
            )}

            {!selectedBatch && (
              <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                <p className="text-sm">Select a delivery from the list to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Activity Timeline */}
        <ActivityTimeline batches={batches} />
      </div>

      {/* Unified Workflow Dialog */}
      <UnifiedWorkflowDialog
        open={workflowDialogOpen}
        onOpenChange={setWorkflowDialogOpen}
        startStep={1}
      />
    </div>
  );
};

export default CommandCenter;
