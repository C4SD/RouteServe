/**
 * Map Intelligence Page — /intelligence
 *
 * Unified map platform combining real-time tracking, historical
 * playback and planning analytics on a single MapLibre map.
 *
 * Tab is driven by the `?tab=` query param so deep-links work and
 * the secondary sidebar links stay in sync.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { usePlaybackStore } from '@/stores/playbackStore';
import { LiveTrackingProvider, useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import { IntelligenceSidebar, type IntelligenceTab } from '@/pages/map/intelligence/components/IntelligenceSidebar';
import { IntelligenceMapView, type IntelligenceMode } from '@/pages/map/intelligence/components/IntelligenceMapView';
import { useIntelligencePlanningData } from '@/pages/map/intelligence/hooks/useIntelligencePlanningData';
import { EntityDetailPanel } from '@/pages/map/components/EntityDetailPanel';
import { PlaybackMap } from '@/pages/map/playback/components/PlaybackMap';
import { PlaybackDock } from '@/pages/map/playback/components/PlaybackDock';
import type { EntityType } from '@/types/live-map';

function IntelligencePageInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get('tab') as IntelligenceTab) || 'track';
  const activeTab = ['track', 'playback', 'analytics'].includes(tabParam) ? tabParam : 'track';

  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Planning layer toggles (shared across Track and Analytics modes)
  const [layerToggles, setLayerToggles] = useState({
    showZonePolygons: true,
    showRouteGeometry: true,
    showServiceAreas: true,
  });

  // Playback tab state
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  const selectBatch = usePlaybackStore((s) => s.selectBatch);
  const resetPlayback = usePlaybackStore((s) => s.reset);

  const selectedEntity = useLiveMapStore((s) => s.selectedEntity);
  const clearSelection = useLiveMapStore((s) => s.clearSelection);

  const { getDriver, getVehicle, getDelivery, getFacility } = useLiveTrackingCtx();

  const {
    zonePolygons,
    routeGeometries,
    serviceAreaHulls,
    stats: planningStats,
  } = useIntelligencePlanningData();

  const handleTabChange = useCallback((tab: IntelligenceTab) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  const handleEntitySelect = useCallback((_id: string, _type: EntityType) => {
    setDetailPanelOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailPanelOpen(false);
    clearSelection();
  }, [clearSelection]);

  const selectedEntityData = selectedEntity
    ? selectedEntity.type === 'driver' ? getDriver(selectedEntity.id)
      : selectedEntity.type === 'vehicle' ? getVehicle(selectedEntity.id)
        : selectedEntity.type === 'facility' ? getFacility(selectedEntity.id)
          : getDelivery(selectedEntity.id)
    : null;

  const handleSelectBatch = useCallback((id: string) => {
    setSelectedBatchId(id);
    selectBatch(id);
    setFilterDate(null);
  }, [selectBatch]);

  const handleDateFilter = useCallback((date: Date | null) => {
    setFilterDate(date);
    if (date && selectedBatchId) { setSelectedBatchId(null); selectBatch(null); }
  }, [selectedBatchId, selectBatch]);

  const handleLayerToggle = useCallback((key: keyof typeof layerToggles) => {
    setLayerToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => { return () => { resetPlayback(); }; }, [resetPlayback]);

  const mapMode: IntelligenceMode = activeTab === 'analytics' ? 'analytics' : 'track';

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Left panel — tabs: Track / Playback / Analytics */}
      <IntelligenceSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        planningStats={planningStats}
        layerToggles={layerToggles}
        onLayerToggle={handleLayerToggle}
        selectedBatchId={selectedBatchId}
        onSelectBatch={handleSelectBatch}
        filterDate={filterDate}
        onDateFilter={handleDateFilter}
      />

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">

        {/* Track / Analytics map — always mounted, hidden only when Playback active */}
        <div
          className={activeTab === 'playback' ? 'absolute inset-0 invisible pointer-events-none' : 'absolute inset-0'}
          aria-hidden={activeTab === 'playback'}
        >
          <IntelligenceMapView
            mode={mapMode}
            onEntitySelect={handleEntitySelect}
            zonePolygons={zonePolygons}
            routeGeometries={routeGeometries}
            serviceAreaHulls={serviceAreaHulls}
            showZonePolygons={layerToggles.showZonePolygons}
            showRouteGeometry={layerToggles.showRouteGeometry}
            showServiceAreas={layerToggles.showServiceAreas}
          />
        </div>

        {/* Playback — mounts its own MapLibre instance */}
        {activeTab === 'playback' && (
          <div className="absolute inset-0 flex flex-col bg-background">
            <div className="flex-1 relative">
              <PlaybackMap className="absolute inset-0" hasTrip={!!selectedBatchId} />
            </div>
            <PlaybackDock />
          </div>
        )}
      </div>

      {/* Entity detail panel */}
      {detailPanelOpen && selectedEntity && activeTab !== 'playback' && (
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

export default function IntelligencePage() {
  return (
    <LiveTrackingProvider>
      <IntelligencePageInner />
    </LiveTrackingProvider>
  );
}
