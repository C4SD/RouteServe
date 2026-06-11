/**
 * ForensicTimelineBar.tsx
 *
 * Pure presentational timeline controls.
 *
 * GOVERNANCE:
 * - No logic
 * - No state management
 * - Calls callbacks only
 * - Renders time display, slider, play/pause, speed
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { PlaybackSpeed } from './ForensicTimelineController';

/**
 * Props
 */
interface ForensicTimelineBarProps {
  /** Current playback time */
  currentTime: Date;

  /** Start of time range */
  startTime: Date;

  /** End of time range */
  endTime: Date;

  /** Whether playback is active */
  isPlaying: boolean;

  /** Current speed */
  speed: PlaybackSpeed;

  /** Play/pause toggle */
  onPlayPause: () => void;

  /** Seek to time */
  onSeek: (time: Date) => void;

  /** Change speed */
  onSpeedChange: (speed: PlaybackSpeed) => void;

  /** Step forward */
  onStepForward?: () => void;

  /** Step backward */
  onStepBackward?: () => void;

  /** Additional class name */
  className?: string;
}

/**
 * Available speed options
 */
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 5, 10];

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Calculate percentage position (0-100)
 */
function getPercent(current: Date, start: Date, end: Date): number {
  const range = end.getTime() - start.getTime();
  if (range === 0) return 0;
  const elapsed = current.getTime() - start.getTime();
  return Math.max(0, Math.min(100, (elapsed / range) * 100));
}

/**
 * ForensicTimelineBar - Timeline controls UI
 *
 * Pure presentational. No logic. Calls callbacks.
 */
export function ForensicTimelineBar({
  currentTime,
  startTime,
  endTime,
  isPlaying,
  speed,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onStepForward,
  onStepBackward,
  className,
}: ForensicTimelineBarProps) {
  const percent = getPercent(currentTime, startTime, endTime);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const range = endTime.getTime() - startTime.getTime();
    const targetTime = new Date(startTime.getTime() + (range * value) / 100);
    onSeek(targetTime);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 rounded-lg',
        'bg-card border shadow-lg',
        'select-none',
        className
      )}
    >
      {/* Step backward */}
      <button
        onClick={onStepBackward}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Step backward"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="19,20 9,12 19,4" />
          <line x1="5" y1="19" x2="5" y2="5" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={onStepForward}
        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Step forward"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5,4 15,12 5,20" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </button>

      {/* Time display */}
      <div className="flex flex-col items-center min-w-[120px]">
        <span className="text-xs font-mono font-medium text-foreground">
          {formatTime(currentTime)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatDate(currentTime)}
        </span>
      </div>

      {/* Slider */}
      <div className="flex-1 min-w-[200px]">
        <input
          id="forensic-timeline"
          name="forensic-timeline"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={percent}
          onChange={handleSliderChange}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
        />
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatTime(startTime)}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatTime(endTime)}
          </span>
        </div>
      </div>

      {/* Speed selector */}
      <select
        id="playback-speed"
        name="playback-speed"
        value={speed}
        onChange={(e) => onSpeedChange(parseFloat(e.target.value) as PlaybackSpeed)}
        className="text-xs px-2 py-1 rounded border bg-background text-foreground cursor-pointer"
        title="Playback speed"
      >
        {SPEED_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
    </div>
  );
}
