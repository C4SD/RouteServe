import { useState, useMemo } from 'react';
import { Loader2, FileText, CheckCircle, XCircle, ChevronLeft, ArrowRight, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCreateRequisition } from '@/hooks/useRequisitions';
import { useFacilities } from '@/hooks/useFacilities';
import { useWarehouses } from '@/hooks/useWarehouses';
import { RequisitionPriority } from '@/types/requisitions';
import { FileUploadZone } from './components/FileUploadZone';
import { ParsedItemsPreview } from './components/ParsedItemsPreview';
import { BatchSizeWarning } from './components/BatchSizeWarning';
import { CSVTemplateButton } from './components/CSVTemplateButton';
import { ParsedRequisitionItem } from '@/lib/csvParser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadRequisitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadStep = 'upload' | 'mapping' | 'preview' | 'details';

interface ColumnMapping {
  item_name?: string;
  quantity?: string;
  unit?: string;
  weight_kg?: string;
  volume_m3?: string;
  temperature_required?: string;
  handling_instructions?: string;
}

const FIELD_DEFINITIONS = [
  { key: 'item_name', label: 'Item Name', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'unit', label: 'Unit', required: false },
  { key: 'weight_kg', label: 'Weight (kg)', required: false },
  { key: 'volume_m3', label: 'Volume (m³)', required: false },
  { key: 'temperature_required', label: 'Temp. Control', required: false },
  { key: 'handling_instructions', label: 'Instructions', required: false },
] as const;

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const patterns: Record<keyof ColumnMapping, string[]> = {
    item_name: ['itemname', 'item', 'name', 'product', 'productname', 'description', 'itemdescription'],
    quantity: ['quantity', 'qty', 'amount', 'count', 'units'],
    unit: ['unit', 'uom', 'unitofmeasure', 'measurement'],
    weight_kg: ['weightkg', 'weight', 'wt', 'weightinkg', 'grossweight', 'mass'],
    volume_m3: ['volumem3', 'volume', 'vol', 'cubicmeter', 'cbm', 'size'],
    temperature_required: ['temperaturerequired', 'temprequired', 'tempcontrol', 'coldchain', 'refrigerated', 'temperature'],
    handling_instructions: ['handlinginstructions', 'instructions', 'handling', 'notes', 'specialinstructions'],
  };

  for (const [field, fieldPatterns] of Object.entries(patterns)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const normalizedHeader = normalizedHeaders[i];
      if (fieldPatterns.some(p => normalizedHeader.includes(p) || p.includes(normalizedHeader))) {
        mapping[field as keyof ColumnMapping] = String(i);
        break;
      }
    }
  }

  return mapping;
}

export function UploadRequisitionDialog({ open, onOpenChange }: UploadRequisitionDialogProps) {
  const { data: facilitiesData } = useFacilities();
  const { data: warehousesData } = useWarehouses();
  const createRequisition = useCreateRequisition();

  const facilities = facilitiesData?.facilities || [];
  const warehouses = warehousesData?.warehouses || [];

  const [step, setStep] = useState<UploadStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedRequisitionItem[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [showBatchWarning, setShowBatchWarning] = useState(false);

  // Column mapping state
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [skippedFields, setSkippedFields] = useState<Set<string>>(new Set());

  // Form state
  const [facilityId, setFacilityId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [priority, setPriority] = useState<RequisitionPriority>('medium');
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Parse CSV to raw data
  const parseCSVToRaw = async (file: File): Promise<string[][]> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  // Parse Excel to raw data
  const parseExcelToRaw = async (file: File): Promise<string[][]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    const rawData: string[][] = [];

    worksheet.eachRow((row) => {
      const rowValues = row.values as any[];
      // ExcelJS row.values is 1-indexed with undefined at 0, so we slice from index 1
      const normalizedRow = rowValues.slice(1).map(cell => String(cell ?? '').trim());
      rawData.push(normalizedRow);
    });

    return rawData;
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setParseErrors([]);
    setParseWarnings([]);

    try {
      let data: string[][] = [];

      if (file.name.endsWith('.csv')) {
        data = await parseCSVToRaw(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        data = await parseExcelToRaw(file);
      } else if (file.name.endsWith('.pdf')) {
        // Parse PDF file via Edge Function (legacy mode)
        const formData = new FormData();
        formData.append('file', file);

        const { data: pdfData, error } = await supabase.functions.invoke('parse-requisition-pdf', {
          body: formData,
        });

        if (error) {
          setParseErrors([`Failed to parse PDF: ${error.message}`]);
          toast.error('Failed to parse PDF file');
          setIsProcessing(false);
          return;
        } else if (pdfData.success && pdfData.items) {
          setParsedItems(pdfData.items);
          setParseWarnings(pdfData.warnings || []);
          setStep('preview');
          toast.success(`Successfully parsed ${pdfData.items.length} items from PDF`);
          setIsProcessing(false);
          return;
        } else {
          setParseErrors(['No items found in PDF file']);
          toast.error('No items found in PDF');
          setIsProcessing(false);
          return;
        }
      } else {
        setParseErrors(['Unsupported file format. Please use CSV or Excel files.']);
        setIsProcessing(false);
        return;
      }

      if (data.length < 2) {
        setParseErrors(['File must have a header row and at least one data row']);
        setIsProcessing(false);
        return;
      }

      // Extract headers and data
      const rawHeaders = data[0];
      const fileHeaders = rawHeaders.map((h, i) => {
        const trimmed = h?.trim();
        if (trimmed) return trimmed;
        const colLetter = i < 26
          ? String.fromCharCode(65 + i)
          : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
        return `Column ${colLetter}`;
      });

      const fileData = data.slice(1).filter(row => row.some(cell => cell?.trim()));

      setHeaders(fileHeaders);
      setRawData(fileData);

      // Auto-detect column mapping
      const autoMapping = autoDetectMapping(fileHeaders);
      setColumnMapping(autoMapping);

      setStep('mapping');
      toast.success(`File loaded with ${fileData.length} rows`);
    } catch (error) {
      console.error('File parsing error:', error);
      setParseErrors([`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      toast.error('Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === '__none__' ? undefined : value,
    }));
  };

  const toggleSkippedField = (fieldKey: string) => {
    setSkippedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  };

  const applyMapping = () => {
    const items: ParsedRequisitionItem[] = rawData.map((row) => {
      const getValue = (colIndexStr?: string): string => {
        if (!colIndexStr) return '';
        const index = parseInt(colIndexStr, 10);
        if (isNaN(index) || index < 0 || index >= row.length) return '';
        return row[index]?.trim() || '';
      };

      const getNumericValue = (colIndexStr?: string): number | undefined => {
        const val = getValue(colIndexStr);
        if (!val) return undefined;
        const num = parseFloat(val.replace(/[,]/g, ''));
        return isNaN(num) ? undefined : num;
      };

      const getBooleanValue = (colIndexStr?: string): boolean => {
        const val = getValue(colIndexStr).toLowerCase();
        return val === 'true' || val === 'yes' || val === '1' || val === 'y';
      };

      return {
        item_name: getValue(columnMapping.item_name) || (skippedFields.has('item_name') ? 'Pending' : ''),
        quantity: getNumericValue(columnMapping.quantity) ?? (skippedFields.has('quantity') ? 1 : 0),
        unit: getValue(columnMapping.unit) || 'units',
        weight_kg: getNumericValue(columnMapping.weight_kg),
        volume_m3: getNumericValue(columnMapping.volume_m3),
        temperature_required: getBooleanValue(columnMapping.temperature_required),
        handling_instructions: getValue(columnMapping.handling_instructions) || undefined,
      };
    }).filter(item => item.item_name && item.quantity > 0);

    setParsedItems(items);
    setStep('preview');
  };

  const requiredFieldsMapped = useMemo(() => {
    const requiredFields = FIELD_DEFINITIONS.filter(f => f.required).map(f => f.key);
    return requiredFields.every(field =>
      columnMapping[field as keyof ColumnMapping] || skippedFields.has(field)
    );
  }, [columnMapping, skippedFields]);

  const handleContinueToDetails = () => {
    if (parsedItems.length >= 50) {
      setShowBatchWarning(true);
    } else {
      setStep('details');
    }
  };

  const handleBatchWarningConfirm = () => {
    setShowBatchWarning(false);
    setStep('details');
  };

  const handleSubmit = () => {
    const validItems = parsedItems.filter(
      item => item.item_name.trim() && item.quantity > 0
    );

    if (!facilityId || !warehouseId || !requestedDate || validItems.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    createRequisition.mutate({
      facility_id: facilityId,
      warehouse_id: warehouseId,
      priority,
      requested_delivery_date: requestedDate,
      notes,
      items: validItems,
    }, {
      onSuccess: () => {
        toast.success('Requisition created successfully');
        handleClose();
      },
      onError: (error) => {
        toast.error(`Failed to create requisition: ${error.message}`);
      },
    });
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setParsedItems([]);
    setParseWarnings([]);
    setParseErrors([]);
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setSkippedFields(new Set());
    setFacilityId('');
    setWarehouseId('');
    setPriority('medium');
    setRequestedDate('');
    setNotes('');
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('preview');
    } else if (step === 'preview') {
      setStep('mapping');
    } else if (step === 'mapping') {
      setStep('upload');
      setSelectedFile(null);
      setRawData([]);
      setHeaders([]);
      setColumnMapping({});
      setSkippedFields(new Set());
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'upload': return 1;
      case 'mapping': return 2;
      case 'preview': return 3;
      case 'details': return 4;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-hidden flex flex-col",
            step === 'mapping' ? 'max-w-6xl' : 'max-w-5xl'
          )}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              Upload Requisition
              {step !== 'upload' && (
                <Badge variant="outline" className="ml-2">
                  Step {getStepNumber()} of 4
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {step === 'upload' && 'Upload a CSV, Excel, or PDF file containing your requisition items'}
              {step === 'mapping' && 'Map your file columns to the required fields'}
              {step === 'preview' && 'Review and edit the parsed items before proceeding'}
              {step === 'details' && 'Complete the requisition details'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {/* Step 1: Upload */}
            {step === 'upload' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Upload File</h3>
                    <p className="text-xs text-muted-foreground">
                      Select a CSV, Excel, or PDF file containing requisition items
                    </p>
                  </div>
                  <CSVTemplateButton />
                </div>

                <FileUploadZone onFileSelect={handleFileSelect} />

                {selectedFile && isProcessing && (
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Processing file...</p>
                      <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                    </div>
                  </div>
                )}

                {parseErrors.length > 0 && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4" role="alert">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-destructive mb-1">
                          Parsing Errors
                        </h4>
                        <ul className="text-sm text-destructive space-y-1">
                          {parseErrors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-muted p-4">
                  <h4 className="text-sm font-medium mb-2">Supported Formats:</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      <span>Excel (.xlsx, .xls)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>CSV (.csv)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-600" />
                      <span>PDF (.pdf)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Column Mapping */}
            {step === 'mapping' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <span className="font-medium">{selectedFile?.name}</span>
                  </div>
                  <Badge variant="secondary">{rawData.length} rows</Badge>
                  <Badge variant="secondary">{headers.length} columns</Badge>
                </div>

                {/* 2-column layout */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Left: Mapping */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Map columns. Check "Skip" to add data later.
                    </div>
                    <ScrollArea className="h-[calc(90vh-280px)] border rounded-lg p-4">
                      <div className="space-y-3">
                        {FIELD_DEFINITIONS.map((field) => {
                          const isSkipped = skippedFields.has(field.key);
                          const isMapped = columnMapping[field.key as keyof ColumnMapping] !== undefined;

                          return (
                            <div key={field.key} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">
                                  {field.label}
                                  {field.required && !isSkipped && (
                                    <span className="text-destructive ml-1">*</span>
                                  )}
                                </Label>
                                {field.required && (
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox
                                      id={`skip-req-${field.key}`}
                                      checked={isSkipped}
                                      onCheckedChange={() => toggleSkippedField(field.key)}
                                      className="h-3.5 w-3.5"
                                    />
                                    <Label
                                      htmlFor={`skip-req-${field.key}`}
                                      className="text-xs text-muted-foreground cursor-pointer"
                                    >
                                      Skip
                                    </Label>
                                  </div>
                                )}
                              </div>
                              <Select
                                value={columnMapping[field.key as keyof ColumnMapping] ?? '__none__'}
                                onValueChange={(value) => handleMappingChange(field.key as keyof ColumnMapping, value)}
                                disabled={isSkipped}
                              >
                                <SelectTrigger className={cn(
                                  'h-9',
                                  field.required && !isMapped && !isSkipped && 'border-destructive',
                                  isSkipped && 'opacity-50'
                                )}>
                                  <SelectValue placeholder="Select column...">
                                    {isMapped
                                      ? headers[parseInt(columnMapping[field.key as keyof ColumnMapping]!, 10)] || `Column ${parseInt(columnMapping[field.key as keyof ColumnMapping]!, 10) + 1}`
                                      : isSkipped
                                        ? 'Skipped'
                                        : 'Select column...'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">-- Not mapped --</SelectItem>
                                  {headers.map((header, index) => (
                                    <SelectItem key={`col-${index}`} value={String(index)}>
                                      <span className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs w-6">
                                          {index < 26
                                            ? String.fromCharCode(65 + index)
                                            : String.fromCharCode(64 + Math.floor(index / 26)) + String.fromCharCode(65 + (index % 26))}:
                                        </span>
                                        {header}
                                      </span>
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

                  {/* Right: Preview */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">
                      File Preview (scroll to see more)
                    </div>
                    <div className="h-[calc(90vh-280px)] border rounded-lg overflow-auto">
                      <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-xs font-medium text-muted-foreground w-10 sticky left-0 bg-muted/50">
                                  #
                                </TableHead>
                                {headers.map((header, i) => (
                                  <TableHead
                                    key={i}
                                    className="text-xs whitespace-nowrap min-w-[100px] max-w-[150px]"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground text-[10px]">
                                        {i < 26
                                          ? String.fromCharCode(65 + i)
                                          : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))}
                                      </span>
                                      <span className="truncate">{header}</span>
                                    </div>
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rawData.slice(0, 10).map((row, i) => (
                                <TableRow key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                  <TableCell className="text-xs text-muted-foreground font-mono w-10 sticky left-0 bg-inherit">
                                    {i + 1}
                                  </TableCell>
                                  {row.map((cell, j) => (
                                    <TableCell
                                      key={j}
                                      className="text-xs py-1.5 min-w-[100px] max-w-[150px] truncate"
                                      title={cell || '-'}
                                    >
                                      {cell || <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                    </div>
                    {rawData.length > 10 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        Showing 10 of {rawData.length} rows
                      </div>
                    )}
                  </div>
                </div>

                {skippedFields.size > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>
                      {skippedFields.size} required field(s) skipped. You can add this data later.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && (
              <ScrollArea className="h-[calc(90vh-220px)]">
                <ParsedItemsPreview
                  items={parsedItems}
                  warnings={parseWarnings}
                  onChange={setParsedItems}
                />
              </ScrollArea>
            )}

            {/* Step 4: Details */}
            {step === 'details' && (
              <ScrollArea className="h-[calc(90vh-220px)]">
                <div className="space-y-4 pr-4">
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="text-sm">
                      {parsedItems.length} items ready for requisition
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="facility">Facility *</Label>
                      <Select value={facilityId} onValueChange={setFacilityId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select facility" />
                        </SelectTrigger>
                        <SelectContent>
                          {facilities.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              {facility.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="warehouse">Warehouse *</Label>
                      <Select value={warehouseId} onValueChange={setWarehouseId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={priority} onValueChange={(value) => setPriority(value as RequisitionPriority)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date">Requested Delivery Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes or special instructions..."
                      rows={3}
                    />
                  </div>
                </div>
              </ScrollArea>
            )}

          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            {step !== 'upload' && (
              <Button variant="outline" onClick={handleBack} className="mr-auto">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            <Button variant="outline" onClick={handleClose}>
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
                onClick={handleContinueToDetails}
                disabled={parsedItems.length === 0}
              >
                Continue to Details
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 'details' && (
              <Button
                onClick={handleSubmit}
                disabled={!facilityId || !warehouseId || !requestedDate || createRequisition.isPending}
              >
                {createRequisition.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Requisition
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchSizeWarning
        open={showBatchWarning}
        onOpenChange={setShowBatchWarning}
        itemCount={parsedItems.length}
        onConfirm={handleBatchWarningConfirm}
      />
    </>
  );
}
