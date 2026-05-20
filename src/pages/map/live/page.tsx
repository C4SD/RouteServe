/**
 * Live Map Page - Real-time tracking for drivers, vehicles, and deliveries
 */

import { useState, useCallback } from 'react';
import { LiveMapView } from '../components/LiveMapView';
import { LiveFilterPanel } from '../components/LiveFilterPanel';
import { EntityDetailPanel } from '../components/EntityDetailPanel';
import { TripDetailPanel } from '../components/TripDetailPanel';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { LiveTrackingProvider, useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import type { EntityType } from '@/types/live-map';

function LiveMapPageInner() {
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [tripPanel, setTripPanel] = useState<{ batchId: string | null; label?: string } | null>(null);
  const selectedEntity = useLiveMapStore((s) => s.selectedEntity);
  const clearSelection = useLiveMapStore((s) => s.clearSelection);

  const { getDriver, getVehicle, getDelivery } = useLiveTrackingCtx();

  const handleEntitySelect = useCallback(
    (_entityId: string, _entityType: EntityType) => {
      setDetailPanelOpen(true);
    },
    []
  );

  const handleCloseDetail = useCallback(() => {
    setDetailPanelOpen(false);
    clearSelection();
  }, [clearSelection]);

  const handleTripSelect = useCallback((batchId: string | null, label?: string) => {
    // label undefined = explicit close; label present = open (batchId may be null for unassigned vehicles)
    if (label === undefined) {
      setTripPanel(null);
    } else {
      setTripPanel({ batchId, label });
    }
  }, []);

  const selectedEntityData = selectedEntity
    ? selectedEntity.type === 'driver'
      ? getDriver(selectedEntity.id)
      : selectedEntity.type === 'vehicle'
        ? getVehicle(selectedEntity.id)
        : selectedEntity.type === 'delivery'
          ? getDelivery(selectedEntity.id)
          : null
    : null;

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Filter sidebar */}
      <LiveFilterPanel onTripSelect={handleTripSelect} />

      {/* Trip detail panel — slides in between filter and map */}
      {tripPanel && (
        <TripDetailPanel
          batchId={tripPanel.batchId}
          vehicleLabel={tripPanel.label}
          onClose={() => setTripPanel(null)}
        />
      )}

      {/* Map container */}
      <div className="flex-1 relative overflow-hidden">
        <LiveMapView onEntitySelect={handleEntitySelect} />
      </div>

      {/* Entity detail panel (slides in from right) */}
      {detailPanelOpen && selectedEntity && (
        <EntityDetailPanel
          entityId={selectedEntity.id}
          entityType={selectedEntity.type}
          entityData={selectedEntityData}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}

export default function LiveMapPage() {
  return (
    <LiveTrackingProvider>
      <LiveMapPageInner />
    </LiveTrackingProvider>
  );
}
