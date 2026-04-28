import { useEffect, useMemo, useState } from 'react';
import { usePreBatches } from '@/hooks/usePreBatch';
import { useRealtimeScheduler } from '@/hooks/useRealtimeScheduler';
import { useWarehouses } from '@/hooks/useWarehouses';
import { SchedulerLayout } from './components/SchedulerLayout';
import { UnifiedHeader, type StatusFilterExtras, type ViewMode } from './components/UnifiedHeader';
import { SchedulerListView } from './components/SchedulerListView';
import { SchedulePreviewPanel } from './components/SchedulePreviewPanel';
import { SummaryStrip } from './components/SummaryStrip';
import { UnifiedWorkflowDialog } from '@/components/unified-workflow';
import { CalendarView } from './components/CalendarView';
import type { SchedulerFilters, SchedulerBatch, SchedulerBatchStatus } from '@/types/scheduler';
import type { PreBatchWithRelations } from '@/types/unified-workflow';
import { useDrivers } from '@/hooks/useDrivers';
import { useVehicles } from '@/hooks/useVehicles';
import { useFacilities } from '@/hooks/useFacilities.tsx';

/** Map pre-batch records to SchedulerBatch format for the list view */
function mapPreBatchToSchedulerBatch(pb: PreBatchWithRelations): SchedulerBatch {
  // A converted pre-batch with a linked delivery batch is fully published to FleetOps.
  // Without converted_batch_id the delivery batch hasn't been created yet → 'scheduled'.
  const getStatus = (pb: PreBatchWithRelations): SchedulerBatchStatus => {
    if (pb.status === 'converted') {
      return pb.converted_batch_id ? 'published' : 'scheduled';
    }
    const map: Record<string, SchedulerBatchStatus> = {
      draft: 'draft',
      ready: 'ready',
      cancelled: 'cancelled',
    };
    return map[pb.status] || 'draft';
  };

  return {
    id: pb.id,
    name: pb.schedule_title,
    batch_code: pb.id.slice(0, 8).toUpperCase(),
    warehouse_id: pb.start_location_id,
    facility_ids: pb.facility_order || [],
    planned_date: pb.planned_date,
    time_window: pb.time_window ?? null,
    driver_id: null,
    vehicle_id: pb.suggested_vehicle_id,
    optimized_route: null,
    total_distance_km: null,
    estimated_duration_min: null,
    total_consignments: pb.facility_order?.length || 0,
    total_weight_kg: null,
    total_volume_m3: null,
    capacity_utilization_pct: null,
    status: getStatus(pb),
    scheduling_mode: pb.source_sub_option === 'ai_optimization' ? 'ai_optimized' : 'manual',
    priority: 'medium',
    created_by: pb.created_by,
    created_at: pb.created_at,
    updated_at: pb.updated_at,
    scheduled_at: pb.status === 'converted' ? pb.updated_at : null,
    published_at: null,
    published_batch_id: pb.converted_batch_id,
    notes: pb.notes ?? null,
    tags: null,
    zone: null,
  };
}

export default function SchedulerPage() {
  // View state
  const [activeView, setActiveView] = useState<ViewMode>('status');

  // Status view state
  const [statusFilters, setStatusFilters] = useState<SchedulerFilters>({});
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Calendar view state
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week' | 'month'>('week');

  // Common state
  const [wizardOpen, setWizardOpen] = useState(false);

  // Data hooks
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const { data: drivers = [] } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const { data: facilitiesData } = useFacilities();
  const facilities = facilitiesData?.facilities ?? [];

  // Fetch pre-batches (the actual data source from the unified workflow)
  const { data: preBatches = [], isLoading } = usePreBatches();

  // Map pre-batches to SchedulerBatch format and apply status filters
  const batches = useMemo(() => {
    let mapped = preBatches.map(mapPreBatchToSchedulerBatch);

    // Apply status filters
    if (statusFilters.status && statusFilters.status.length > 0) {
      mapped = mapped.filter(b => statusFilters.status!.includes(b.status));
    }
    if (statusFilters.warehouse_id) {
      mapped = mapped.filter(b => b.warehouse_id === statusFilters.warehouse_id);
    }
    if (statusFilters.search) {
      const search = statusFilters.search.toLowerCase();
      mapped = mapped.filter(b =>
        (b.name?.toLowerCase().includes(search)) ||
        b.batch_code.toLowerCase().includes(search)
      );
    }

    return mapped;
  }, [preBatches, statusFilters]);

  const [statusExtras, setStatusExtras] = useState<StatusFilterExtras>({
    assignment: 'any',
    program: 'all',
    zone: 'all',
  });

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      if (statusExtras.assignment === 'assigned' && !batch.driver_id) return false;
      if (statusExtras.assignment === 'unassigned' && batch.driver_id) return false;

      if (statusExtras.zone && statusExtras.zone !== 'all') {
        if (!batch.zone || batch.zone !== statusExtras.zone) {
          return false;
        }
      }

      const payload = batch.total_weight_kg ?? 0;
      if (statusExtras.payloadMin !== undefined && payload < statusExtras.payloadMin) {
        return false;
      }
      if (statusExtras.payloadMax !== undefined && payload > statusExtras.payloadMax) {
        return false;
      }

      if (statusExtras.program !== 'all') {
        const programs = batch.tags || [];
        if (!programs.includes(statusExtras.program)) {
          return false;
        }
      }

      return true;
    });
  }, [batches, statusExtras]);

  useEffect(() => {
    if (selectedBatchId && !filteredBatches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(null);
    }
  }, [filteredBatches, selectedBatchId]);

  const availablePrograms = useMemo(() => {
    const programSet = new Set<string>();
    batches.forEach((batch) => {
      batch.tags?.forEach((tag) => {
        if (tag) {
          programSet.add(tag);
        }
      });
    });
    return Array.from(programSet).sort();
  }, [batches]);

  const availableZones = useMemo(() => {
    const zoneSet = new Set<string>();
    batches.forEach((batch) => {
      if (batch.zone) {
        zoneSet.add(batch.zone);
      }
    });
    return Array.from(zoneSet).sort();
  }, [batches]);

  // Subscribe to real-time updates
  useRealtimeScheduler({
    showToasts: true,
  });

  const handleScheduleClick = (schedule: any) => {
    setSelectedBatchId(schedule.id);
  };

  const header = (
    <UnifiedHeader
      activeView={activeView}
      onViewChange={setActiveView}
      statusFilters={statusFilters}
      onStatusFiltersChange={setStatusFilters}
      statusExtras={statusExtras}
      onStatusExtrasChange={setStatusExtras}
      selectedWarehouse={selectedWarehouse}
      onWarehouseChange={setSelectedWarehouse}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      calendarViewMode={calendarViewMode}
      onCalendarViewModeChange={setCalendarViewMode}
      warehouses={Array.isArray(warehouses) ? warehouses.map((w) => ({ id: w.id, name: w.name })) : []}
      availablePrograms={availablePrograms}
      availableZones={availableZones}
      onNewSchedule={() => setWizardOpen(true)}
    />
  );

  const content = activeView === 'status' ? (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0">
        <SchedulerListView
          batches={filteredBatches}
          isLoading={isLoading}
          selectedBatchId={selectedBatchId}
          onBatchSelect={setSelectedBatchId}
          warehouses={warehouses}
          drivers={drivers}
          vehicles={vehicles}
          facilities={facilities}
        />
      </div>
      {selectedBatchId && (
        <SchedulePreviewPanel
          batchId={selectedBatchId}
          batch={filteredBatches.find(b => b.id === selectedBatchId)}
          onClose={() => setSelectedBatchId(null)}
          facilities={facilities}
          warehouses={warehouses}
          vehicles={vehicles}
        />
      )}
    </div>
  ) : (
    <CalendarView
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      viewMode={calendarViewMode}
      onViewModeChange={setCalendarViewMode}
      schedules={batches}
      onScheduleClick={handleScheduleClick}
    />
  );

  const summary = activeView === 'status' ? (
    <SummaryStrip batches={filteredBatches} />
  ) : (
    <div className="px-6 py-4 text-sm text-muted-foreground">Summary unavailable in calendar view.</div>
  );

  return (
    <SchedulerLayout header={header} content={content} summary={summary}>
      <UnifiedWorkflowDialog open={wizardOpen} onOpenChange={setWizardOpen} startStep={1} />
    </SchedulerLayout>
  );
}
