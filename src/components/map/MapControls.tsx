/**
 * MapControls.tsx
 *
 * Map control buttons for zoom, bearing reset, locate, and layers
 * Follows RouteServe design system with guaranteed contrast control surface
 */

import { iconMap } from '@/map/icons/iconMap';
import { ICON_STATE } from '@/lib/mapDesignSystem';
import { Button } from '@/components/ui/button';
import { ControlSurface } from './ui/ControlSurface';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface MapControlsProps {
  /** Called when zoom in button is clicked */
  onZoomIn?: () => void;

  /** Called when zoom out button is clicked */
  onZoomOut?: () => void;

  /** Called when reset bearing button is clicked */
  onResetBearing?: () => void;

  /** Called when locate button is clicked */
  onLocate?: () => void;

  /** Called when layers button is clicked */
  onLayersToggle?: () => void;

  /** Whether layers panel is currently open */
  layersPanelOpen?: boolean;

  /** Custom class name */
  className?: string;
}

/**
 * MapControls Component
 *
 * Provides standard map navigation controls with guaranteed visibility.
 * All controls wrapped in ControlSurface for contrast against any basemap.
 */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onResetBearing,
  onLocate,
  onLayersToggle,
  layersPanelOpen = false,
  className = '',
}: MapControlsProps) {
  const ZoomInIcon = iconMap.controls.zoomIn;
  const ZoomOutIcon = iconMap.controls.zoomOut;
  const ResetBearingIcon = iconMap.controls.resetBearing;
  const LocateIcon = iconMap.controls.locate;
  const LayersIcon = iconMap.controls.layers;

  return (
    <TooltipProvider>
      <ControlSurface variant="navigation" position="top-left" className={className}>
        {/* Zoom In */}
        {onZoomIn && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={ICON_STATE.default}
                onClick={onZoomIn}
                aria-label="Zoom in"
              >
                <ZoomInIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Zoom in</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Zoom Out */}
        {onZoomOut && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={ICON_STATE.default}
                onClick={onZoomOut}
                aria-label="Zoom out"
              >
                <ZoomOutIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Zoom out</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Separator */}
        {(onResetBearing || onLocate || onLayersToggle) && (
          <div className="h-px bg-border/50 my-1" />
        )}

        {/* Reset Bearing */}
        {onResetBearing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={ICON_STATE.default}
                onClick={onResetBearing}
                aria-label="Reset bearing"
              >
                <ResetBearingIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Reset bearing</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Locate */}
        {onLocate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={ICON_STATE.default}
                onClick={onLocate}
                aria-label="Locate me"
              >
                <LocateIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Locate me</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Layers Toggle */}
        {onLayersToggle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  layersPanelOpen ? ICON_STATE.active : ICON_STATE.default
                )}
                onClick={onLayersToggle}
                aria-label="Toggle layers panel"
              >
                <LayersIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{layersPanelOpen ? 'Hide' : 'Show'} layers</p>
            </TooltipContent>
          </Tooltip>
        )}
      </ControlSurface>
    </TooltipProvider>
  );
}
