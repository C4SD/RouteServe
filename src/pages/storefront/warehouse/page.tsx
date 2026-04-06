import { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Warehouse as WarehouseIcon, MapPin, Package, TrendingUp, List, GitBranch, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWarehouses, useWarehousesStats } from '@/hooks/useWarehouses';
import { useInventoryTransfers } from '@/hooks/useInventoryTransfers';
import type { Warehouse, WarehouseFilters, TransferStatus } from '@/types/warehouse';
import { WarehouseTable } from './components/WarehouseTable';
import { WarehouseTreeView } from './components/WarehouseTreeView';
import { WarehouseDetailPanel } from './components/WarehouseDetailPanel';
import { WarehouseFormDialog } from './components/WarehouseFormDialog';
import { TransferList } from './components/TransferList';
import { TransferDetailPanel } from './components/TransferDetailPanel';
import { TransferFormDialog } from './components/TransferFormDialog';

export default function WarehousePage() {
  // Main tab
  const [activeTab, setActiveTab] = useState<'warehouses' | 'transfers'>('warehouses');

  // Warehouse filters
  const [filters, setFilters] = useState<WarehouseFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // View state
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');

  // Warehouse selection
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Warehouse form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | undefined>();
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // Transfer state
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState<TransferStatus | ''>('');
  const [transferPage, setTransferPage] = useState(0);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false);

  // Active filters
  const activeFilters = useMemo(() => ({
    ...filters,
    search: searchTerm || undefined,
  }), [filters, searchTerm]);

  // Data fetching
  const { data, isLoading } = useWarehouses(activeFilters, page, pageSize);
  const { data: allData } = useWarehouses(undefined, undefined, 500);
  const { data: stats } = useWarehousesStats();

  const transferFilters = useMemo(() => ({
    search: transferSearchTerm || undefined,
    status: transferStatusFilter || undefined,
  }), [transferSearchTerm, transferStatusFilter]);

  const { data: transfersData, isLoading: transfersLoading } = useInventoryTransfers(
    transferFilters,
    transferPage,
    pageSize
  );

  const warehouses = data?.warehouses || [];
  const allWarehouses = allData?.warehouses || [];
  const totalWarehouses = data?.total || 0;
  const totalPages = Math.ceil(totalWarehouses / pageSize);

  const transfers = transfersData?.transfers || [];
  const totalTransfers = transfersData?.total || 0;
  const transferTotalPages = Math.ceil(totalTransfers / pageSize);

  // Warehouse handlers
  const handleWarehouseClick = useCallback((warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsDetailOpen(true);
    setSelectedTransferId(null);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedWarehouse(null);
  }, []);

  const handleEdit = useCallback((warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setDefaultParentId(null);
    setIsFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingWarehouse(undefined);
    setDefaultParentId(null);
    setIsFormOpen(true);
  }, []);

  const handleAddChild = useCallback((parentId: string) => {
    setEditingWarehouse(undefined);
    setDefaultParentId(parentId);
    setIsFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingWarehouse(undefined);
    setDefaultParentId(null);
  }, []);

  const handleSelectWarehouseById = useCallback((id: string) => {
    const w = allWarehouses.find(w => w.id === id);
    if (w) {
      setSelectedWarehouse(w);
      setIsDetailOpen(true);
    }
  }, [allWarehouses]);

  // Transfer handlers
  const handleTransferClick = useCallback((transfer: any) => {
    setSelectedTransferId(transfer.id);
    setIsDetailOpen(false);
    setSelectedWarehouse(null);
  }, []);

  const handleCloseTransferDetail = useCallback(() => {
    setSelectedTransferId(null);
  }, []);

  const formatCapacity = (value?: number) => {
    if (!value) return '-';
    return `${value.toLocaleString()} m³`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b bg-background">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Warehouse</h1>
              <p className="text-sm text-muted-foreground">
                Manage warehouses, storage nodes, and inventory transfers
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'transfers' && (
                <Button variant="outline" onClick={() => setIsTransferFormOpen(true)}>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  New Transfer
                </Button>
              )}
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Warehouse
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Warehouses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="h-4 w-4 text-primary" />
                  <span className="text-2xl font-bold">{stats?.total_warehouses || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">{stats?.active_warehouses || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Capacity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">
                    {formatCapacity(stats?.total_capacity_m3)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <span className="text-2xl font-bold">
                      {(stats?.utilization_pct || 0).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={stats?.utilization_pct || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center gap-4">
              <TabsList>
                <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
                <TabsTrigger value="transfers">Transfers</TabsTrigger>
              </TabsList>

              {/* Warehouse-specific controls */}
              {activeTab === 'warehouses' && (
                <>
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search warehouses..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(0);
                      }}
                      className="pl-9"
                    />
                  </div>

                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setPage(0);
                      }}
                    >
                      Clear
                    </Button>
                  )}

                  <div className="ml-auto flex items-center gap-1 border rounded-lg p-0.5">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setViewMode('table')}
                    >
                      <List className="h-4 w-4 mr-1.5" />
                      Table
                    </Button>
                    <Button
                      variant={viewMode === 'tree' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setViewMode('tree')}
                    >
                      <GitBranch className="h-4 w-4 mr-1.5" />
                      Tree
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Tabs>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Main Content */}
        <div className="flex-1 min-w-0 overflow-auto">
          {activeTab === 'warehouses' ? (
            viewMode === 'table' ? (
              <WarehouseTable
                warehouses={warehouses}
                allWarehouses={allWarehouses}
                isLoading={isLoading}
                onWarehouseClick={handleWarehouseClick}
                onEdit={handleEdit}
                selectedWarehouseId={selectedWarehouse?.id}
                page={page}
                totalPages={totalPages}
                totalWarehouses={totalWarehouses}
                onPageChange={setPage}
                pageSize={pageSize}
              />
            ) : (
              <WarehouseTreeView
                onAddChild={handleAddChild}
                onEdit={handleEdit}
                onSelect={handleWarehouseClick}
                selectedWarehouseId={selectedWarehouse?.id}
                searchTerm={searchTerm}
              />
            )
          ) : (
            <TransferList
              transfers={transfers}
              isLoading={transfersLoading}
              total={totalTransfers}
              page={transferPage}
              totalPages={transferTotalPages}
              pageSize={pageSize}
              searchTerm={transferSearchTerm}
              statusFilter={transferStatusFilter}
              onSearchChange={(term) => { setTransferSearchTerm(term); setTransferPage(0); }}
              onStatusFilterChange={(status) => { setTransferStatusFilter(status); setTransferPage(0); }}
              onPageChange={setTransferPage}
              onTransferClick={handleTransferClick}
              selectedTransferId={selectedTransferId || undefined}
            />
          )}
        </div>

        {/* Detail Panels */}
        {isDetailOpen && selectedWarehouse && (
          <WarehouseDetailPanel
            warehouse={selectedWarehouse}
            onClose={handleCloseDetail}
            onEdit={() => handleEdit(selectedWarehouse)}
            onSelectWarehouse={handleSelectWarehouseById}
            onAddStore={handleAddChild}
          />
        )}

        {selectedTransferId && (
          <TransferDetailPanel
            transferId={selectedTransferId}
            onClose={handleCloseTransferDetail}
          />
        )}
      </div>

      {/* Dialogs */}
      <WarehouseFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        warehouse={editingWarehouse}
        defaultParentId={defaultParentId}
      />

      <TransferFormDialog
        open={isTransferFormOpen}
        onOpenChange={setIsTransferFormOpen}
      />
    </div>
  );
}
