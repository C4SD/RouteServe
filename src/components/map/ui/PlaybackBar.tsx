import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkipBack, Play, Pause, SkipForward, Radio } from 'lucide-react';
import { FLOATING_PANEL, Z_INDEX, CONTAINER, HEIGHT } from '@/lib/mapDesignSystem';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PlaybackBarProps {
  mode?: 'live' | 'playback';
  currentTime?: Date;
  shiftStart?: Date;
  shiftEnd?: Date;
  onTimeChange?: (time: Date) => void;
  onModeToggle?: () => void;
}

export function PlaybackBar({
  mode = 'live',
  currentTime = new Date(),
  shiftStart = new Date(),
  shiftEnd = new Date(),
  onTimeChange,
  onModeToggle,
}: PlaybackBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Calculate progress percentage
  const startTime = shiftStart.getTime();
  const endTime = shiftEnd.getTime();
  const current = currentTime.getTime();
  const progress = ((current - startTime) / (endTime - startTime)) * 100;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // TODO: Implement actual playback logic
  };

  const handleSkipBack = () => {
    const newTime = new Date(currentTime);
    newTime.setMinutes(newTime.getMinutes() - 15);
    onTimeChange?.(newTime);
  };

  const handleSkipForward = () => {
    const newTime = new Date(currentTime);
    newTime.setMinutes(newTime.getMinutes() + 15);
    onTimeChange?.(newTime);
  };

  return (
    <div
      className={cn(
        'absolute bottom-6 left-1/2 -translate-x-1/2',
        CONTAINER.playback,
        'w-full px-6'
      )}
      style={{ zIndex: Z_INDEX.mapControls }}
    >
      <div className={cn(
        FLOATING_PANEL.kpi,
        HEIGHT.playback,
        'flex items-center gap-6 px-8 py-3'
      )}>
        {/* Mode Badge */}
        <Badge
          variant={mode === 'live' ? 'default' : 'outline'}
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={onModeToggle}
        >
          {mode === 'live' && <Radio className="h-3 w-3 animate-pulse" />}
          {mode === 'live' ? 'Live' : 'Playback'}
        </Badge>

        {mode === 'playback' && (
          <>
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleSkipBack}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleSkipForward}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Timeline Scrubber */}
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(currentTime)}
              </span>

              <div className="flex-1 relative">
                <input
                  id="playback-scrubber"
                  name="playback-scrubber"
                  type="range"
                  min={startTime}
                  max={endTime}
                  value={current}
                  onChange={(e) => {
                    const newTime = new Date(parseInt(e.target.value));
                    onTimeChange?.(newTime);
                  }}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-primary
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-md
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-primary
                    [&::-moz-range-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-md"
                  style={{
                    background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${progress}%, hsl(var(--muted)) ${progress}%, hsl(var(--muted)) 100%)`
                  }}
                />
              </div>

              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(shiftEnd)}
              </span>
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Speed:</span>
              <Badge variant="outline" className="font-mono">1x</Badge>
            </div>
          </>
        )}

        {mode === 'live' && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">
              Showing live data • Updates every 30 seconds
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
