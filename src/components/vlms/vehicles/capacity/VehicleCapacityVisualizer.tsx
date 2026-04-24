import React from 'react';
import { cn } from '@/lib/utils';
import { formatWeight, formatVolume } from '@/lib/vlms/capacityCalculations';
import { getVehicleSilhouette } from '@/lib/vehicleUtils';

interface VehicleCapacityVisualizerProps {
  // Capacity data
  currentWeight?: number; // kg
  maxWeight?: number; // kg
  currentVolume?: number; // m³
  maxVolume?: number; // m³

  // Display options
  vehicleType?: string;
  make?: string;
  model?: string;
  displayMode?: 'weight' | 'volume' | 'auto'; // auto = use whichever is fuller
  size?: 'sm' | 'md' | 'lg'; // sm: dashboard, md: card, lg: detail page

  // Visual customization
  showLabel?: boolean; // Show "Current Capacity" label
  showMetrics?: boolean; // Show "850kg / 1000kg" below percentage
  className?: string;

  // Color theming (optional, defaults to blue gradient)
  fillColor?: string;
}

/**
 * Calculate capacity percentage from current and max values
 */
function calculateCapacityPercentage(
  current: number | undefined,
  max: number | undefined
): number {
  if (!current || !max || max === 0) return 0;
  return Math.min(Math.round((current / max) * 100), 100);
}

/**
 * Determine which metric to display (weight or volume)
 */
function determineDisplayMode(
  mode: 'weight' | 'volume' | 'auto',
  currentWeight?: number,
  maxWeight?: number,
  currentVolume?: number,
  maxVolume?: number
): 'weight' | 'volume' {
  if (mode !== 'auto') return mode;

  const weightPct = calculateCapacityPercentage(currentWeight, maxWeight);
  const volumePct = calculateCapacityPercentage(currentVolume, maxVolume);

  // Use whichever is more constrained (fuller)
  return weightPct >= volumePct ? 'weight' : 'volume';
}

/**
 * Get color based on capacity percentage
 */
function getCapacityColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-500'; // Overloaded/critical
  if (percentage >= 70) return 'text-blue-500'; // Optimal range
  if (percentage >= 40) return 'text-green-500'; // Good utilization
  return 'text-gray-500'; // Underutilized
}

export const VehicleCapacityVisualizer: React.FC<VehicleCapacityVisualizerProps> = ({
  currentWeight,
  maxWeight,
  currentVolume,
  maxVolume,
  vehicleType,
  make,
  model,
  displayMode = 'auto',
  size = 'md',
  showLabel = true,
  showMetrics = true,
  className,
  fillColor,
}) => {
  // Determine which metric to display
  const activeMode = determineDisplayMode(
    displayMode,
    currentWeight,
    maxWeight,
    currentVolume,
    maxVolume
  );

  // Calculate percentage based on active mode
  const percentage =
    activeMode === 'weight'
      ? calculateCapacityPercentage(currentWeight, maxWeight)
      : calculateCapacityPercentage(currentVolume, maxVolume);

  // Get metrics text
  const metricsText =
    activeMode === 'weight'
      ? `${formatWeight(currentWeight || 0)} / ${formatWeight(maxWeight || 0)}`
      : `${formatVolume(currentVolume || 0)} / ${formatVolume(maxVolume || 0)}`;

  // Get metrics label
  const metricsLabel = activeMode === 'weight' ? 'Weight' : 'Volume';

  // Size-based styling
  const containerSizeClasses = {
    sm: 'w-32 h-16',
    md: 'w-64 h-32',
    lg: 'w-96 h-48',
  };

  const textSizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  };

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const metricsSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  };

  // Get color based on percentage if not provided
  const capacityColor = fillColor || getCapacityColor(percentage);

  const silhouetteSrc = getVehicleSilhouette(vehicleType, make, model);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {showLabel && (
        <div className={cn('font-medium text-gray-600', labelSizeClasses[size])}>
          Current Capacity
        </div>
      )}

      <div className={cn('relative flex items-center justify-center', containerSizeClasses[size])}>
        <img
          src={silhouetteSrc}
          alt={`${vehicleType} silhouette`}
          className="h-full w-full object-contain opacity-80"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={cn('font-bold drop-shadow-lg', textSizeClasses[size], capacityColor)}>
            {percentage}%
          </span>
        </div>
      </div>

      {showMetrics && (
        <div className={cn('text-center space-y-0.5')}>
          <div className={cn('text-gray-500', metricsSizeClasses[size])}>
            {metricsLabel}: {metricsText}
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleCapacityVisualizer;
