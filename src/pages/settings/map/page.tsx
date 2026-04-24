import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, LocateFixed, X, ShieldAlert } from 'lucide-react';
import { SettingsSection } from '@/components/admin/settings/SettingsSection';
import { SettingsSwitchRow } from '@/components/admin/settings/SettingsRow';
import { useWorkspaceSettings, useUpdateWorkspaceSettings } from '@/hooks/useWorkspaceSettings';
import type { BasemapStyle } from '@/hooks/settings/useMapSettings';
import { NIGERIA_STATE_BOUNDS } from '@/lib/geo-bounds';

const BASEMAP_OPTIONS: { value: BasemapStyle; label: string; description: string }[] = [
  { value: 'auto',    label: 'Auto',    description: 'Follows your system light/dark mode' },
  { value: 'light',   label: 'Light',   description: 'Positron — clean minimal basemap' },
  { value: 'dark',    label: 'Dark',    description: 'Fiord — dark basemap for night use' },
  { value: 'streets', label: 'Streets', description: 'Liberty — detailed streets with labels & POIs' },
];

const REFRESH_OPTIONS = [
  { value: '15', label: '15 seconds' },
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
];

export default function SettingsMapPage() {
  const { data: ws, isLoading } = useWorkspaceSettings();
  const updateMutation = useUpdateWorkspaceSettings();
  const [hasChanges, setHasChanges] = useState(false);

  // Local form state
  const [basemapStyle, setBasemapStyle] = useState<BasemapStyle>('auto');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [zoom, setZoom] = useState('');
  const [showZones, setShowZones] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [enableClustering, setEnableClustering] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('30');
  const [showTraffic, setShowTraffic] = useState(false);
  const [showPlaces, setShowPlaces] = useState(true);
  const [locating, setLocating] = useState(false);

  // Coordinate policy
  const [coordStateCodes, setCoordStateCodes] = useState<string[]>([]);
  const [coordStrictMode, setCoordStrictMode] = useState(false);
  const [coordStateInput, setCoordStateInput] = useState('');

  const nigeriaStateOptions = Object.entries(NIGERIA_STATE_BOUNDS).map(([code, b]) => ({
    code,
    name: b.name,
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Sync from server on load
  useEffect(() => {
    if (!ws) return;
    const meta = ws.metadata ?? {};
    setBasemapStyle((meta.basemap_style as BasemapStyle) ?? 'auto');
    setLat(String(ws.map_center_lat ?? 12.0));
    setLng(String(ws.map_center_lng ?? 8.5167));
    setZoom(String(ws.map_default_zoom ?? 11));
    setShowZones(meta.show_zones ?? true);
    setShowFacilities(meta.show_facilities ?? true);
    setShowRoutes(meta.show_routes ?? true);
    setEnableClustering(meta.enable_clustering ?? true);
    setRefreshInterval(String(meta.realtime_refresh_interval ?? 30));
    setShowTraffic(meta.show_traffic ?? false);
    setShowPlaces(meta.show_places ?? true);
    // Coordinate policy
    const policy = meta.coordinate_policy;
    setCoordStateCodes(policy?.state_codes ?? []);
    setCoordStrictMode(policy?.strict_mode ?? false);
  }, [ws]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setHasChanges(true);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const handleSave = () => {
    if (!ws) return;
    const meta = ws.metadata ?? {};
    updateMutation.mutate({
      map_center_lat: parseFloat(lat) || 12.0,
      map_center_lng: parseFloat(lng) || 8.5167,
      map_default_zoom: Math.min(18, Math.max(3, parseInt(zoom, 10) || 11)),
      metadata: {
        ...meta,
        basemap_style: basemapStyle,
        show_zones: showZones,
        show_facilities: showFacilities,
        show_routes: showRoutes,
        enable_clustering: enableClustering,
        realtime_refresh_interval: parseInt(refreshInterval, 10),
        show_traffic: showTraffic,
        show_places: showPlaces,
        coordinate_policy: coordStateCodes.length > 0
          ? { country: 'NG', state_codes: coordStateCodes, strict_mode: coordStrictMode }
          : null,
      },
    });
    setHasChanges(false);
  };

  const handleCancel = () => {
    if (!ws) return;
    const meta = ws.metadata ?? {};
    setBasemapStyle((meta.basemap_style as BasemapStyle) ?? 'auto');
    setLat(String(ws.map_center_lat ?? 12.0));
    setLng(String(ws.map_center_lng ?? 8.5167));
    setZoom(String(ws.map_default_zoom ?? 11));
    setShowZones(meta.show_zones ?? true);
    setShowFacilities(meta.show_facilities ?? true);
    setShowRoutes(meta.show_routes ?? true);
    setEnableClustering(meta.enable_clustering ?? true);
    setRefreshInterval(String(meta.realtime_refresh_interval ?? 30));
    setShowTraffic(meta.show_traffic ?? false);
    setShowPlaces(meta.show_places ?? true);
    const policy = meta.coordinate_policy;
    setCoordStateCodes(policy?.state_codes ?? []);
    setCoordStrictMode(policy?.strict_mode ?? false);
    setHasChanges(false);
  };

  const markChanged = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Map Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control how maps look and behave across the platform.
        </p>
      </div>

      {/* Map Type */}
      <SettingsSection
        title="Map type"
        description="The basemap style shown across all maps in the platform."
      >
        <Select
          value={basemapStyle}
          onValueChange={markChanged<string>(setBasemapStyle as (v: string) => void)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BASEMAP_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsSection>

      {/* Default Map Center */}
      <SettingsSection
        title="Default map center"
        description="The location the map opens to on first load."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Latitude</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="12.0000"
                value={lat}
                onChange={(e) => { setLat(e.target.value); setHasChanges(true); }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Longitude</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="8.5167"
                value={lng}
                onChange={(e) => { setLng(e.target.value); setHasChanges(true); }}
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="gap-2"
          >
            {locating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <LocateFixed className="h-3.5 w-3.5" />
            }
            Use my current location
          </Button>
        </div>
      </SettingsSection>

      {/* Default Zoom */}
      <SettingsSection
        title="Default zoom level"
        description="Zoom level on map load (3 = country, 11 = city, 15 = street)."
      >
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min={3}
            max={18}
            step={1}
            className="w-24"
            value={zoom}
            onChange={(e) => { setZoom(e.target.value); setHasChanges(true); }}
          />
          <span className="text-sm text-muted-foreground">3 – 18</span>
        </div>
      </SettingsSection>

      {/* Layer Visibility Defaults */}
      <SettingsSection
        title="Default layer visibility"
        description="Which layers are shown when the map first opens."
      >
        <div className="space-y-1 divide-y">
          <SettingsSwitchRow
            label="Delivery zones"
            description="Show service zone boundaries"
            checked={showZones}
            onCheckedChange={markChanged(setShowZones)}
          />
          <SettingsSwitchRow
            label="Facilities"
            description="Show facility / health-post markers"
            checked={showFacilities}
            onCheckedChange={markChanged(setShowFacilities)}
          />
          <SettingsSwitchRow
            label="Route lines"
            description="Show active delivery routes"
            checked={showRoutes}
            onCheckedChange={markChanged(setShowRoutes)}
          />
        </div>
      </SettingsSection>

      {/* Live Data */}
      <SettingsSection
        title="Live data layers"
        description="Real-world data overlaid on the map during live tracking."
      >
        <div className="space-y-1 divide-y">
          <SettingsSwitchRow
            label="Show places & points of interest"
            description="Display local landmarks, businesses, and named locations from the Streets basemap"
            checked={showPlaces}
            onCheckedChange={markChanged(setShowPlaces)}
          />
          <SettingsSwitchRow
            label="Traffic overlay"
            description="Show live traffic conditions on routes (requires traffic data source)"
            checked={showTraffic}
            onCheckedChange={markChanged(setShowTraffic)}
          />
        </div>
        {showTraffic && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Traffic data requires a configured traffic provider. Contact your workspace admin to enable it.
          </p>
        )}
      </SettingsSection>

      {/* Performance */}
      <SettingsSection
        title="Performance"
        description="Controls that affect rendering and data refresh."
      >
        <div className="space-y-1 divide-y">
          <SettingsSwitchRow
            label="Cluster nearby markers"
            description="Group markers that overlap at low zoom levels"
            checked={enableClustering}
            onCheckedChange={markChanged(setEnableClustering)}
          />
          <div className="py-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Live tracking refresh</Label>
              <p className="text-sm text-muted-foreground">How often the live map polls for updates</p>
            </div>
            <Select
              value={refreshInterval}
              onValueChange={markChanged<string>(setRefreshInterval)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      {/* Coordinate Validation Policy */}
      <SettingsSection
        title="Coordinate validation"
        description="Validate that facility coordinates fall within expected geographic bounds during import and manual entry."
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Expected state(s)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Facilities outside these states will be flagged. Leave empty to skip state-level checks.
            </p>

            {/* Selected states */}
            {coordStateCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {coordStateCodes.map((code) => {
                  const state = NIGERIA_STATE_BOUNDS[code];
                  return (
                    <Badge key={code} variant="secondary" className="gap-1 pr-1">
                      <ShieldAlert className="h-3 w-3" />
                      {state?.name ?? code}
                      <button
                        type="button"
                        className="ml-0.5 rounded hover:bg-muted p-0.5"
                        onClick={() => {
                          setCoordStateCodes((prev) => prev.filter((c) => c !== code));
                          setHasChanges(true);
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Add state dropdown */}
            <Select
              value={coordStateInput}
              onValueChange={(code) => {
                if (code && !coordStateCodes.includes(code)) {
                  setCoordStateCodes((prev) => [...prev, code]);
                  setHasChanges(true);
                }
                setCoordStateInput('');
              }}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Add a state…" />
              </SelectTrigger>
              <SelectContent>
                {nigeriaStateOptions
                  .filter((s) => !coordStateCodes.includes(s.code))
                  .map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {coordStateCodes.length > 0 && (
            <div className="space-y-1 divide-y">
              <SettingsSwitchRow
                label="Strict mode"
                description="Block import when coordinates are outside the expected state (instead of warning only)"
                checked={coordStrictMode}
                onCheckedChange={markChanged(setCoordStrictMode)}
              />
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Save / Cancel */}
      <div className="flex items-center gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
        {hasChanges && (
          <Button variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending}>
            Cancel
          </Button>
        )}
        {!hasChanges && !updateMutation.isPending && (
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Changes saved
          </span>
        )}
      </div>
    </div>
  );
}
