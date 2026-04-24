/**
 * Live Map Zustand Store
 * Manages filter state, selected entity, and playback state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  LiveMapFilters,
  SelectedEntity,
  MapViewState,
  DriverStatus,
  EntityType,
} from '@/types/live-map';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/constants';
import type { TetherMode } from '@/lib/algorithms/routeOptimizer';

interface LiveMapState {
  // View filters
  filters: LiveMapFilters;

  // Selected entity
  selectedEntity: SelectedEntity | null;

  // Map view state
  viewState: MapViewState;

  // Playback mode state
  playback: {
    isActive: boolean;
    startTime: Date | null;
    endTime: Date | null;
    currentTime: Date | null;
    speed: number; // 0.5, 1, 2, 5
    isPlaying: boolean;
    showStopMarkers: boolean;
    showStartEndMarkers: boolean;
  };

  // Actions - Filters
  setFilter: <K extends keyof LiveMapFilters>(key: K, value: LiveMapFilters[K]) => void;
  toggleFilter: (key: 'showDrivers' | 'showVehicles' | 'showDeliveries' | 'showRoutes' | 'showFacilities' | 'showWarehouses' | 'showZones') => void;
  setStatusFilter: (status: DriverStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Actions - Selection
  selectEntity: (id: string, type: EntityType) => void;
  clearSelection: () => void;

  // Actions - Map View
  setViewState: (viewState: Partial<MapViewState>) => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;

  // Tether / batch route view state
  tetherState: {
    mode: TetherMode;
    activeBatchId: string | null;
    selectedComparisonId: string | null;
  };
  setTetherMode: (mode: TetherMode) => void;
  setActiveBatch: (batchId: string | null) => void;
  setSelectedComparisonId: (id: string | null) => void;

  // Actions - Playback
  setPlaybackActive: (active: boolean) => void;
  setPlaybackTimeRange: (startTime: Date, endTime: Date) => void;
  setPlaybackCurrentTime: (time: Date) => void;
  setPlaybackSpeed: (speed: number) => void;
  togglePlayback: () => void;
  playPlayback: () => void;
  pausePlayback: () => void;
  toggleStopMarkers: () => void;
  toggleStartEndMarkers: () => void;
  resetPlayback: () => void;
}

const defaultFilters: LiveMapFilters = {
  showDrivers: true,
  showVehicles: true,
  showDeliveries: true,
  showRoutes: true,
  showFacilities: true,
  showWarehouses: true,
  showZones: true,
  statusFilter: 'all',
  vehicleTypeFilter: 'all',
  priorityFilter: 'all',
  searchQuery: '',
};

const defaultViewState: MapViewState = {
  center: DEFAULT_MAP_CENTER,
  zoom: DEFAULT_MAP_ZOOM,
};

export const useLiveMapStore = create<LiveMapState>()(
  persist(
    (set) => ({
      // Initial state
      filters: defaultFilters,
      selectedEntity: null,
      viewState: defaultViewState,
      tetherState: {
        mode: 'cardinal' as TetherMode,
        activeBatchId: null,
        selectedComparisonId: null,
      },
      playback: {
        isActive: false,
        startTime: null,
        endTime: null,
        currentTime: null,
        speed: 1,
        isPlaying: false,
        showStopMarkers: true,
        showStartEndMarkers: true,
      },

      // Filter actions
      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        })),

      toggleFilter: (key) =>
        set((state) => ({
          filters: { ...state.filters, [key]: !state.filters[key] },
        })),

      setStatusFilter: (status) =>
        set((state) => ({
          filters: { ...state.filters, statusFilter: status },
        })),

      setSearchQuery: (query) =>
        set((state) => ({
          filters: { ...state.filters, searchQuery: query },
        })),

      resetFilters: () => set({ filters: defaultFilters }),

      // Tether actions
      setTetherMode: (mode) =>
        set((state) => ({
          tetherState: { ...state.tetherState, mode },
        })),

      setActiveBatch: (batchId) =>
        set((state) => ({
          tetherState: {
            ...state.tetherState,
            activeBatchId: batchId,
            // Reset comparison when changing batch
            selectedComparisonId: batchId ? state.tetherState.selectedComparisonId : null,
          },
        })),

      setSelectedComparisonId: (id) =>
        set((state) => ({
          tetherState: { ...state.tetherState, selectedComparisonId: id },
        })),

      // Selection actions
      selectEntity: (id, type) =>
        set({ selectedEntity: { id, type } }),

      clearSelection: () => set({ selectedEntity: null }),

      // Map view actions
      setViewState: (viewState) =>
        set((state) => ({
          viewState: { ...state.viewState, ...viewState },
        })),

      setCenter: (center) =>
        set((state) => ({
          viewState: { ...state.viewState, center },
        })),

      setZoom: (zoom) =>
        set((state) => ({
          viewState: { ...state.viewState, zoom },
        })),

      // Playback actions
      setPlaybackActive: (active) =>
        set((state) => ({
          playback: {
            ...state.playback,
            isActive: active,
            isPlaying: active ? state.playback.isPlaying : false,
          },
        })),

      setPlaybackTimeRange: (startTime, endTime) =>
        set((state) => ({
          playback: {
            ...state.playback,
            startTime,
            endTime,
            currentTime: startTime,
          },
        })),

      setPlaybackCurrentTime: (time) =>
        set((state) => ({
          playback: { ...state.playback, currentTime: time },
        })),

      setPlaybackSpeed: (speed) =>
        set((state) => ({
          playback: { ...state.playback, speed },
        })),

      togglePlayback: () =>
        set((state) => ({
          playback: { ...state.playback, isPlaying: !state.playback.isPlaying },
        })),

      playPlayback: () =>
        set((state) => ({
          playback: { ...state.playback, isPlaying: true },
        })),

      pausePlayback: () =>
        set((state) => ({
          playback: { ...state.playback, isPlaying: false },
        })),

      toggleStopMarkers: () =>
        set((state) => ({
          playback: {
            ...state.playback,
            showStopMarkers: !state.playback.showStopMarkers,
          },
        })),

      toggleStartEndMarkers: () =>
        set((state) => ({
          playback: {
            ...state.playback,
            showStartEndMarkers: !state.playback.showStartEndMarkers,
          },
        })),

      resetPlayback: () =>
        set((state) => ({
          playback: {
            ...state.playback,
            isActive: false,
            startTime: null,
            endTime: null,
            currentTime: null,
            isPlaying: false,
          },
        })),
    }),
    {
      name: 'live-map-storage',
      partialize: (state) => ({
        filters: state.filters,
        viewState: state.viewState,
        // tetherState intentionally excluded — per-session only
      }),
    }
  )
);
