/**
 * Map Intelligence Page
 *
 * Unified map experience combining:
 *   - Track tab:     real-time vehicle/driver/delivery tracking
 *   - Playback tab:  historical trip replay with event analytics
 *   - Analytics tab: planning layers (zone boundaries, route geometries, service areas)
 *
 * Uses MapLibre (maps-v3) throughout — same engine as map/live, enriched with
 * all sandbox-map planning features.
 */

import { useState, useCallback, useEffect } from 'react';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useLiveMapStore } from '@/stores/liveMapStore';
import { LiveTrackingProvider, useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import { IntelligenceSidebar, type IntelligenceTab } from './components/IntelligenceSidebar';
import { IntelligenceMapView, type IntelligenceMode } from './components/IntelligenceMapView';
import { useIntelligencePlanningData } from './hooks/useIntelligencePlanningData';
import { useGeospatialZoning } from './hooks/useGeospatialZoning';
import { EntityDetailPanel } from '../components/EntityDetailPanel';
import { PlaybackMap } from '../playback/components/PlaybackMap';
import { PlaybackDock } from '../playback/components/PlaybackDock';
import type { EntityType } from '@/types/live-map';

function MapIntelligencePageInner() {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>('track');
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Planning layer toggles (Analytics tab)
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

  // Planning data for Analytics tab and map layers
  const {
    zonePolygons,
    routeGeometries,
    serviceAreaHulls,
    stats: planningStats,
  } = useIntelligencePlanningData();

  // Geospatial zoning
  const zoning = useGeospatialZoning();

  const handleEntitySelect = useCallback((_entityId: string, _entityType: EntityType) => {
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
    if (date && selectedBatchId) {
      setSelectedBatchId(null);
      selectBatch(null);
    }
  }, [selectedBatchId, selectBatch]);

  const handleLayerToggle = useCallback((key: keyof typeof layerToggles) => {
    setLayerToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Cleanup playback on unmount
  useEffect(() => {
    return () => { resetPlayback(); };
  }, [resetPlayback]);

  // Initialize zoning when tab becomes active
  useEffect(() => {
    if (activeTab === 'zoning') {
      zoning.initialize('ng');
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive IntelligenceMapView mode from active tab
  const mapMode: IntelligenceMode =
    activeTab === 'analytics' ? 'analytics'
    : activeTab === 'zoning' ? 'zoning'
    : 'track';

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Left sidebar with tab selector */}
      <IntelligenceSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        planningStats={planningStats}
        layerToggles={layerToggles}
        onLayerToggle={handleLayerToggle}
        selectedBatchId={selectedBatchId}
        onSelectBatch={handleSelectBatch}
        filterDate={filterDate}
        onDateFilter={handleDateFilter}
        zoning={zoning}
      />

      {/* Main map area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">

        {/* ── Track / Analytics map (always mounted, hidden during Playback) ── */}
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
            zoningProps={{
              stateFeatures: zoning.stateFeatures,
              lgaFeatures: zoning.lgaFeatures,
              selectedLgaIds: zoning.selectedLgaIds,
              assignedMap: zoning.assignedMap,
              zones: zoning.zones,
              editMode: zoning.editMode,
              editingZoneId: zoning.editingZoneId,
              onToggleLga: zoning.toggleLga,
              onToggleState: zoning.toggleState,
            }}
          />
        </div>

        {/* ── Playback map (mounted when Playback tab active) ── */}
        {activeTab === 'playback' && (
          <div className="absolute inset-0 flex flex-col bg-background">
            {/* Playback map fills remaining space */}
            <div className="flex-1 relative">
              <PlaybackMap
                className="absolute inset-0"
                hasTrip={!!selectedBatchId}
              />
            </div>

            {/* Playback timeline dock */}
            <PlaybackDock />
          </div>
        )}
      </div>

      {/* Entity detail panel (slides in from right, Track/Analytics only) */}
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

export default function MapIntelligencePage() {
  return (
    <LiveTrackingProvider>
      <MapIntelligencePageInner />
    </LiveTrackingProvider>
  );
}
