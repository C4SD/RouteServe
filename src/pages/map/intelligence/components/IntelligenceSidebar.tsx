/**
 * IntelligenceSidebar - Left panel for the Map Intelligence page
 *
 * Three top-level tabs:
 *   Track      – real-time entity list (vehicles, drivers, deliveries …)
 *   Playback   – batch selector + event analytics + map intelligence tabs
 *   Analytics  – planning layer stats + visibility toggles
 */

import { useState } from 'react';
import {
  Radio, History, BarChart3, ChevronLeft, ChevronRight,
  Layers, Map as MapIcon, Route, Eye, EyeOff, MapPin, Activity,
  ChevronDown, Calendar as CalendarIcon, Loader2, Pentagon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LiveFilterPanel } from '../../components/LiveFilterPanel';
import { EventAnalyticsTab } from '../../playback/components/EventAnalyticsTab';
import { RouteIntelligenceTab } from '../../playback/components/RouteIntelligenceTab';
import { ZoningPanel } from './ZoningPanel';
import { usePlaybackEngine } from '@/hooks/usePlaybackEngine';
import { usePlaybackBatches } from '@/hooks/usePlaybackData';
import { useLiveTrackingCtx } from '@/contexts/LiveTrackingContext';
import { usePlaybackStore } from '@/stores/playbackStore';
import type { UseGeospatialZoningReturn } from '../hooks/useGeospatialZoning';

export type IntelligenceTab = 'track' | 'playback' | 'analytics' | 'zoning';

interface PlanningStats {
  totalZones: number;
  zonesWithBoundary: number;
  totalRoutes: number;
  routesWithGeometry: number;
  sandboxRoutes: number;
  activeRoutes: number;
  totalServiceAreas: number;
  serviceAreasWithHull: number;
}

interface LayerToggles {
  showZonePolygons: boolean;
  showRouteGeometry: boolean;
  showServiceAreas: boolean;
}

interface IntelligenceSidebarProps {
  activeTab: IntelligenceTab;
  onTabChange: (tab: IntelligenceTab) => void;
  planningStats?: PlanningStats;
  layerToggles: LayerToggles;
  onLayerToggle: (key: keyof LayerToggles) => void;
  selectedBatchId: string | null;
  onSelectBatch: (id: string) => void;
  filterDate: Date | null;
  onDateFilter: (date: Date | null) => void;
  zoning?: UseGeospatialZoningReturn;
}

export function IntelligenceSidebar({
  activeTab,
  onTabChange,
  planningStats,
  layerToggles,
  onLayerToggle,
  selectedBatchId,
  onSelectBatch,
  filterDate,
  onDateFilter,
  zoning,
}: IntelligenceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { counts } = useLiveTrackingCtx();

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'relative flex flex-col border-r bg-background shrink-0 transition-all duration-300 overflow-hidden',
          collapsed ? 'w-12' : 'w-[320px]'
        )}
      >
        {/* Collapse toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-4 z-20 h-6 w-6 rounded-full border bg-background shadow-sm"
              onClick={() => setCollapsed((p) => !p)}
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
        </Tooltip>

        {/* ── Collapsed icon strip ─────────────────────────── */}
        {collapsed && (
          <div className="flex flex-col items-center gap-3 pt-14 px-2">
            {[
              { tab: 'track' as const, Icon: Radio, label: 'Track' },
              { tab: 'playback' as const, Icon: History, label: 'Playback' },
              { tab: 'analytics' as const, Icon: BarChart3, label: 'Analytics' },
              { tab: 'zoning' as const, Icon: Pentagon, label: 'Zoning' },
            ].map(({ tab, Icon, label }) => (
              <Tooltip key={tab}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === tab ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setCollapsed(false); onTabChange(tab); }}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

      {/* ── Expanded content ─────────────────────────────── */}
      {!collapsed && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as IntelligenceTab)}
          className="flex flex-col h-full min-h-0"
        >
          {/* Tab bar */}
          <div className="p-4 pb-0 shrink-0">
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="track" className="gap-1 text-xs">
                <Radio className="h-3 w-3" />
                Track
                {counts.activeDrivers > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {counts.activeDrivers}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="playback" className="gap-1 text-xs">
                <History className="h-3 w-3" />
                Replay
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1 text-xs">
                <BarChart3 className="h-3 w-3" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="zoning" className="gap-1 text-xs">
                <Pentagon className="h-3 w-3" />
                Zones
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Track tab */}
          <TabsContent
            value="track"
            className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col"
          >
            <LiveFilterPanel />
          </TabsContent>

          {/* Playback tab */}
          <TabsContent
            value="playback"
            className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
          >
            <PlaybackSidebarContent
              selectedBatchId={selectedBatchId}
              onSelectBatch={onSelectBatch}
              filterDate={filterDate}
              onDateFilter={onDateFilter}
            />
          </TabsContent>

          {/* Analytics tab */}
          <TabsContent
            value="analytics"
            className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
          >
            <AnalyticsSidebarContent
              stats={planningStats}
              layerToggles={layerToggles}
              onLayerToggle={onLayerToggle}
            />
          </TabsContent>

          {/* Zoning tab */}
          <TabsContent
            value="zoning"
            className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
          >
            {zoning ? (
              <ZoningPanel zoning={zoning} />
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Zoning unavailable
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
      </div>
    </TooltipProvider>
  );
}

/* ── Playback sidebar ──────────────────────────────────────────────────────── */

function PlaybackSidebarContent({
  selectedBatchId,
  onSelectBatch,
  filterDate,
  onDateFilter,
}: {
  selectedBatchId: string | null;
  onSelectBatch: (id: string) => void;
  filterDate: Date | null;
  onDateFilter: (date: Date | null) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<'events' | 'route'>('events');

  const { data: batches, isLoading: batchesLoading } = usePlaybackBatches();
  const viewMode = usePlaybackStore((s) => s.viewMode);
  const setViewMode = usePlaybackStore((s) => s.setViewMode);

  // Load playback data for selected batch
  usePlaybackEngine({ batchId: selectedBatchId, enabled: !!selectedBatchId });

  const filteredBatches = batches
    ? filterDate
      ? batches.filter((b) => {
          if (!b.startTime) return false;
          return b.startTime.toDateString() === filterDate.toDateString();
        })
      : batches
    : [];

  const selectedBatch = filteredBatches.find((b) => b.id === selectedBatchId);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Batch selector */}
      <div className="shrink-0 p-4 border-b space-y-3">
        <div className="flex gap-2">
          {/* Batch dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 justify-between text-xs h-9 min-w-0">
                <span className="truncate">
                  {batchesLoading
                    ? 'Loading…'
                    : selectedBatch
                      ? selectedBatch.name
                      : 'Select a batch…'}
                </span>
                {batchesLoading
                  ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  : <ChevronDown className="h-3 w-3 shrink-0" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px] max-h-60 overflow-auto">
              {filteredBatches.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">
                  {filterDate ? 'No batches on this date' : 'No batches available'}
                </div>
              ) : (
                filteredBatches.map((b) => (
                  <DropdownMenuItem key={b.id} onSelect={() => onSelectBatch(b.id)}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{b.name}</span>
                      {b.driverName && (
                        <span className="text-xs text-muted-foreground">{b.driverName}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date filter */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant={filterDate ? 'default' : 'outline'}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Filter by date</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filterDate ?? undefined}
                onSelect={(d) => { onDateFilter(d ?? null); setCalendarOpen(false); }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {filterDate && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarIcon className="h-3 w-3" />
            <span>
              {filterDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              className="ml-auto text-xs underline hover:text-foreground"
              onClick={() => onDateFilter(null)}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Analytics sub-tabs */}
      <div className="shrink-0 border-b">
        <div className="flex">
          {[
            { id: 'events' as const, label: 'Event Analytics', Icon: Activity },
            { id: 'route' as const, label: 'Map Intelligence', Icon: BarChart3 },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setAnalyticsTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-xs border-b-2 transition-colors',
                analyticsTab === id
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{id === 'events' ? 'Events' : 'Intel'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Analytics content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {analyticsTab === 'events' ? <EventAnalyticsTab /> : <RouteIntelligenceTab />}
      </div>
    </div>
  );
}

/* ── Analytics sidebar ─────────────────────────────────────────────────────── */

function LayerToggleRow({
  icon: Icon, label, count, visible, onToggle, color = 'text-foreground',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  visible: boolean;
  onToggle: () => void;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors">
      <Icon className={cn('h-4 w-4 shrink-0', color)} />
      <span className="flex-1 text-sm">{label}</span>
      {count !== undefined && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onToggle}>
        {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
      </Button>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xl font-semibold tracking-tight">{value}</span>
    </div>
  );
}

function AnalyticsSidebarContent({
  stats,
  layerToggles,
  onLayerToggle,
}: {
  stats?: PlanningStats;
  layerToggles: LayerToggles;
  onLayerToggle: (key: keyof LayerToggles) => void;
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">

        {/* Planning layer toggles */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Planning Layers
          </p>
          <div className="space-y-0.5">
            <LayerToggleRow
              icon={MapIcon}
              label="Zone Boundaries"
              count={stats?.zonesWithBoundary}
              visible={layerToggles.showZonePolygons}
              onToggle={() => onLayerToggle('showZonePolygons')}
              color="text-indigo-500"
            />
            <LayerToggleRow
              icon={Route}
              label="Route Geometries"
              count={stats?.routesWithGeometry}
              visible={layerToggles.showRouteGeometry}
              onToggle={() => onLayerToggle('showRouteGeometry')}
              color="text-blue-500"
            />
            <LayerToggleRow
              icon={Layers}
              label="Service Areas"
              count={stats?.serviceAreasWithHull}
              visible={layerToggles.showServiceAreas}
              onToggle={() => onLayerToggle('showServiceAreas')}
              color="text-amber-500"
            />
          </div>
        </div>

        <Separator />

        {/* Route stats */}
        {stats && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Routes
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total" value={stats.totalRoutes} icon={Route} color="text-blue-500" />
              <StatCard label="Active" value={stats.activeRoutes} icon={Activity} color="text-green-500" />
              <StatCard label="Sandbox" value={stats.sandboxRoutes} icon={MapIcon} color="text-violet-500" />
              <StatCard label="Mapped" value={stats.routesWithGeometry} icon={MapIcon} color="text-cyan-500" />
            </div>
          </div>
        )}

        <Separator />

        {/* Coverage stats */}
        {stats && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Coverage
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Zones" value={stats.totalZones} icon={MapPin} color="text-indigo-500" />
              <StatCard label="Boundaries" value={stats.zonesWithBoundary} icon={MapIcon} color="text-indigo-400" />
              <StatCard label="Svc Areas" value={stats.totalServiceAreas} icon={Layers} color="text-amber-500" />
              <StatCard label="With Hull" value={stats.serviceAreasWithHull} icon={Activity} color="text-amber-400" />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
