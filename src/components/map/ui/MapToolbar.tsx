import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMapLayers } from '@/hooks/useMapLayers';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  Truck,
  Users,
  Route,
  MapPin,
  Package,
  AlertTriangle,
  Building,
  Warehouse,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function MapToolbar() {
  const { layers, toggleLayer } = useMapLayers();
  const { workspace } = useWorkspace();

  const layerControls = [
    { key: 'vehicles' as const, label: 'Vehicles', icon: Truck },
    { key: 'drivers' as const, label: 'Drivers', icon: Users },
    { key: 'routes' as const, label: 'Routes', icon: Route },
    { key: 'zones' as const, label: 'Zones', icon: MapPin },
    { key: 'batches' as const, label: 'Batches', icon: Package },
    { key: 'alerts' as const, label: 'Alerts', icon: AlertTriangle },
    { key: 'facilities' as const, label: 'Facilities', icon: Building },
    { key: 'warehouses' as const, label: 'Warehouses', icon: Warehouse },
  ];

  return (
    <div className="h-16 bg-background border-b border-border flex items-center justify-between px-4">
      {/* Left: Workspace Identity */}
      <div className="flex items-center gap-2">
        <div className="font-semibold text-sm">
          RouteServe {workspace === 'fleetops' ? 'FleetOps' : 'Storefront'}
        </div>
      </div>

      {/* Center: Layer Toggles */}
      <TooltipProvider delayDuration={150}>
        <div className="flex gap-1">
          {layerControls.map(({ key, label, icon: Icon }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => toggleLayer(key)}
                  role="switch"
                  aria-checked={layers[key]}
                  aria-label={`Toggle ${label} layer ${layers[key] ? 'off' : 'on'}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleLayer(key);
                    }
                  }}
                  className={`h-9 px-3 rounded-md inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-200 layer-toggle ${
                    layers[key]
                      ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:scale-102'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{layers[key] ? 'Hide' : 'Show'} {label.toLowerCase()}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Right: Quick Filters (Future Enhancement) */}
      <div className="flex items-center gap-2">
        <div className="text-xs text-muted-foreground">Live View</div>
      </div>
    </div>
  );
}
