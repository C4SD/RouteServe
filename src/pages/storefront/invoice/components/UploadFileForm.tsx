import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Check, AlertTriangle, ChevronLeft, ArrowRight, Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
import { useWarehouses } from '@/hooks/useWarehouses';
import { useFacilities } from '@/hooks/useFacilities';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { Switch } from '@/components/ui/switch';
import type { InvoiceFormData } from '@/types/invoice';
import { ITEM_CATEGORIES } from '@/types/items';
import type { ItemCategory } from '@/types/items';
import type { InvoiceDisplayContext } from './PackagingStep';

type UploadStep = 'upload' | 'mapping' | 'preview';

interface ParsedInvoiceItem {
  row: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  serial_number?: string;
  category?: string;
  weight_kg?: number;
  volume_m3?: number;
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
  isValid: boolean;
  errors: string[];
}

interface ColumnMapping {
  description?: string;
  quantity?: string;
  unit_price?: string;
  serial_number?: string;
  category?: string;
  weight_kg?: string;
  volume_m3?: string;
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
}

const FIELD_DEFINITIONS = [
  { key: 'description', label: 'Description', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'unit_price', label: 'Unit Price', required: true },
  { key: 'serial_number', label: 'Serial Number', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'weight_kg', label: 'Weight (kg)', required: false },
  { key: 'volume_m3', label: 'Volume (m³)', required: false },
  { key: 'batch_number', label: 'Batch Number', required: false },
  { key: 'mfg_date', label: 'Mfg. Date', required: false },
  { key: 'expiry_date', label: 'Expiry Date', required: false },
] as const;

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const patterns: Record<keyof ColumnMapping, string[]> = {
    description: ['description', 'itemdescription', 'name', 'itemname', 'product', 'productname', 'item'],
    quantity: ['quantity', 'qty', 'amount', 'count'],
    unit_price: ['unitprice', 'price', 'cost', 'unitcost', 'rate'],
    serial_number: ['serialnumber', 'serialno', 'serial', 'sn', 'code'],
    category: ['category', 'cat', 'type', 'itemtype'],
    weight_kg: ['weightkg', 'weight', 'wt', 'weightinkg'],
    volume_m3: ['volumem3', 'volume', 'vol'],
    batch_number: ['batchnumber', 'batchno', 'batch', 'lot'],
    mfg_date: ['mfgdate', 'manufacturingdate', 'mfg', 'proddate'],
    expiry_date: ['expirydate', 'expiry', 'expdate', 'exp'],
  };

  for (const [field, fieldPatterns] of Object.entries(patterns)) {
    for (let i = 0; i < normalized.length; i++) {
      if (fieldPatterns.some(p => normalized[i].includes(p) || p.includes(normalized[i]))) {
        mapping[field as keyof ColumnMapping] = String(i);
        break;
      }
    }
  }

  return mapping;
}

interface UploadFileFormProps {
  onClose: () => void;
  onSubmitData?: (formData: InvoiceFormData, packagingRequired: boolean, context: InvoiceDisplayContext) => void;
  onPackagingRequiredChange?: (enabled: boolean) => void;
}

export function UploadFileForm({ onClose, onSubmitData, onPackagingRequiredChange }: UploadFileFormProps) {
  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [parsedItems, setParsedItems] = useState<ParsedInvoiceItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [packagingRequired, setPackagingRequired] = useState(false);

  const queryClient = useQueryClient();

  // Invalidate queries on mount to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['facilities'] });
    queryClient.invalidateQueries({ queryKey: ['warehouses'] });
  }, [queryClient]);

  const { data: warehousesData, isLoading: warehousesLoading } = useWarehouses();
  const { data: facilitiesData, isLoading: facilitiesLoading } = useFacilities();
  const createInvoice = useCreateInvoice();

  const warehouses = warehousesData?.warehouses || [];
  const facilities = facilitiesData?.facilities || [];

  const parseCSVFile = async (f: File): Promise<string[][]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(f, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data as string[][]),
        error: (error) => reject(new Error(`CSV parse error: ${error.message}`)),
      });
    });
  };

  const parseExcelFile = async (f: File): Promise<string[][]> => {
    const buffer = await f.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('Empty workbook');

    const data: string[][] = [];
    worksheet.eachRow((row) => {
      const values = (row.values as any[]).slice(1).map(cell => String(cell ?? '').trim());
      data.push(values);
    });
    return data;
  };

  const processFile = async (uploadedFile: File) => {
    setIsProcessing(true);
    setUploadProgress(0);
    setParseError(null);

    try {
      for (let i = 0; i <= 30; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 30));
        setUploadProgress(i);
      }

      const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
      let data: string[][];

      if (ext === 'csv') {
        data = await parseCSVFile(uploadedFile);
      } else if (ext === 'xlsx' || ext === 'xls') {
        data = await parseExcelFile(uploadedFile);
      } else {
        throw new Error('Unsupported format. Use CSV or Excel (.xlsx/.xls).');
      }

      for (let i = 30; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 30));
        setUploadProgress(i);
      }

      if (data.length < 2) {
        throw new Error('File must have a header row and at least one data row');
      }

      const fileHeaders = data[0].map((h, i) => h?.trim() || `Column ${String.fromCharCode(65 + i)}`);
      const fileData = data.slice(1).filter(row => row.some(cell => cell?.trim()));

      setHeaders(fileHeaders);
      setRawData(fileData);
      setColumnMapping(autoDetectMapping(fileHeaders));
      setStep('mapping');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFile = useCallback((uploadedFile: File) => {
    const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
    if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setFile(uploadedFile);
      processFile(uploadedFile);
    } else {
      setParseError('Unsupported file format. Please use CSV or Excel.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFile(files[0]);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFile(files[0]);
  }, [handleFile]);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === '__none__' ? undefined : value,
    }));
  };

  const validateAndParseItem = (row: string[], rowNum: number): ParsedInvoiceItem => {
    const getValue = (colIdx?: string): string => {
      if (!colIdx) return '';
      const idx = parseInt(colIdx, 10);
      return (idx >= 0 && idx < row.length) ? (row[idx]?.trim() || '') : '';
    };
    const getNum = (colIdx?: string): number | undefined => {
      const val = getValue(colIdx);
      if (!val) return undefined;
      const num = parseFloat(val.replace(/[₦,]/g, ''));
      return isNaN(num) ? undefined : num;
    };

    const description = getValue(columnMapping.description);
    const quantity = getNum(columnMapping.quantity) ?? 0;
    const unit_price = getNum(columnMapping.unit_price) ?? 0;
    const errors: string[] = [];

    if (!description) errors.push('Missing description');
    if (quantity <= 0) errors.push('Invalid quantity');
    if (unit_price < 0) errors.push('Invalid price');

    return {
      row: rowNum,
      description,
      quantity,
      unit_price,
      total_price: quantity * unit_price,
      serial_number: getValue(columnMapping.serial_number) || undefined,
      category: (() => {
        const raw = getValue(columnMapping.category);
        if (!raw) return undefined;
        const matched = ITEM_CATEGORIES.find(c => c.toLowerCase() === raw.toLowerCase());
        return matched || raw;
      })(),
      weight_kg: getNum(columnMapping.weight_kg),
      volume_m3: getNum(columnMapping.volume_m3),
      batch_number: getValue(columnMapping.batch_number) || undefined,
      mfg_date: getValue(columnMapping.mfg_date) || undefined,
      expiry_date: getValue(columnMapping.expiry_date) || undefined,
      isValid: errors.length === 0,
      errors,
    };
  };

  const applyMapping = () => {
    const items = rawData.map((row, index) => validateAndParseItem(row, index + 2));
    setParsedItems(items);
    setStep('preview');
  };

  const removeItem = (row: number) => {
    setParsedItems(prev => prev.filter(item => item.row !== row));
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setParsedItems([]);
    setUploadProgress(0);
    setParseError(null);
  };

  const requiredFieldsMapped = useMemo(() => {
    return FIELD_DEFINITIONS
      .filter(f => f.required)
      .every(f => columnMapping[f.key as keyof ColumnMapping] !== undefined);
  }, [columnMapping]);

  const validItems = parsedItems.filter(item => item.isValid);
  const invalidCount = parsedItems.filter(item => !item.isValid).length;

  const handleSubmit = async () => {
    if (validItems.length === 0 || !warehouseId || !facilityId) return;

    const formData: InvoiceFormData = {
      warehouse_id: warehouseId,
      facility_id: facilityId,
      notes: `Imported from ${file?.name || 'uploaded file'}`,
      items: validItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        serial_number: item.serial_number,
        category: item.category as ItemCategory | undefined,
        weight_kg: item.weight_kg,
        volume_m3: item.volume_m3,
        batch_number: item.batch_number,
        mfg_date: item.mfg_date,
        expiry_date: item.expiry_date,
      })),
    };

    if (packagingRequired && onSubmitData) {
      const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
      const selectedFacility = facilities.find(f => f.id === facilityId);
      const context: InvoiceDisplayContext = {
        sourceWarehouseName: selectedWarehouse?.name,
        sourceWarehouseCode: selectedWarehouse?.code,
        destinationFacilityName: selectedFacility?.name,
      };
      onSubmitData(formData, true, context);
      return;
    }

    try {
      await createInvoice.mutateAsync(formData);
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const downloadTemplate = () => {
    const csvContent = [
      'description,quantity,unit_price,serial_number,category,weight_kg,volume_m3,batch_number',
      'Paracetamol 500mg,100,150.00,SN-001,Tablet,5.0,0.02,BTH-001',
      'Amoxicillin 250mg,50,250.00,SN-002,Capsule,2.5,0.01,BTH-002',
      'Surgical Gloves,200,75.00,SN-003,Consummable,8.0,0.05,BTH-003',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice_items_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col max-h-[70vh]">
      <div className="flex-1 overflow-hidden">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file containing invoice line items.
            </p>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <span className="text-xs text-muted-foreground">
                Use this template as a reference for column headers
              </span>
            </div>

            <div
              className={cn(
                'h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors',
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
                parseError && 'border-destructive'
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('invoice-file-upload')?.click()}
            >
              <input
                id="invoice-file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
              <Upload className={cn('h-10 w-10 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
              {isDragging ? (
                <p className="text-primary font-medium">Drop the file here...</p>
              ) : (
                <>
                  <p className="font-medium">Drag and drop a file here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-2">Supports CSV, XLS, XLSX</p>
                </>
              )}
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>{parseError}</span>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing file...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">{file?.name}</span>
              </div>
              <Badge variant="secondary">{rawData.length} rows</Badge>
              <Badge variant="secondary">{headers.length} columns</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Mapping */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Map file columns to invoice fields
                </p>
                <ScrollArea className="h-[calc(70vh-200px)] border rounded-lg p-3">
                  <div className="space-y-3">
                    {FIELD_DEFINITIONS.map((field) => {
                      const isMapped = columnMapping[field.key as keyof ColumnMapping] !== undefined;
                      return (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-xs">
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          <Select
                            value={columnMapping[field.key as keyof ColumnMapping] ?? '__none__'}
                            onValueChange={(value) => handleMappingChange(field.key as keyof ColumnMapping, value)}
                          >
                            <SelectTrigger className={cn(
                              'h-8',
                              field.required && !isMapped && 'border-destructive'
                            )}>
                              <SelectValue placeholder="Select column...">
                                {isMapped
                                  ? headers[parseInt(columnMapping[field.key as keyof ColumnMapping]!, 10)]
                                  : 'Select column...'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                              <SelectItem value="__none__">-- Not mapped --</SelectItem>
                              {headers.map((header, index) => (
                                <SelectItem key={`col-${index}`} value={String(index)}>
                                  {String.fromCharCode(65 + index)}: {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Preview */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">File Preview</p>
                <div className="h-[calc(70vh-200px)] border rounded-lg overflow-auto">
                  <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs w-10">#</TableHead>
                            {headers.map((header, i) => (
                              <TableHead key={i} className="text-xs whitespace-nowrap min-w-[80px]">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground">
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  <span className="truncate">{header}</span>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rawData.slice(0, 8).map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                              {row.map((cell, j) => (
                                <TableCell key={j} className="text-xs py-1.5 truncate max-w-[120px]">
                                  {cell || <span className="text-muted-foreground">-</span>}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                </div>
                {rawData.length > 8 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    Showing 8 of {rawData.length} rows
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">{file?.name}</span>
                <Badge variant="secondary">{parsedItems.length} items</Badge>
              </div>
              <div className="flex items-center gap-2">
                {validItems.length > 0 && (
                  <Badge className="bg-green-100 text-green-800">
                    <Check className="h-3 w-3 mr-1" />
                    {validItems.length} valid
                  </Badge>
                )}
                {invalidCount > 0 && (
                  <Badge className="bg-red-100 text-red-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {invalidCount} invalid
                  </Badge>
                )}
              </div>
            </div>

            {/* Warehouse/Facility selects */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Source Warehouse *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select warehouse..." />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} {wh.code ? `(${wh.code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destination Facility *</Label>
                <Select value={facilityId} onValueChange={setFacilityId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select facility..." />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {facilities.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
              <div>
                <Label className="text-sm font-semibold cursor-pointer">Packaging Required</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Needs packaging before dispatch</p>
              </div>
              <Switch
                checked={packagingRequired}
                onCheckedChange={(checked) => {
                  setPackagingRequired(checked);
                  onPackagingRequiredChange?.(checked);
                }}
              />
            </div>

            <ScrollArea className="h-[35vh] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[70px] text-right">Qty</TableHead>
                    <TableHead className="w-[90px] text-right">Unit Price</TableHead>
                    <TableHead className="w-[90px] text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item) => (
                    <TableRow key={item.row} className={!item.isValid ? 'bg-red-50' : ''}>
                      <TableCell>
                        {item.isValid ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{item.description || '-'}</span>
                          {item.errors.length > 0 && (
                            <p className="text-xs text-red-600 mt-0.5">{item.errors.join(', ')}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {item.unit_price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {item.total_price.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.row)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {invalidCount > 0 && (
              <p className="text-xs text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Invalid items will be excluded from the invoice.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between gap-2 pt-4 border-t mt-4">
        <div>
          {step === 'mapping' && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          {step === 'preview' && (
            <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Mapping
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          {step === 'mapping' && (
            <Button onClick={applyMapping} disabled={!requiredFieldsMapped}>
              Continue
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 'preview' && (
            <Button
              onClick={handleSubmit}
              disabled={validItems.length === 0 || !warehouseId || !facilityId || createInvoice.isPending}
            >
              {createInvoice.isPending
                ? 'Creating...'
                : packagingRequired
                  ? `Next: Define Packaging →`
                  : `Create Invoice (${validItems.length} items)`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
