import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Download, Upload, Search, Filter, X, Map, List, SlidersHorizontal, ChevronDown, MapPin, Building2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useFacilities, useDeleteFacility, useBulkDeleteFacilities } from '@/hooks/useFacilities';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import { usePrograms } from '@/hooks/usePrograms';
import { FacilityFilters } from '@/lib/facility-validation';
import { Facility } from '@/types';
import { FacilitiesTable } from './components/FacilitiesTable';
import { FacilityDetailDialog } from './components/FacilityDetailDialog';
import { FacilityFormDialog } from './components/FacilityFormDialog';
import { EnhancedCSVImportDialog } from './components/EnhancedCSVImportDialog';
import { FacilitiesMapView } from './components/FacilitiesMapView';
import { FacilityMapFilterSidebar } from './components/FacilityMapFilterSidebar';
import { FacilityMapDetailPanel } from './components/FacilityMapDetailPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { exportFacilitiesToCSV, generateExportFilename, downloadCSVTemplate } from '@/lib/csv-export';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFacilitiesRealtime } from '@/hooks/useFacilitiesRealtime';
import { useStates } from '@/hooks/useAdminUnits';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CoordinateAuditPanel } from './components/CoordinateAuditPanel';

export default function StorefrontFacilities() {
  // Enable realtime updates
  useFacilitiesRealtime();

  // State for view mode
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  // State for table filters
  const [filters, setFilters] = useState<FacilityFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);

  // State for map-specific filters (separate from table filters)
  const [mapFilters, setMapFilters] = useState<FacilityFilters>({});
  const [mapSelectedFacility, setMapSelectedFacility] = useState<Facility | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mapSearchInput, setMapSearchInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State for dialogs
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | undefined>();

  // State for column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    warehouse_code: true,
    name: true,
    lga: true,
    ward: true,
    level_of_care: true,
    programme: true,
    coordinates: true,
  });

  // State for bulk actions
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Zones for dynamic filter
  const { zones } = useOperationalZones();
  
  // Programs for dynamic filter
  const { data: programsData } = usePrograms();
  const programs = programsData?.programs || [];

  // States from admin_units for dynamic filter
  const { data: adminStates = [] } = useStates();

  // Choose filters based on view mode
  const activeFilters = viewMode === 'map' ? mapFilters : { ...filters, search: searchTerm };

  // Query hooks - use appropriate filters based on view mode
  const { data, isLoading, error } = useFacilities(
    activeFilters,
    viewMode === 'table' ? page : undefined,
    viewMode === 'table' ? pageSize : 1000 // Load more for map view
  );
  const deleteFacility = useDeleteFacility();
  const bulkDelete = useBulkDeleteFacilities();

  const facilities = data?.facilities || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Also fetch all facilities for search suggestions (unfiltered)
  const { data: allFacilitiesData } = useFacilities({}, undefined, 1000);
  const allFacilities = allFacilitiesData?.facilities || [];

  // Generate search suggestions based on input
  const searchSuggestions = useMemo(() => {
    if (!mapSearchInput || mapSearchInput.length < 2) return [];

    const searchLower = mapSearchInput.toLowerCase();
    const suggestions: { type: 'facility' | 'lga' | 'ward'; value: string; facility?: Facility }[] = [];
    const seen = new Set<string>();

    // Add matching facilities
    allFacilities.forEach((f) => {
      if (f.name?.toLowerCase().includes(searchLower) ||
          f.warehouse_code?.toLowerCase().includes(searchLower)) {
        if (!seen.has(`facility-${f.id}`)) {
          suggestions.push({ type: 'facility', value: f.name, facility: f });
          seen.add(`facility-${f.id}`);
        }
      }
    });

    // Add matching LGAs
    allFacilities.forEach((f) => {
      if (f.lga?.toLowerCase().includes(searchLower)) {
        if (!seen.has(`lga-${f.lga}`)) {
          suggestions.push({ type: 'lga', value: f.lga });
          seen.add(`lga-${f.lga}`);
        }
      }
    });

    // Add matching wards
    allFacilities.forEach((f) => {
      if (f.ward?.toLowerCase().includes(searchLower)) {
        if (!seen.has(`ward-${f.ward}`)) {
          suggestions.push({ type: 'ward', value: f.ward });
          seen.add(`ward-${f.ward}`);
        }
      }
    });

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }, [mapSearchInput, allFacilities]);

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: { type: 'facility' | 'lga' | 'ward'; value: string; facility?: Facility }) => {
    if (suggestion.type === 'facility' && suggestion.facility) {
      // Select the facility on the map
      setMapSelectedFacility(suggestion.facility);
      setMapSearchInput(suggestion.value);
      setMapFilters(prev => ({ ...prev, search: suggestion.value }));
    } else if (suggestion.type === 'lga') {
      // Filter by LGA
      setMapFilters(prev => ({ ...prev, lga: suggestion.value }));
      setMapSearchInput('');
    } else if (suggestion.type === 'ward') {
      // Filter by ward
      setMapFilters(prev => ({ ...prev, ward: suggestion.value }));
      setMapSearchInput('');
    }
    setIsSearchOpen(false);
  };

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(0);
  };

  const handleFilterChange = (key: keyof FacilityFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setPage(0);
  };

  const handleRowClick = (facility: Facility) => {
    setSelectedFacility(facility);
    setIsDetailOpen(true);
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteFacility.mutateAsync(id);
  };

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedRows.size} facilities?`)) {
      await bulkDelete.mutateAsync(Array.from(selectedRows));
      setSelectedRows(new Set());
    }
  };

  const handleRowSelect = (id: string, selected: boolean) => {
    const newSet = new Set(selectedRows);
    if (selected) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedRows(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedRows(new Set(facilities.map(f => f.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined).length +
    (searchTerm ? 1 : 0);

  const handleExportSelected = () => {
    const selectedFacilities = facilities.filter((f) => selectedRows.has(f.id));
    if (selectedFacilities.length === 0) {
      toast.error('No facilities selected for export');
      return;
    }
    try {
      exportFacilitiesToCSV(selectedFacilities, visibleColumns, generateExportFilename());
      toast.success(`Exported ${selectedFacilities.length} facilities`);
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

  const handleExportAll = () => {
    if (facilities.length === 0) {
      toast.error('No facilities to export');
      return;
    }
    try {
      exportFacilitiesToCSV(facilities, visibleColumns, generateExportFilename());
      toast.success(`Exported ${facilities.length} facilities`);
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadCSVTemplate();
      toast.success('Template downloaded successfully');
    } catch (error: any) {
      toast.error(`Failed to download template: ${error.message}`);
    }
  };

  // Map-specific handlers
  const handleMapFacilitySelect = (facility: Facility | null) => {
    setMapSelectedFacility(facility);
  };

  const handleMapViewDetails = (facility: Facility) => {
    setSelectedFacility(facility);
    setIsDetailOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Facilities Management</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {total} total facilities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportAll}>
                Export All ({total})
              </DropdownMenuItem>
              {selectedRows.size > 0 && (
                <DropdownMenuItem onClick={handleExportSelected}>
                  Export Selected ({selectedRows.size})
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                Download Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCSVImportOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingFacility(undefined);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Facility
          </Button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="px-6 pb-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'table' | 'map')}>
          <TabsList>
            <TabsTrigger value="table" className="gap-2">
              <List className="h-4 w-4" />
              Table
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <Map className="h-4 w-4" />
              Map
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Coordinate Audit Panel — shown when facilities have geo issues */}
      <CoordinateAuditPanel
        facilities={facilities}
        onEditFacility={(f) => {
          setEditingFacility(f);
          setIsFormOpen(true);
        }}
      />

      {/* Content Area */}
      {viewMode === 'map' ? (
        // Map View with collapsible filter panel
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map Controls Bar */}
          <div className="px-6 pb-3 flex items-center gap-3">
            {/* Search Input with Autocomplete */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                ref={searchInputRef}
                placeholder="Search facilities, LGAs, wards..."
                value={mapSearchInput}
                onChange={(e) => {
                  setMapSearchInput(e.target.value);
                  setIsSearchOpen(e.target.value.length >= 2);
                  // Also update the actual filter for real-time filtering
                  setMapFilters(prev => ({
                    ...prev,
                    search: e.target.value || undefined
                  }));
                }}
                onFocus={() => setIsSearchOpen(mapSearchInput.length >= 2)}
                onBlur={() => {
                  // Delay close to allow click on suggestions
                  setTimeout(() => setIsSearchOpen(false), 200);
                }}
                className="pl-9"
              />

              {/* Autocomplete Suggestions Dropdown */}
              {isSearchOpen && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
                  <ScrollArea className="max-h-[300px]">
                    <div className="p-2">
                      {/* Facilities Section */}
                      {searchSuggestions.filter(s => s.type === 'facility').length > 0 && (
                        <div className="mb-2">
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Facilities</div>
                          {searchSuggestions
                            .filter(s => s.type === 'facility')
                            .map((suggestion, idx) => (
                              <button
                                key={`facility-${idx}`}
                                className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-muted rounded-md transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSuggestionSelect(suggestion);
                                }}
                              >
                                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{suggestion.value}</div>
                                  {suggestion.facility && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {suggestion.facility.lga}{suggestion.facility.lga && suggestion.facility.state && ', '}{suggestion.facility.state}
                                    </div>
                                  )}
                                </div>
                                <Navigation className="h-3 w-3 text-muted-foreground shrink-0" />
                              </button>
                            ))}
                        </div>
                      )}

                      {/* LGAs Section */}
                      {searchSuggestions.filter(s => s.type === 'lga').length > 0 && (
                        <div className="mb-2">
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Local Government Areas</div>
                          {searchSuggestions
                            .filter(s => s.type === 'lga')
                            .map((suggestion, idx) => (
                              <button
                                key={`lga-${idx}`}
                                className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-muted rounded-md transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSuggestionSelect(suggestion);
                                }}
                              >
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{suggestion.value}</div>
                                  <div className="text-xs text-muted-foreground">Filter by LGA</div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}

                      {/* Wards Section */}
                      {searchSuggestions.filter(s => s.type === 'ward').length > 0 && (
                        <div>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Wards</div>
                          {searchSuggestions
                            .filter(s => s.type === 'ward')
                            .map((suggestion, idx) => (
                              <button
                                key={`ward-${idx}`}
                                className="w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-muted rounded-md transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSuggestionSelect(suggestion);
                                }}
                              >
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{suggestion.value}</div>
                                  <div className="text-xs text-muted-foreground">Filter by Ward</div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Filter Button with Popover */}
            <Popover open={isFilterPanelOpen} onOpenChange={setIsFilterPanelOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "gap-2",
                    Object.values(mapFilters).filter(v => v !== undefined && v !== mapFilters.search).length > 0 && "border-primary text-primary"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {Object.values(mapFilters).filter(v => v !== undefined && v !== mapFilters.search).length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {Object.entries(mapFilters).filter(([k, v]) => v !== undefined && k !== 'search').length}
                    </Badge>
                  )}
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform",
                    isFilterPanelOpen && "rotate-180"
                  )} />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[400px] p-0"
                align="start"
                sideOffset={8}
              >
                <ScrollArea className="max-h-[70vh]">
                  <FacilityMapFilterSidebar
                    filters={mapFilters}
                    onFiltersChange={setMapFilters}
                    facilities={facilities}
                    facilitiesCount={facilities.length}
                  />
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Active filter badges (excluding search which is shown in input) */}
            {Object.entries(mapFilters)
              .filter(([key]) => key !== 'search')
              .map(([key, value]) =>
                value !== undefined ? (
                  <Badge key={key} variant="secondary" className="gap-1">
                    {key === 'state' && `State: ${value}`}
                    {key === 'lga' && `LGA: ${value}`}
                    {key === 'ward' && `Ward: ${value}`}
                    {key === 'warehouseCodeSearch' && `Code: ${value}`}
                    {key === 'storageCapacityMin' && `Storage ≥ ${value}`}
                    {key === 'storageCapacityMax' && `Storage ≤ ${value}`}
                    {key === 'capacityMin' && `Capacity ≥ ${value}`}
                    {key === 'capacityMax' && `Capacity ≤ ${value}`}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => setMapFilters(prev => ({ ...prev, [key]: undefined }))}
                    />
                  </Badge>
                ) : null
              )}

            {Object.entries(mapFilters).filter(([k, v]) => v !== undefined && k !== 'search').length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMapFilters(prev => ({ search: prev.search }))}
                className="text-muted-foreground"
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Map and Detail Panel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Map */}
            <div className="flex-1 relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                  <div className="text-center">
                    <Skeleton className="h-8 w-8 rounded-full mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading map...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-destructive">Error loading facilities: {error.message}</p>
                </div>
              ) : (
                <FacilitiesMapView
                  facilities={facilities}
                  selectedFacility={mapSelectedFacility}
                  onFacilitySelect={handleMapFacilitySelect}
                  onViewDetails={handleMapViewDetails}
                />
              )}
            </div>

            {/* Right Panel - Detail Panel (slides in when facility selected) */}
            <div className={cn(
              "border-l flex-shrink-0 overflow-hidden transition-all duration-300",
              mapSelectedFacility ? "w-96" : "w-0"
            )}>
              {mapSelectedFacility && (
                <FacilityMapDetailPanel
                  facility={mapSelectedFacility}
                  onClose={() => setMapSelectedFacility(null)}
                  onViewDetails={handleMapViewDetails}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        // Table View
        <div className="flex-1 flex flex-col px-6 pb-6 overflow-hidden">
          {/* Search and Filters Bar */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, LGA, ward..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filter Dropdowns */}
            <Select
              value={filters.state || ''}
              onValueChange={(value) => handleFilterChange('state', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {adminStates.map((state) => (
                  <SelectItem key={state.id} value={state.name}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.level_of_care || ''}
              onValueChange={(value) => handleFilterChange('level_of_care', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Level of Care" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Primary">Primary</SelectItem>
                <SelectItem value="Secondary">Secondary</SelectItem>
                <SelectItem value="Tertiary">Tertiary</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.service_zone || ''}
              onValueChange={(value) => handleFilterChange('service_zone', value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Service Zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.name}>{zone.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.programme || ''}
              onValueChange={(value) => handleFilterChange('programme', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Programme" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.name}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Column Visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries({
                  warehouse_code: 'Warehouse Code',
                  name: 'Name',
                  lga: 'LGA',
                  ward: 'Ward',
                  level_of_care: 'Level of Care',
                  programme: 'Programme',
                  funding_source: 'Funding Source',
                  service_zone: 'Service Zone',
                  coordinates: 'Coordinates',
                }).map(([key, label]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibleColumns[key]}
                    onCheckedChange={(checked) =>
                      setVisibleColumns(prev => ({ ...prev, [key]: checked }))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Clear ({activeFiltersCount})
              </Button>
            )}
          </div>

          {/* Active Filters Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {searchTerm && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchTerm}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleSearch('')}
                  />
                </Badge>
              )}
              {Object.entries(filters).map(([key, value]) =>
                value ? (
                  <Badge key={key} variant="secondary" className="gap-1">
                    {key}: {String(value)}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleFilterChange(key as keyof FacilityFilters, undefined)}
                    />
                  </Badge>
                ) : null
              )}
            </div>
          )}

          {/* Bulk Actions Toolbar */}
          {selectedRows.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
              <span className="text-sm font-medium">
                {selectedRows.size} {selectedRows.size === 1 ? 'facility' : 'facilities'} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRows(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDelete.isPending}
                >
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {/* Table View Content */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive">Error loading facilities: {error.message}</p>
              </div>
            ) : (
              <>
                <FacilitiesTable
                  facilities={facilities}
                  visibleColumns={visibleColumns}
                  selectedRows={selectedRows}
                  onRowClick={handleRowClick}
                  onRowSelect={handleRowSelect}
                  onSelectAll={handleSelectAll}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                {facilities.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      {activeFiltersCount > 0
                        ? 'No facilities match your filters'
                        : 'No facilities yet. Add your first facility to get started.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagination */}
          {facilities.length > 0 && (
            <div className="mt-4">
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={setPage}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      {selectedFacility && (
        <FacilityDetailDialog
          facility={selectedFacility}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <FacilityFormDialog
        facility={editingFacility}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
      />

      <EnhancedCSVImportDialog
        open={isCSVImportOpen}
        onOpenChange={setIsCSVImportOpen}
      />
    </div>
  );
}
