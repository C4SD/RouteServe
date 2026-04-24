/**
 * Live Map Page - Real-time tracking for drivers, vehicles, and deliveries
 */

import { useState, useCallback } from 'react';
import { LiveMapView } from '../components/LiveMapView';
import { LiveFilterPanel } from '../components/LiveFilterPanel';
import { EntityDetailPanel } from '../components/EntityDetailPanel';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { LiveTrackingProvider, useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import type { EntityType } from '@/types/live-map';

function LiveMapPageInner() {
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const selectedEntity = useLiveMapStore((s) => s.selectedEntity);
  const clearSelection = useLiveMapStore((s) => s.clearSelection);

  const { getDriver, getVehicle, getDelivery, getFacility } = useLiveTrackingCtx();

  // Handle entity selection from map
  const handleEntitySelect = useCallback(
    (entityId: string, entityType: EntityType) => {
      setDetailPanelOpen(true);
    },
    []
  );

  // Close detail panel
  const handleCloseDetail = useCallback(() => {
    setDetailPanelOpen(false);
    clearSelection();
  }, [clearSelection]);

  // Get selected entity data (facility/warehouse fetch their own rich data inside the panel)
  const selectedEntityData = selectedEntity
    ? selectedEntity.type === 'driver'
      ? getDriver(selectedEntity.id)
      : selectedEntity.type === 'vehicle'
        ? getVehicle(selectedEntity.id)
        : selectedEntity.type === 'delivery'
          ? getDelivery(selectedEntity.id)
          : null // facility/warehouse self-fetch
    : null;

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Filter sidebar */}
      <LiveFilterPanel />

      {/* Map container */}
      <div className="flex-1 relative overflow-hidden">
        <LiveMapView onEntitySelect={handleEntitySelect} />
      </div>

      {/* Detail panel (slides in from right) */}
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
