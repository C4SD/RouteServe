/**
 * Vehicle Carousel Component
 * Horizontal scrollable carousel for visual vehicle category selection
 * Replaces dropdown-based category/type selection
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImage } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';
import type { VehicleCategory } from '@/types/vlms-onboarding';

interface VehicleCarouselProps {
  categories: VehicleCategory[];
  selectedCategory: VehicleCategory | null;
  onSelect: (category: VehicleCategory) => void;
}

export function VehicleCarousel({
  categories,
  selectedCategory,
  onSelect,
}: VehicleCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative w-full">
      {/* Scroll Left Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
        onClick={() => scroll('left')}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Carousel Container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-10 py-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map((category) => {
          const isSelected = selectedCategory?.id === category.id;
          const silhouettePath = `/assets/vehicles/silhouettes/${category.code}.webp`;

          return (
            <button
              key={category.id}
              onClick={() => onSelect(category)}
              className={cn(
                'flex-shrink-0 w-[200px] h-[140px] rounded-lg border-2 transition-all duration-200',
                'hover:border-primary/50 hover:shadow-lg',
                'flex flex-col items-center justify-center gap-2 p-4 bg-background',
                isSelected
                  ? 'border-primary shadow-lg ring-2 ring-primary/20'
                  : 'border-border'
              )}
            >
              {/* Vehicle Silhouette */}
              <div className="flex-1 flex items-center justify-center w-full">
                <LazyImage
                  src={silhouettePath}
                  alt={category.display_name || category.name}
                  className="max-h-[80px] max-w-full object-contain"
                  threshold={0.1}
                  rootMargin="100px"
                  fallbackSrc="/placeholder-vehicle.svg"
                />
              </div>

              {/* Category Label */}
              <div className="text-center">
                <div className="flex items-center gap-1.5 justify-center mb-0.5">
                  <span className="font-mono text-[10px] bg-primary/10 px-1.5 py-0.5 rounded text-primary">
                    {category.code}
                  </span>
                  {category.source === 'biko' && (
                    <span className="font-mono text-[10px] bg-warning/10 px-1.5 py-0.5 rounded text-warning">
                      RS
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium line-clamp-1">
                  {category.display_name || category.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
        onClick={() => scroll('right')}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
