/**
 * VLMS Vehicle Onboarding - Category Selector Component
 * Step 1: Select vehicle category (EU or BIKO)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ArrowRight, AlertCircle } from 'lucide-react';
import { CategoryTile } from './CategoryTile';
import { useVehicleCategories, groupCategoriesBySource } from '@/hooks/useVehicleCategories';
import { useVehicleOnboardState } from '@/hooks/useVehicleOnboardState';
import type { VehicleCategory } from '@/types/vlms-onboarding';

export function CategorySelector() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: categories, isLoading, error } = useVehicleCategories();

  const selectedCategory = useVehicleOnboardState((state) => state.selectedCategory);
  const setSelectedCategory = useVehicleOnboardState((state) => state.setSelectedCategory);
  const goToNextStep = useVehicleOnboardState((state) => state.goToNextStep);
  const canGoNext = useVehicleOnboardState((state) => state.canGoNext());

  // Group categories by source
  const grouped = categories ? groupCategoriesBySource(categories) : { eu: [], biko: [] };

  // Filter by search term
  const filterCategories = (cats: VehicleCategory[]) => {
    if (!searchTerm) return cats;
    const term = searchTerm.toLowerCase();
    return cats.filter(
      (c) =>
        c.display_name.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term)
    );
  };

  const filteredEU = filterCategories(grouped.eu);
  const filteredBIKO = filterCategories(grouped.biko);

  const handleSelect = (category: VehicleCategory) => {
    setSelectedCategory(category);
  };

  const handleNext = () => {
    if (canGoNext) {
      goToNextStep();
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load vehicle categories. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Select Vehicle Category</CardTitle>
        <CardDescription>
          Choose a vehicle classification to begin. Select from EU standards or RouteServe shortcuts.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Categories</TabsTrigger>
            <TabsTrigger value="eu">EU Standards</TabsTrigger>
            <TabsTrigger value="biko">RouteServe Shortcuts</TabsTrigger>
          </TabsList>

          {/* All Categories */}
          <TabsContent value="all" className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {/* EU Categories */}
                {filteredEU.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      🇪🇺 EU Standards
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredEU.map((category) => (
                        <CategoryTile
                          key={category.id}
                          category={category}
                          isSelected={selectedCategory?.id === category.id}
                          onSelect={() => handleSelect(category)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* BIKO Categories */}
                {filteredBIKO.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">
                      🚀 RouteServe Shortcuts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredBIKO.map((category) => (
                        <CategoryTile
                          key={category.id}
                          category={category}
                          isSelected={selectedCategory?.id === category.id}
                          onSelect={() => handleSelect(category)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No results */}
                {filteredEU.length === 0 && filteredBIKO.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      No categories found matching "{searchTerm}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* EU Categories Only */}
          <TabsContent value="eu" className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : filteredEU.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEU.map((category) => (
                  <CategoryTile
                    key={category.id}
                    category={category}
                    isSelected={selectedCategory?.id === category.id}
                    onSelect={() => handleSelect(category)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No EU categories found</p>
              </div>
            )}
          </TabsContent>

          {/* BIKO Categories Only */}
          <TabsContent value="biko" className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : filteredBIKO.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBIKO.map((category) => (
                  <CategoryTile
                    key={category.id}
                    category={category}
                    isSelected={selectedCategory?.id === category.id}
                    onSelect={() => handleSelect(category)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No RouteServe categories found</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Selected Category Info */}
        {selectedCategory && (
          <Alert>
            <AlertDescription>
              <strong>Selected:</strong> {selectedCategory.display_name}
              {selectedCategory.description && (
                <span className="block mt-1 text-sm text-muted-foreground">
                  {selectedCategory.description}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={!canGoNext}
          size="lg"
        >
          Next: Select Vehicle Type
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
