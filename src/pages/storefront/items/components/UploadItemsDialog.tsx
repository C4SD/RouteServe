import { useState, useCallback, useMemo } from 'react';
import { Upload, FileText, Check, AlertTriangle, X, Download, FileSpreadsheet, FileType2, ArrowRight, ChevronLeft } from 'lucide-react';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useBulkCreateItems } from '@/hooks/useItems';
import type { ItemCategory, ItemFormData, ItemProgram } from '@/types/items';
import { ITEM_CATEGORIES, ITEM_PROGRAMS } from '@/types/items';
import { computeItemDiff, type ImportDiffResult, type DbRow } from '@/lib/import-diff';
import { useAllItemsForDiff, useBulkUpdateItems, useLogImportSession } from '@/hooks/useImportDiff';
import { ImportDiffPreview } from '@/components/import/ImportDiffPreview';
import { useNavigate } from 'react-router-dom';

// Configure PDF.js worker (bundled locally, no CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface UploadItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type UploadStep = 'upload' | 'mapping' | 'preview' | 'diff' | 'complete';
type FileType = 'csv' | 'xlsx' | 'docx' | 'pdf';

interface ParsedItem {
  row: number;
  serial_number: string;
  description: string;
  unit_pack: string;
  category: string;
  program?: string;
  weight_kg?: number;
  volume_m3?: number;
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
  store_address?: string;
  lot_number?: string;
  stock_on_hand: number;
  unit_price: number;
  isValid: boolean;
  errors: string[];
}

// Column mapping uses column index (as string for Select component)
interface ColumnMapping {
  serial_number?: string;
  description?: string;
  unit_pack?: string;
  category?: string;
  program?: string;
  weight_kg?: string;
  volume_m3?: string;
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
  store_address?: string;
  lot_number?: string;
  stock_on_hand?: string;
  unit_price?: string;
}

// Field definitions for mapping UI
const FIELD_DEFINITIONS = [
  { key: 'serial_number', label: 'Serial Number', required: true },
  { key: 'description', label: 'Description', required: true },
  { key: 'unit_pack', label: 'Unit Pack', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'program', label: 'Program', required: false },
  { key: 'stock_on_hand', label: 'Stock on Hand', required: true },
  { key: 'unit_price', label: 'Unit Price', required: true },
  { key: 'weight_kg', label: 'Weight (kg)', required: false },
  { key: 'volume_m3', label: 'Volume (m³)', required: false },
  { key: 'batch_number', label: 'Batch Number', required: false },
  { key: 'mfg_date', label: 'Mfg. Date', required: false },
  { key: 'expiry_date', label: 'Expiry Date', required: false },
  { key: 'store_address', label: 'Store Address', required: false },
  { key: 'lot_number', label: 'Lot Number', required: false },
] as const;

const ACCEPTED_FILE_TYPES = '.csv,.xlsx,.xls,.docx,.pdf';
const FILE_TYPE_LABELS: Record<FileType, string> = {
  csv: 'CSV',
  xlsx: 'Excel',
  docx: 'Word',
  pdf: 'PDF',
};

// Auto-detect column mapping based on header names
// Returns column indices as strings for Select component compatibility
function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const patterns: Record<keyof ColumnMapping, string[]> = {
    serial_number: ['serialnumber', 'serialno', 'serial', 'sn', 'itemcode', 'code', 'itemno', 'itemnumber'],
    description: ['description', 'itemdescription', 'name', 'itemname', 'product', 'productname', 'item'],
    unit_pack: ['unitpack', 'pack', 'packaging', 'packsize', 'unit', 'uom', 'unitofmeasure'],
    category: ['category', 'cat', 'type', 'itemtype', 'producttype', 'class'],
    program: ['program', 'programme', 'healthprogram'],
    weight_kg: ['weightkg', 'weight', 'wt', 'weightinkg', 'grossweight'],
    volume_m3: ['volumem3', 'volume', 'vol', 'cubicmeter', 'cbm'],
    batch_number: ['batchnumber', 'batchno', 'batch', 'batchid', 'lotnumber'],
    mfg_date: ['mfgdate', 'manufacturingdate', 'mfg', 'manufacturedate', 'proddate', 'productiondate'],
    expiry_date: ['expirydate', 'expiry', 'expdate', 'exp', 'expirationdate', 'bestbefore'],
    store_address: ['storeaddress', 'store', 'location', 'shelf', 'storageaddress', 'storagelocation', 'bin'],
    lot_number: ['lotnumber', 'lotno', 'lot', 'lotid'],
    stock_on_hand: ['stockonhand', 'stock', 'quantity', 'qty', 'onhand', 'available', 'balance', 'currentstock'],
    unit_price: ['unitprice', 'price', 'cost', 'unitcost', 'rate', 'amount'],
  };

  for (const [field, fieldPatterns] of Object.entries(patterns)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const normalizedHeader = normalizedHeaders[i];
      if (fieldPatterns.some(p => normalizedHeader.includes(p) || p.includes(normalizedHeader))) {
        // Store the column index as a string
        mapping[field as keyof ColumnMapping] = String(i);
        break;
      }
    }
  }

  return mapping;
}

export function UploadItemsDialog({ open, onOpenChange, onSuccess }: UploadItemsDialogProps) {
  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [skippedFields, setSkippedFields] = useState<Set<string>>(new Set());

  const bulkCreate = useBulkCreateItems();
  const { data: existingItemsForDiff = [], refetch: refetchItemsForDiff } = useAllItemsForDiff();
  const bulkUpdateItems = useBulkUpdateItems();
  const logSession = useLogImportSession();
  const navigate = useNavigate();
  const [diffResult, setDiffResult] = useState<ImportDiffResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  const getFileType = (fileName: string): FileType | null => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv':
        return 'csv';
      case 'xlsx':
      case 'xls':
        return 'xlsx';
      case 'docx':
        return 'docx';
      case 'pdf':
        return 'pdf';
      default:
        return null;
    }
  };

  const validateFile = (file: File): boolean => {
    const type = getFileType(file.name);
    return type !== null;
  };

  const validateItem = (item: Partial<ParsedItem>, row: number, skipped: Set<string>): ParsedItem => {
    const errors: string[] = [];

    // Only validate required fields that aren't skipped
    if (!skipped.has('serial_number') && !item.serial_number?.trim()) {
      errors.push('Serial number is required');
    }
    if (!skipped.has('description') && !item.description?.trim()) {
      errors.push('Description is required');
    }
    if (!skipped.has('unit_pack') && !item.unit_pack?.trim()) {
      errors.push('Unit pack is required');
    }
    if (!skipped.has('category')) {
      if (!item.category?.trim()) {
        errors.push('Category is required');
      } else {
        // Case-insensitive category matching
        const matchedCategory = ITEM_CATEGORIES.find(
          c => c.toLowerCase() === item.category!.trim().toLowerCase()
        );
        if (matchedCategory) {
          item.category = matchedCategory;
        } else {
          errors.push(`Invalid category: ${item.category}`);
        }
      }
    }
    if (item.program) {
      const matchedProgram = ITEM_PROGRAMS.find(
        p => p.toLowerCase() === item.program!.trim().toLowerCase()
      );
      if (matchedProgram) {
        item.program = matchedProgram;
      } else {
        errors.push(`Invalid program: ${item.program}`);
      }
    }
    if (!skipped.has('stock_on_hand')) {
      if (item.stock_on_hand === undefined || isNaN(item.stock_on_hand) || item.stock_on_hand < 0) {
        errors.push('Stock on hand must be a non-negative number');
      }
    }
    if (!skipped.has('unit_price')) {
      if (item.unit_price === undefined || isNaN(item.unit_price) || item.unit_price < 0) {
        errors.push('Unit price must be a non-negative number');
      }
    }

    return {
      row,
      serial_number: item.serial_number || '',
      description: item.description || '',
      unit_pack: item.unit_pack || '',
      category: item.category || (skipped.has('category') ? 'Tablet' : ''), // Default if skipped
      program: item.program,
      weight_kg: item.weight_kg,
      volume_m3: item.volume_m3,
      batch_number: item.batch_number,
      mfg_date: item.mfg_date,
      expiry_date: item.expiry_date,
      store_address: item.store_address,
      lot_number: item.lot_number,
      stock_on_hand: item.stock_on_hand ?? 0,
      unit_price: item.unit_price ?? 0,
      isValid: errors.length === 0,
      errors,
    };
  };

  // Parse row data using the column mapping (mapping values are column indices as strings)
  const parseRowWithMapping = (row: string[], rowNum: number): ParsedItem => {
    const getValue = (colIndexStr?: string): string => {
      if (!colIndexStr) return '';
      const index = parseInt(colIndexStr, 10);
      if (isNaN(index) || index < 0 || index >= row.length) return '';
      return row[index]?.trim() || '';
    };

    const getNumericValue = (colIndexStr?: string): number | undefined => {
      const val = getValue(colIndexStr);
      if (!val) return undefined;
      const num = parseFloat(val.replace(/[₦,]/g, ''));
      return isNaN(num) ? undefined : num;
    };

    const item: Partial<ParsedItem> = {
      serial_number: getValue(columnMapping.serial_number),
      description: getValue(columnMapping.description),
      unit_pack: getValue(columnMapping.unit_pack),
      category: getValue(columnMapping.category),
      program: getValue(columnMapping.program) || undefined,
      weight_kg: getNumericValue(columnMapping.weight_kg),
      volume_m3: getNumericValue(columnMapping.volume_m3),
      batch_number: getValue(columnMapping.batch_number) || undefined,
      mfg_date: getValue(columnMapping.mfg_date) || undefined,
      expiry_date: getValue(columnMapping.expiry_date) || undefined,
      store_address: getValue(columnMapping.store_address) || undefined,
      lot_number: getValue(columnMapping.lot_number) || undefined,
      stock_on_hand: getNumericValue(columnMapping.stock_on_hand) ?? 0,
      unit_price: getNumericValue(columnMapping.unit_price) ?? 0,
    };

    return validateItem(item, rowNum, skippedFields);
  };

  // Parse CSV file
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  };

  const parseCSV = async (file: File): Promise<string[][]> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => parseCSVLine(line));
  };

  // Parse Excel file
  const parseExcel = async (file: File): Promise<string[][]> => {
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

  // Parse DOCX file - looks for tables
  const parseDocx = async (file: File): Promise<string[][]> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    const lines = text.split('\n').filter(line => line.trim());

    // Detect delimiter
    const firstLine = lines[0];
    let delimiter: string | RegExp = '\t';
    if (firstLine.includes('|')) {
      delimiter = '|';
    } else if (!firstLine.includes('\t')) {
      delimiter = /\s{2,}/;
    }

    return lines.map(line =>
      typeof delimiter === 'string'
        ? line.split(delimiter).map(v => v.trim())
        : line.split(delimiter).map(v => v.trim())
    );
  };

  // Parse PDF file
  const parsePDF = async (file: File): Promise<string[][]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    const lines = fullText.split('\n').filter(line => line.trim());
    const firstLine = lines[0];
    let delimiter: string | RegExp = /\s{2,}/;

    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes('|')) {
      delimiter = '|';
    }

    return lines.map(line => line.split(delimiter).map(v => v.trim()).filter(Boolean));
  };

  const processFile = async (uploadedFile: File) => {
    setIsProcessing(true);
    setUploadProgress(0);
    setParseError(null);

    const detectedType = getFileType(uploadedFile.name);
    setFileType(detectedType);

    try {
      for (let i = 0; i <= 30; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 30));
        setUploadProgress(i);
      }

      let data: string[][] = [];

      switch (detectedType) {
        case 'csv':
          data = await parseCSV(uploadedFile);
          break;
        case 'xlsx':
          data = await parseExcel(uploadedFile);
          break;
        case 'docx':
          data = await parseDocx(uploadedFile);
          break;
        case 'pdf':
          data = await parsePDF(uploadedFile);
          break;
        default:
          throw new Error('Unsupported file format');
      }

      for (let i = 30; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 30));
        setUploadProgress(i);
      }

      if (data.length < 2) {
        throw new Error('File must have a header row and at least one data row');
      }

      // Get headers from first row - replace empty headers with column letter
      const rawHeaders = data[0];
      const fileHeaders = rawHeaders.map((h, i) => {
        const trimmed = h?.trim();
        if (trimmed) return trimmed;
        // Generate column letter for empty headers (A, B, C, ... AA, AB, etc.)
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
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFile = useCallback((uploadedFile: File) => {
    if (validateFile(uploadedFile)) {
      setFile(uploadedFile);
      processFile(uploadedFile);
    } else {
      setParseError('Unsupported file format. Please use CSV, Excel (.xlsx), Word (.docx), or PDF.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
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
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === '__none__' ? undefined : value,
    }));
  };

  const applyMapping = () => {
    const items = rawData.map((row, index) => parseRowWithMapping(row, index + 2));
    setParsedItems(items);
    setStep('preview');
  };

  const removeItem = (row: number) => {
    setParsedItems(items => items.filter(item => item.row !== row));
  };

  const buildDbItems = (): DbRow[] =>
    parsedItems
      .filter(item => item.isValid)
      .map(item => ({
        serial_number: item.serial_number || `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        description: item.description || 'Pending description',
        unit_pack: item.unit_pack || 'N/A',
        category: item.category || 'Tablet',
        program: item.program || null,
        weight_kg: item.weight_kg ?? null,
        volume_m3: item.volume_m3 ?? null,
        batch_number: item.batch_number || null,
        mfg_date: item.mfg_date || null,
        expiry_date: item.expiry_date || null,
        store_address: item.store_address || null,
        lot_number: item.lot_number || null,
        stock_on_hand: item.stock_on_hand,
        unit_price: item.unit_price,
      }));

  const handleProceedToDiff = async () => {
    const dbItems = buildDbItems();
    const { data: freshItems = [] } = await refetchItemsForDiff();
    const result = computeItemDiff(dbItems, freshItems);
    setDiffResult(result);
    setStep('diff');
  };

  const handleConfirm = async (selectedUpdateIds: Set<string>) => {
    if (!diffResult || isCommitting) return;
    setIsCommitting(true);
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    const logErrors: Array<{ rowNumber: number; message: string }> = [];

    // Insert new records
    if (diffResult.newRecords.length > 0) {
      const itemsToCreate = diffResult.newRecords.map(r => ({
        serial_number: String(r['serial_number'] ?? ''),
        description: String(r['description'] ?? ''),
        unit_pack: String(r['unit_pack'] ?? 'N/A'),
        category: (r['category'] as ItemCategory) || 'Tablet',
        program: r['program'] as ItemProgram | undefined,
        weight_kg: r['weight_kg'] as number | undefined,
        volume_m3: r['volume_m3'] as number | undefined,
        batch_number: r['batch_number'] as string | undefined,
        mfg_date: r['mfg_date'] as string | undefined,
        expiry_date: r['expiry_date'] as string | undefined,
        store_address: r['store_address'] as string | undefined,
        lot_number: r['lot_number'] as string | undefined,
        stock_on_hand: (r['stock_on_hand'] as number) || 0,
        unit_price: (r['unit_price'] as number) || 0,
      } as ItemFormData));
      try {
        await bulkCreate.mutateAsync(itemsToCreate);
      } catch (error: any) {
        logErrors.push({ rowNumber: 0, message: error.message });
      }
    }

    // Update selected records
    const updates = diffResult.updateRecords
      .filter(r => selectedUpdateIds.has(r.dbId))
      .map(r => {
        const fields: Record<string, unknown> = {};
        for (const diff of r.fieldDiffs) fields[diff.field] = diff.uploadValue;
        return { id: r.dbId, fields };
      });
    if (updates.length > 0) {
      const { successIds } = await bulkUpdateItems.mutateAsync(updates);
      updatedIds.push(...successIds);
    }

    try {
      await logSession.mutateAsync({
        entityType: 'item',
        sourceFile: file?.name ?? 'unknown',
        diffResult,
        selectedUpdateIds,
        commitResults: { insertedIds, updatedIds, errors: logErrors },
        getRecordName: (r) => String(r['description'] ?? ''),
      });

      onSuccess?.();
      setStep('complete');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setFileType(null);
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setParsedItems([]);
    setUploadProgress(0);
    setParseError(null);
    setSkippedFields(new Set());
    setIsCommitting(false);
    onOpenChange(false);
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setFileType(null);
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setParsedItems([]);
    setUploadProgress(0);
    setParseError(null);
    setSkippedFields(new Set());
    setIsCommitting(false);
  };

  const downloadTemplate = () => {
    const templateHeaders = FIELD_DEFINITIONS.map(f => f.label);
    const csvContent = [
      templateHeaders.join(','),
      'SN-001,Paracetamol 500mg,10 tablets/pack,Tablet,Essential Medicines,100,150.00,0.5,0.001,BTH-001,2024-01-01,2026-01-01,Shelf A1,LOT-001',
      'SN-002,Amoxicillin 250mg,20 capsules/pack,Capsule,HIV/AIDS,50,250.00,0.3,0.0008,BTH-002,2024-02-01,2026-02-01,Shelf B2,LOT-002',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validItemsCount = parsedItems.filter(item => item.isValid).length;
  const invalidItemsCount = parsedItems.filter(item => !item.isValid).length;

  // Check if required fields are mapped or skipped
  const requiredFieldsMapped = useMemo(() => {
    const requiredFields = FIELD_DEFINITIONS.filter(f => f.required).map(f => f.key);
    return requiredFields.every(field =>
      columnMapping[field as keyof ColumnMapping] || skippedFields.has(field)
    );
  }, [columnMapping, skippedFields]);

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

  const getFileIcon = () => {
    switch (fileType) {
      case 'xlsx':
        return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
      case 'docx':
        return <FileType2 className="h-5 w-5 text-blue-600" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-hidden flex flex-col",
        step === 'mapping' ? 'max-w-6xl' : 'max-w-4xl'
      )}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Upload Items
            {step !== 'upload' && (
              <Badge variant="outline" className="ml-2">
                Step {step === 'mapping' ? '2' : '3'} of 3
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Upload and import items from a file</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a file containing item data. Supported formats: Excel (.xlsx), Word (.docx), PDF, or CSV.
              </p>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV Template
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
                onClick={() => document.getElementById('items-file-upload')?.click()}
              >
                <input
                  id="items-file-upload"
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileInput}
                  className="hidden"
                />
                <Upload className={cn('h-10 w-10 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground')} />
                {isDragging ? (
                  <p className="text-primary font-medium">Drop the file here...</p>
                ) : (
                  <>
                    <p className="font-medium">Drag and drop a file here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse (xlsx, docx, pdf, csv)
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span>Excel (.xlsx)</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileType2 className="h-4 w-4 text-blue-600" />
                  <span>Word (.docx)</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileText className="h-4 w-4 text-red-600" />
                  <span>PDF (.pdf)</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>CSV (.csv)</span>
                </div>
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
              {/* File info header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getFileIcon()}
                    <span className="font-medium">{file?.name}</span>
                    {fileType && (
                      <Badge variant="outline" className="text-xs">
                        {FILE_TYPE_LABELS[fileType]}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary">{rawData.length} rows</Badge>
                  <Badge variant="secondary">{headers.length} columns</Badge>
                </div>
              </div>

              {/* 2-column layout: Mapping + Preview */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left column: Field Mapping */}
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Map your file columns to the required fields. Check "Skip" to add data later.
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
                                    id={`skip-${field.key}`}
                                    checked={isSkipped}
                                    onCheckedChange={() => toggleSkippedField(field.key)}
                                    className="h-3.5 w-3.5"
                                  />
                                  <Label
                                    htmlFor={`skip-${field.key}`}
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

                {/* Right column: File Preview Snapshot */}
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

              {/* Skipped fields warning */}
              {skippedFields.size > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>
                    {skippedFields.size} required field(s) skipped. You can add this data later by editing individual items.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getFileIcon()}
                    <span className="font-medium">{file?.name}</span>
                  </div>
                  <Badge variant="secondary">{parsedItems.length} items</Badge>
                </div>

                <div className="flex items-center gap-2">
                  {validItemsCount > 0 && (
                    <Badge className="bg-green-100 text-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      {validItemsCount} valid
                    </Badge>
                  )}
                  {invalidItemsCount > 0 && (
                    <Badge className="bg-red-100 text-red-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {invalidItemsCount} invalid
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[calc(90vh-280px)] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Status</TableHead>
                      <TableHead>Serial No.</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Unit Pack</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Price</TableHead>
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
                        <TableCell className="font-mono text-xs">{item.serial_number || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{item.description || '-'}</span>
                            {item.errors.length > 0 && (
                              <p className="text-xs text-red-600 mt-1">
                                {item.errors.join(', ')}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.unit_pack || '-'}</TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                        <TableCell className="text-xs">{item.program || '-'}</TableCell>
                        <TableCell className="text-right">{item.stock_on_hand}</TableCell>
                        <TableCell className="text-right">₦{item.unit_price.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeItem(item.row)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {invalidItemsCount > 0 && (
                <p className="text-sm text-yellow-600 flex items-center gap-2 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                  Invalid items will be excluded from the upload.
                </p>
              )}
            </div>
          )}

          {/* Diff preview step */}
          {step === 'diff' && diffResult && (
            <div className="flex-1 overflow-y-auto p-1">
              <ImportDiffPreview
                diffResult={diffResult}
                entityLabel="item"
                getRecordName={(r) => String(r['description'] ?? '')}
                onBack={() => setStep('preview')}
                onConfirm={(ids) => handleConfirm(ids)}
                isCommitting={isCommitting}
              />
            </div>
          )}

          {/* Complete step */}
          {step === 'complete' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Check className="size-12 text-green-500" />
              <p className="text-sm font-medium">Import complete. Check Import History for details.</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          {step === 'mapping' && (
            <Button variant="outline" onClick={handleReset} className="mr-auto">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          {step === 'preview' && (
            <Button variant="outline" onClick={() => setStep('mapping')} className="mr-auto">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Mapping
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
            <>
              <Button variant="secondary" onClick={handleReset}>
                Upload Different File
              </Button>
              <Button
                onClick={handleProceedToDiff}
                disabled={validItemsCount === 0}
              >
                Review Changes
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === 'complete' && (
            <>
              <Button variant="outline" onClick={() => navigate('/storefront/imports')}>
                View Import History
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
