import { useState, useRef, useCallback } from 'react';
import { useDrivers } from '@/hooks/useDrivers';
import { useServiceZones } from '@/hooks/useServiceZones';
import { useFacilities } from '@/hooks/useFacilities';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useVehicles } from '@/hooks/useVehicles';
import { useDeliveryBatches } from '@/hooks/useDeliveryBatches';
import { useBatchRouteGeometries } from '@/hooks/useBatchRouteGeometries';
import { useRealtimeDrivers } from '@/hooks/useRealtimeDrivers';
import { useRealtimeZones } from '@/hooks/useRealtimeZones';
import { useRealtimeVehicles } from '@/hooks/useRealtimeVehicles';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { useMapLayers } from '@/hooks/useMapLayers';
import { UnifiedMapContainer } from '@/components/map/UnifiedMapContainer';
import { MapInstanceCapture } from '@/components/map/MapInstanceCapture';
import { OperationalContextBar } from '@/components/map/ui/OperationalContextBar';
import { FilterBar } from '@/components/map/ui/FilterBar';
import { KPIRibbon } from '@/components/map/ui/KPIRibbon';
import { MapToolbarClusters } from '@/components/map/ui/MapToolbarClusters';
import { PlaybackBar } from '@/components/map/ui/PlaybackBar';
import { AnalyticsDrawer } from '@/components/map/ui/AnalyticsDrawer';
import { DriverDrawer } from '@/components/map/drawers/DriverDrawer';
import { VehicleDrawer } from '@/components/map/drawers/VehicleDrawer';
import { BatchDrawer } from '@/components/map/drawers/BatchDrawer';
import { ServiceAreasMenu } from '@/components/map/ServiceAreasMenu';
import { DrawControls } from '@/components/map/DrawControls';
import { SearchPanel } from '@/components/map/SearchPanel';
import { LayersPanel } from '@/components/map/LayersPanel';
import { DeliveriesLayer } from '@/components/map/layers/DeliveriesLayer';
import { RouteOptimizationDialog } from '@/components/map/RouteOptimizationDialog';
import { CreateBatchDialog } from '@/components/map/CreateBatchDialog';
import type { ServiceZone } from '@/types/zones';
import { useRealtimeStats } from '@/hooks/useRealtimeStats';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MAP_CONFIG } from '@/lib/mapConfig';
import L from 'leaflet';
import 'leaflet-draw';

export default function TacticalMap() {
  const { data: drivers = [] } = useDrivers();
  const { data: zones = [], refetch: refetchZones } = useServiceZones();
  const { data: facilitiesData } = useFacilities();
  const facilities = facilitiesData?.facilities || [];
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const { data: vehicles = [] } = useVehicles();
  const { data: rawBatches = [] } = useDeliveryBatches();
  const batches = useBatchRouteGeometries(rawBatches, warehouses);
  const { data: stats } = useRealtimeStats();
  const { layers } = useMapLayers();

  useRealtimeDrivers();
  useRealtimeZones();
  useRealtimeVehicles();
  useRealtimeDeliveries();

  const [serviceAreasOpen, setServiceAreasOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [visibleZones, setVisibleZones] = useState<Set<string>>(new Set());
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [createBatchDialogOpen, setCreateBatchDialogOpen] = useState(false);
  const [analyticsDrawerOpen, setAnalyticsDrawerOpen] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'live' | 'playback'>('live');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null);
  const [selectedDrawerType, setSelectedDrawerType] = useState<'driver' | 'vehicle' | 'batch' | null>(null);
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null);
  
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawingLayerRef = useRef<L.FeatureGroup | null>(null);

  const handleMapCapture = useCallback((map: L.Map) => {
    mapInstanceRef.current = map;
    
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = L.featureGroup().addTo(map);
    }
  }, []);

  const handleStartDrawing = useCallback(async () => {
    const name = prompt('Enter zone name:');
    if (!name) return;
    
    setIsDrawing(true);
    toast.info('Click on the map to draw the zone boundary');
  }, []);

  const handleCancelDrawing = useCallback(() => {
    setIsDrawing(false);
    toast.info('Drawing cancelled');
  }, []);

  const handleToggleVisibility = useCallback((zoneId: string) => {
    setVisibleZones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(zoneId)) {
        newSet.delete(zoneId);
      } else {
        newSet.add(zoneId);
      }
      return newSet;
    });
  }, []);

  const handleCenterOnZone = useCallback((zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (zone && mapInstanceRef.current) {
      try {
        const coords = zone.geometry.geometry.coordinates[0] as [number, number][];
        const bounds = new L.LatLngBounds(
          coords.map(coord => [coord[1], coord[0]] as [number, number])
        );
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error('Error centering on zone:', error);
      }
    }
  }, [zones]);

  const handleEditZone = useCallback((zoneId: string, coordinates: L.LatLng[]) => {
    setEditingZone(null);
    toast.success('Zone updated');
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingZone(null);
    toast.info('Editing cancelled');
  }, []);

  const handleDeleteZone = useCallback(async (zoneId: string) => {
    if (!confirm('Delete this zone?')) return;
    
    try {
      const { error } = await supabase
        .from('service_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;
      toast.success('Zone deleted');
      refetchZones();
    } catch (error) {
      console.error('Error deleting zone:', error);
      toast.error('Failed to delete zone');
    }
  }, [refetchZones]);

  const handleLocationSelect = useCallback((lat: number, lng: number, address: string) => {
    if (!mapInstanceRef.current) return;
    
    mapInstanceRef.current.setView([lat, lng], 16);
    toast.success('Location found');
  }, []);

  const handleLocateMe = useCallback(() => {
    if (!mapInstanceRef.current) return;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapInstanceRef.current?.setView([latitude, longitude], 15);
          toast.success('Location found');
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Could not get your location');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  }, []);

  const handleEntityClick = (type: 'driver' | 'vehicle' | 'batch', id: string) => {
    setSelectedDrawerType(type);
    setSelectedDrawerId(id);
  };

  const handleCloseDrawer = () => {
    setSelectedDrawerType(null);
    setSelectedDrawerId(null);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Operational Context Bar */}
      <OperationalContextBar
        onAnalyticsClick={() => setAnalyticsDrawerOpen(true)}
        onOptimizeClick={() => setOptimizeDialogOpen(true)}
        onCreateBatchClick={() => setCreateBatchDialogOpen(true)}
      />

      {/* Filter Bar */}
      <FilterBar
        selectedDate={selectedDate}
        selectedZone={selectedZone}
        selectedFleet={selectedFleet}
        onDateChange={setSelectedDate}
        onZoneChange={setSelectedZone}
        onFleetChange={setSelectedFleet}
      />

      {/* ARIA Live Region for Alerts */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {/* Alert messages will be announced here */}
      </div>

      {/* Map Container - Full Screen */}
      <div className="flex-1 relative overflow-hidden">
        <UnifiedMapContainer
          mode="fullscreen"
          facilities={layers.facilities ? facilities : []}
          warehouses={warehouses}
          drivers={layers.drivers ? drivers : []}
          batches={layers.batches ? batches : []}
          vehicles={layers.vehicles ? vehicles : []}
          showToolbar={false}
          showBottomPanel={false}
          onMapReady={handleMapCapture}
        >
          {/* KPI Ribbon - Floating at Top */}
          <KPIRibbon
            activeVehicles={stats?.activeVehicles}
            inProgress={stats?.inProgressDeliveries}
            completed={stats?.completedDeliveries}
            alerts={stats?.activeAlerts}
            onTimePercentage={stats?.onTimePercentage}
          />

          {/* Map Toolbar Clusters - Left Side */}
          <MapToolbarClusters
            map={mapInstanceRef.current}
            onLocateMe={handleLocateMe}
            onSearchClick={() => setSearchOpen(!searchOpen)}
            onServiceAreasClick={() => setServiceAreasOpen(!serviceAreasOpen)}
            onLayersClick={() => setLayersOpen(!layersOpen)}
            onLegendClick={() => setLegendOpen(!legendOpen)}
            onDrawToggle={() => setIsDrawing(!isDrawing)}
            onMeasureClick={() => setIsMeasuring(!isMeasuring)}
            isDrawing={isDrawing}
            isMeasuring={isMeasuring}
          />

          {/* Playback Bar - Floating at Bottom */}
          <PlaybackBar
            mode={playbackMode}
            currentTime={new Date()}
            shiftStart={new Date()}
            shiftEnd={new Date()}
            onModeToggle={() => setPlaybackMode(playbackMode === 'live' ? 'playback' : 'live')}
          />

            {/* Search Panel */}
            <SearchPanel
              isOpen={searchOpen}
              onClose={() => setSearchOpen(false)}
              onLocationSelect={handleLocationSelect}
            />

            {/* Layers Panel */}
            <LayersPanel
              isOpen={layersOpen}
              onClose={() => setLayersOpen(false)}
            />
            
            {/* DeliveriesLayer */}
            <DeliveriesLayer
              map={mapInstanceRef.current}
              visible={layers.batches}
            />
            
            {isDrawing && (
              <DrawControls
                isVisible={isDrawing}
                onFinish={() => setIsDrawing(false)}
                onCancel={handleCancelDrawing}
                onDeleteLastPoint={() => {}}
              />
            )}
            
            {editingZone && drawingLayerRef.current && (
              <div className="absolute top-4 right-4 z-floating bg-background border border-border rounded-lg shadow-lg p-4 space-y-2">
                <p className="text-sm font-medium">Edit Zone: {zones.find(z => z.id === editingZone)?.name}</p>
                <p className="text-xs text-muted-foreground">Drag vertices to reshape the zone</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelEditing}
                    className="flex-1 px-3 py-1.5 text-xs border border-input rounded-md hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingZone && drawingLayerRef.current) {
                        const layers = drawingLayerRef.current.getLayers();
                        const layer = layers.find((l: any) => l.options?.zoneId === editingZone);
                        if (layer && 'getLatLngs' in layer) {
                          const coordinates = (layer as L.Polygon).getLatLngs()[0] as L.LatLng[];
                          handleEditZone(editingZone, coordinates);
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
        </UnifiedMapContainer>

        {/* Floating Service Areas Menu */}
        <div className="absolute top-20 right-4 z-floating">
          <ServiceAreasMenu
            zones={zones}
            visibleZones={visibleZones}
            selectedZoneId={editingZone}
            onToggleVisibility={handleToggleVisibility}
            onCenterOnZone={handleCenterOnZone}
            onEditZone={(zoneId) => {
              const zone = zones.find(z => z.id === zoneId);
              if (zone) {
                setEditingZone(zoneId);
                if (drawingLayerRef.current) {
                  const layers = drawingLayerRef.current.getLayers();
                  const layer = layers.find((l: any) => l.options?.zoneId === zoneId);
                  if (layer && 'editing' in layer) {
                    (layer as any).editing.enable();
                  }
                }
              }
            }}
            onDeleteZone={handleDeleteZone}
            onCreateNew={handleStartDrawing}
          >
            <div />
          </ServiceAreasMenu>
        </div>
      </div>

      {/* Analytics Drawer - Replaces CommandSidebar */}
      <AnalyticsDrawer
        isOpen={analyticsDrawerOpen}
        onClose={() => setAnalyticsDrawerOpen(false)}
        onEntityClick={handleEntityClick}
      />
      
      {/* Route Optimization Dialog */}
      <RouteOptimizationDialog
        open={optimizeDialogOpen}
        onOpenChange={setOptimizeDialogOpen}
        batches={batches}
      />

      {/* Create Batch Dialog */}
      <CreateBatchDialog
        open={createBatchDialogOpen}
        onOpenChange={setCreateBatchDialogOpen}
      />

      {/* Entity Drawers */}
      <DriverDrawer
        isOpen={selectedDrawerType === 'driver'}
        driverId={selectedDrawerId}
        onClose={handleCloseDrawer}
      />
      <VehicleDrawer
        isOpen={selectedDrawerType === 'vehicle'}
        vehicleId={selectedDrawerId}
        onClose={handleCloseDrawer}
      />
      <BatchDrawer
        isOpen={selectedDrawerType === 'batch'}
        batchId={selectedDrawerId}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
