/**
 * Playback Map Page - Production-grade historical replay
 *
 * Architecture:
 * - Time-synchronized playback engine
 * - RAF-based animation loop
 * - Deterministic state (everything derives from currentTime)
 * - Real-time analytics
 */

import { useState, useEffect } from 'react';
import { TopContextBar } from './components/TopContextBar';
import { LeftPanel } from './components/LeftPanel';
import { PlaybackMap } from './components/PlaybackMap';
import { PlaybackDock } from './components/PlaybackDock';
import { usePlaybackStore } from '@/stores/playbackStore';
import { usePlaybackEngine } from '@/hooks/usePlaybackEngine';
import { Loader2 } from 'lucide-react';

export default function PlaybackMapPage() {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  const selectBatch = usePlaybackStore((state) => state.selectBatch);
  const reset = usePlaybackStore((state) => state.reset);

  // Initialize playback engine (fetches + normalizes data)
  const { isLoading, isError } = usePlaybackEngine({
    batchId: selectedBatchId,
    enabled: !!selectedBatchId,
  });

  // Handle batch selection
  const handleSelectBatch = (id: string) => {
    console.log('[PlaybackPage] Batch selected:', id);
    setSelectedBatchId(id);
    selectBatch(id);
    // Clear date filter when batch is selected
    setFilterDate(null);
  };

  // Handle date filter from calendar
  const handleDateFilter = (date: Date | null) => {
    console.log('[PlaybackPage] Date filter:', date);
    setFilterDate(date);
    // Clear selected batch when filtering by date
    // (batches will be filtered in TopContextBar)
    if (date && selectedBatchId) {
      setSelectedBatchId(null);
      selectBatch(null);
    }
  };

  // Debug logging
  console.log('[PlaybackPage] Render state:', {
    selectedBatchId,
    isLoading,
    isError,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      {/* Top context bar */}
      <TopContextBar
        selectedBatchId={selectedBatchId}
        onSelectBatch={handleSelectBatch}
        filterDate={filterDate}
        onDateFilter={handleDateFilter}
      />

      {/* Main content area - Map dominant layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left intelligence panel - Collapsible */}
        <LeftPanel />

        {/* Map area - Takes remaining space */}
        <div className="flex-1 relative">
          {/* Loading overlay */}
          {isLoading && selectedBatchId && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-50">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading trip data...
                </p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {isError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-50">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Failed to load trip data
                </p>
                <p className="text-xs text-muted-foreground">
                  Please try selecting a different batch
                </p>
              </div>
            </div>
          )}

          {/* Map always renders */}
          <PlaybackMap
            className="absolute inset-0"
            hasTrip={!!selectedBatchId}
          />
        </div>
      </div>

      {/* Bottom playback controls */}
      <PlaybackDock />
    </div>
  );
}
