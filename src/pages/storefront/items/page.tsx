import { useState, useMemo } from 'react';
import {
  Plus,
  Upload,
  Search,
  Filter,
  Package,
  AlertTriangle,
  TrendingDown,
  LayoutGrid,
  List,
  Table2,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useItems, useItemsStats } from '@/hooks/useItems';
import type { Item, ItemCategory, ItemFilters, ItemProgram } from '@/types/items';
import { ITEM_CATEGORIES } from '@/types/items';
import { useProgrammeCategories } from '@/hooks/useProgrammeCategories';
import { ItemsTable } from './components/ItemsTable';
import { ItemsCardView } from './components/ItemsCardView';
import { ItemsListView } from './components/ItemsListView';
import { ItemDetailPanel } from './components/ItemDetailPanel';
import { ItemFormDialog } from './components/ItemFormDialog';
import { UploadItemsDialog } from './components/UploadItemsDialog';

type ViewMode = 'table' | 'cards' | 'list';

export default function ItemsPage() {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Filters state
  const [filters, setFilters] = useState<ItemFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Selection state
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>();

  // Filter popover state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Debounced search
  const activeFilters = useMemo(() => ({
    ...filters,
    search: searchTerm || undefined,
  }), [filters, searchTerm]);

  // Data fetching
  const { data, isLoading } = useItems(activeFilters, page, pageSize);
  const { data: stats } = useItemsStats();
  const { data: programmeCategories = [] } = useProgrammeCategories();

  const items = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.program) count++;
    if (filters.low_stock) count++;
    if (filters.expiring_soon) count++;
    if (filters.expired) count++;
    if (filters.min_stock !== undefined) count++;
    if (filters.max_stock !== undefined) count++;
    return count;
  }, [filters]);

  // Handlers
  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedItem(null);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(undefined);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingItem(undefined);
  };

  const handleCategoryChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      category: value === 'all' ? undefined : value as ItemCategory,
    }));
    setPage(0);
  };

  const handleProgramChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      program: value === 'all' ? undefined : value as ItemProgram,
    }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({});
    setPage(0);
  };

  // View component props
  const viewProps = {
    items,
    isLoading,
    onItemClick: handleItemClick,
    onEdit: handleEdit,
    selectedItemId: selectedItem?.id,
    page,
    totalPages,
    totalItems,
    onPageChange: setPage,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Items</h1>
              <p className="text-sm text-muted-foreground">
                Manage inventory and stock information
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Items
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-2xl font-bold">{stats?.total_items || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">
                  {formatCurrency(stats?.total_value || 0)}
                </span>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setFilters(prev => ({ ...prev, low_stock: !prev.low_stock }));
                setPage(0);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Low Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                  <span className="text-2xl font-bold">{stats?.low_stock_count || 0}</span>
                  {filters.low_stock && (
                    <Badge variant="secondary" className="ml-auto">Active</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setFilters(prev => ({ ...prev, expiring_soon: !prev.expiring_soon }));
                setPage(0);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Expiring Soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold">{stats?.expiring_soon_count || 0}</span>
                  {filters.expiring_soon && (
                    <Badge variant="secondary" className="ml-auto">Active</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>

            {/* Category Filter */}
            <Select
              value={filters.category || 'all'}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ITEM_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Program Filter */}
            <Select
              value={filters.program || 'all'}
              onValueChange={handleProgramChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programmeCategories.map((p) => (
                  <SelectItem key={p.id} value={p.code}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Advanced Filters Popover */}
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Filters</h4>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilters({});
                          setPage(0);
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {/* Stock Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Stock Status</Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={filters.low_stock ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({ ...prev, low_stock: !prev.low_stock }));
                          setPage(0);
                        }}
                      >
                        Low Stock (≤10)
                      </Badge>
                      <Badge
                        variant={filters.out_of_stock ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({ ...prev, out_of_stock: !prev.out_of_stock }));
                          setPage(0);
                        }}
                      >
                        Out of Stock
                      </Badge>
                    </div>
                  </div>

                  {/* Stock Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Stock Range</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.min_stock ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                          setFilters(prev => ({ ...prev, min_stock: val }));
                          setPage(0);
                        }}
                        className="w-24"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.max_stock ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                          setFilters(prev => ({ ...prev, max_stock: val }));
                          setPage(0);
                        }}
                        className="w-24"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Expiry Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Expiry Status</Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={filters.expiring_soon ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({ ...prev, expiring_soon: !prev.expiring_soon, expired: undefined }));
                          setPage(0);
                        }}
                      >
                        Expiring in 30 days
                      </Badge>
                      <Badge
                        variant={filters.expired ? 'destructive' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFilters(prev => ({ ...prev, expired: !prev.expired, expiring_soon: undefined }));
                          setPage(0);
                        }}
                      >
                        Expired
                      </Badge>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Active filter badges */}
            {(searchTerm || activeFilterCount > 0) && (
              <div className="flex items-center gap-2 flex-wrap">
                {filters.program && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => setFilters(prev => ({ ...prev, program: undefined }))}
                  >
                    {filters.program}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {filters.low_stock && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => setFilters(prev => ({ ...prev, low_stock: undefined }))}
                  >
                    Low Stock
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {filters.expiring_soon && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => setFilters(prev => ({ ...prev, expiring_soon: undefined }))}
                  >
                    Expiring Soon
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {filters.expired && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => setFilters(prev => ({ ...prev, expired: undefined }))}
                  >
                    Expired
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  Clear All
                </Button>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* View Mode Toggle */}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as ViewMode)}
              className="border rounded-md"
            >
              <ToggleGroupItem value="table" aria-label="Table view" className="px-3">
                <Table2 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view" className="px-3">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Cards view" className="px-3">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* View */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'table' && <ItemsTable {...viewProps} />}
          {viewMode === 'list' && <ItemsListView {...viewProps} />}
          {viewMode === 'cards' && <ItemsCardView {...viewProps} />}
        </div>

        {/* Detail Panel */}
        {isDetailOpen && selectedItem && (
          <ItemDetailPanel
            item={selectedItem}
            onClose={handleCloseDetail}
            onEdit={() => handleEdit(selectedItem)}
          />
        )}
      </div>

      {/* Form Dialog */}
      <ItemFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        item={editingItem}
      />

      {/* Upload Dialog */}
      <UploadItemsDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
      />
    </div>
  );
}
