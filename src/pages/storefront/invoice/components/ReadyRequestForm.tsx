import React, { useState, useEffect } from 'react';
import { FileText, Loader2, CheckCircle2, MapPin, Calendar, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useReadyRequisitions, useCreateInvoice } from '@/hooks/useInvoices';
import { useRequisition } from '@/hooks/useRequisitions';
import { useWarehouses } from '@/hooks/useWarehouses';
import type { Invoice, InvoiceFormData } from '@/types/invoice';
import type { InvoiceDisplayContext } from './PackagingStep';

interface EditableLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  weight_kg?: number;
  volume_m3?: number;
}

let nextItemId = 0;
function generateTempId() {
  return `temp-${++nextItemId}`;
}

interface ReadyRequestFormProps {
  onClose: () => void;
  preSelectedRequisitionId?: string;
  editingInvoice?: Invoice;
  onSubmitData?: (formData: InvoiceFormData, packagingRequired: boolean, context: InvoiceDisplayContext) => void;
  onPackagingRequiredChange?: (enabled: boolean) => void;
}

export function ReadyRequestForm({ onClose, preSelectedRequisitionId, editingInvoice, onSubmitData, onPackagingRequiredChange }: ReadyRequestFormProps) {
  const [selectedReqId, setSelectedReqId] = useState<string | null>(preSelectedRequisitionId || null);
  const [warehouseId, setWarehouseId] = useState(editingInvoice?.warehouse_id ?? '');
  const [editableItems, setEditableItems] = useState<EditableLineItem[]>([]);
  const [packagingRequired, setPackagingRequired] = useState(editingInvoice?.packaging_required ?? false);

  const { data: requisitions, isLoading: reqLoading } = useReadyRequisitions();
  const { data: selectedReq, isLoading: detailLoading } = useRequisition(selectedReqId || '');
  const { data: warehousesData } = useWarehouses();
  const createInvoice = useCreateInvoice();

  const warehouses = warehousesData?.warehouses || [];

  // Populate editable items when requisition loads
  useEffect(() => {
    if (selectedReq?.items && selectedReq.items.length > 0) {
      setEditableItems(
        selectedReq.items.map(item => ({
          id: item.id || generateTempId(),
          description: item.item_name,
          quantity: item.quantity,
          unit: item.unit || '',
          unit_price: item.unit_price || 0,
          weight_kg: item.weight_kg ?? undefined,
          volume_m3: item.volume_m3 ?? undefined,
        }))
      );
    } else if (selectedReq && (!selectedReq.items || selectedReq.items.length === 0)) {
      setEditableItems([]);
    }
  }, [selectedReq]);

  // Pre-fill warehouse from requisition
  useEffect(() => {
    if (selectedReq?.warehouse_id && !warehouseId) {
      setWarehouseId(selectedReq.warehouse_id);
    }
  }, [selectedReq?.warehouse_id]);

  const updateItem = (id: string, field: keyof EditableLineItem, value: string | number) => {
    setEditableItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (id: string) => {
    setEditableItems(prev => prev.filter(item => item.id !== id));
  };

  const addItem = () => {
    setEditableItems(prev => [
      ...prev,
      { id: generateTempId(), description: '', quantity: 1, unit: '', unit_price: 0 },
    ]);
  };

  const validItems = editableItems.filter(item => item.description.trim() && item.quantity > 0);
  const totalValue = validItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (!selectedReq || !warehouseId || validItems.length === 0) return;

    const formData: InvoiceFormData = {
      requisition_id: selectedReq.id,
      warehouse_id: warehouseId,
      facility_id: selectedReq.facility_id,
      notes: `Created from requisition ${selectedReq.requisition_number}`,
      items: validItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
      })),
    };

    if (onSubmitData) {
      const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
      const context: InvoiceDisplayContext = {
        sourceWarehouseName: selectedWarehouse?.name,
        sourceWarehouseCode: selectedWarehouse?.code,
        destinationFacilityName: selectedReq.facility?.name,
        destinationFacilityCode: (selectedReq.facility as any)?.code,
        program: selectedReq.program,
        referenceNumber: selectedReq.requisition_number,
      };
      onSubmitData(formData, packagingRequired, context);
      return;
    }

    try {
      await createInvoice.mutateAsync(formData);
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const canSubmit = !!selectedReqId && !!warehouseId && validItems.length > 0;

  const handlePackagingToggle = (enabled: boolean) => {
    setPackagingRequired(enabled);
    onPackagingRequiredChange?.(enabled);

    if (!enabled || !onSubmitData || !selectedReq || !warehouseId) return;

    // Toggle is only rendered when selectedReqId + editableItems + warehouseId are set,
    // so we can navigate immediately without re-checking those conditions.
    const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
    const formData: InvoiceFormData = {
      requisition_id: selectedReq.id,
      warehouse_id: warehouseId,
      facility_id: selectedReq.facility_id,
      notes: `Created from requisition ${selectedReq.requisition_number}`,
      items: editableItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
      })),
    };
    const context: InvoiceDisplayContext = {
      sourceWarehouseName: selectedWarehouse?.name,
      sourceWarehouseCode: selectedWarehouse?.code,
      destinationFacilityName: selectedReq.facility?.name,
      destinationFacilityCode: (selectedReq.facility as any)?.code,
      program: selectedReq.program,
      referenceNumber: selectedReq.requisition_number,
    };
    onSubmitData(formData, true, context);
  };

  return (
    <div className="flex flex-col max-h-[70vh]">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-6 pb-4">
          {/* Requisition Selection - hide when pre-selected */}
          {!preSelectedRequisitionId && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Select Approved Requisition
              </h3>

              {reqLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !requisitions || requisitions.length === 0 ? (
                <div className="h-48 border rounded-lg flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No approved requisitions available</p>
                    <p className="text-sm">Requisitions must be approved before they can be invoiced</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-auto border rounded-lg p-2">
                  {requisitions.map((req: any) => (
                    <div
                      key={req.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedReqId === req.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      )}
                      onClick={() => setSelectedReqId(req.id)}
                    >
                      <div className="flex items-center gap-3">
                        {selectedReqId === req.id ? (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm font-mono">
                            {req.requisition_number || req.id.slice(0, 8)}
                          </p>
                          {req.facility && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {req.facility.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {req.priority && (
                          <Badge variant="outline" className="text-xs">
                            {req.priority}
                          </Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pre-selected requisition info banner */}
          {preSelectedRequisitionId && selectedReq && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">
                Creating invoice from requisition{' '}
                <span className="font-mono">{selectedReq.requisition_number || selectedReq.id.slice(0, 8)}</span>
              </p>
              {selectedReq.facility && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {selectedReq.facility.name}
                </p>
              )}
            </div>
          )}

          {/* Editable Items */}
          {selectedReqId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Invoice Items
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Item
                </Button>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : editableItems.length === 0 ? (
                <div className="text-center py-6 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">No items yet</p>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Item
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-[90px]">Qty</TableHead>
                        <TableHead className="w-[110px]">Unit Price</TableHead>
                        <TableHead className="w-[90px] text-right">Total</TableHead>
                        <TableHead className="w-[40px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editableItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={e => updateItem(item.id, 'description', e.target.value)}
                              placeholder="Item description"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                              className="h-8 text-sm w-[80px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unit_price}
                              onChange={e => updateItem(item.id, 'unit_price', Number(e.target.value))}
                              className="h-8 text-sm w-[100px]"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {(item.unit_price * item.quantity).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Summary */}
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-t text-sm">
                    <span className="text-muted-foreground">{validItems.length} item(s)</span>
                    <span className="font-medium font-mono">
                      Total: {totalValue.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Warehouse Selection */}
          {selectedReqId && editableItems.length > 0 && (
            <div className="space-y-2">
              <Label>Source Warehouse *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(wh => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name} {wh.code ? `(${wh.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Packaging Required */}
          {selectedReqId && editableItems.length > 0 && warehouseId && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
              <div>
                <Label htmlFor="packaging-required" className="text-sm font-semibold cursor-pointer">
                  Packaging Required
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Consignment needs physical packaging before dispatch
                </p>
              </div>
              <Switch
                id="packaging-required"
                checked={packagingRequired}
                onCheckedChange={handlePackagingToggle}
              />
            </div>
          )}
        </div>
      </ScrollArea>

      <form id="ready-request-form" onSubmit={handleFormSubmit} className="hidden" />
    </div>
  );
}
