import { useState, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileUp,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ShieldOff,
  Download,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SourceSelector } from '@/components/import/SourceSelector';
import { ConflictResolver, type ConflictResolution } from '@/components/import/ConflictResolver';
import { ITEM_CATEGORIES } from '@/types/items';
import type { ItemCategory } from '@/types/items';
import type { Program } from '@/types/program';
import type { ParsedFile, ColumnMappingDiagnostic } from '@/lib/file-import';
import type { MultiSourceResult, MergeResult } from '@/lib/multi-source-parser';
import { chunk } from '@/lib/utils';
import { computeProgramItemDiff, type ImportDiffResult, type DbRow } from '@/lib/import-diff';
import { useAllProgramItemsForDiff, useBulkUpdateProgramItems, useLogImportSession } from '@/hooks/useImportDiff';
import { ImportDiffPreview } from '@/components/import/ImportDiffPreview';
import { useNavigate } from 'react-router-dom';

interface UploadProgramItemsDialogProps {
  program: Program;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'conflicts' | 'mapping' | 'preview' | 'diff' | 'importing' | 'complete';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

// Item field definitions for column mapping
interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  description?: string;
}

const ITEM_FIELDS: FieldDefinition[] = [
  { key: 'product_code', label: 'Product Code', required: true, description: 'Unique identifier for the item' },
  { key: 'item_name', label: 'Item Name', required: true, description: 'Name or description of the item' },
  { key: 'unit_pack', label: 'Unit Pack', required: true, description: 'Packaging unit (e.g., Pack of 10)' },
  { key: 'category', label: 'Category', required: true, description: 'Item category (Tablet, Capsule, etc.)' },
  { key: 'stock_on_hand', label: 'Stock on Hand', required: false, description: 'Current stock quantity' },
  { key: 'unit_price', label: 'Unit Price', required: false, description: 'Price per unit' },
  { key: 'batch_number', label: 'Batch Number', required: false },
  { key: 'expiry_date', label: 'Expiry Date', required: false },
  { key: 'lot_number', label: 'Lot Number', required: false },
  { key: 'weight_kg', label: 'Weight (kg)', required: false },
  { key: 'volume_m3', label: 'Volume (m³)', required: false },
];

// Column name variations for auto-detection
const ITEM_COLUMN_MAPPINGS: Record<string, string[]> = {
  product_code: ['product_code', 'product code', 'code', 'serial_number', 'serial number', 'item code', 'item_code', 'sku', 'barcode'],
  item_name: ['item_name', 'item name', 'name', 'description', 'product name', 'product_name', 'item', 'drug name', 'drug_name', 'medicine'],
  unit_pack: ['unit_pack', 'unit pack', 'unit', 'pack', 'packaging', 'pack size', 'pack_size', 'uom', 'unit of measure'],
  category: ['category', 'type', 'item category', 'item_category', 'drug type', 'drug_type', 'form', 'dosage form', 'dosage_form'],
  stock_on_hand: ['stock_on_hand', 'stock on hand', 'stock', 'quantity', 'qty', 'balance', 'current stock', 'current_stock', 'soh', 'available'],
  unit_price: ['unit_price', 'unit price', 'price', 'cost', 'unit cost', 'unit_cost', 'rate'],
  batch_number: ['batch_number', 'batch number', 'batch', 'batch no', 'batch_no'],
  expiry_date: ['expiry_date', 'expiry date', 'expiry', 'exp date', 'exp_date', 'expiration', 'expiration date', 'expiration_date', 'exp'],
  lot_number: ['lot_number', 'lot number', 'lot', 'lot no', 'lot_no'],
  weight_kg: ['weight_kg', 'weight', 'weight (kg)', 'wt', 'mass'],
  volume_m3: ['volume_m3', 'volume', 'volume (m3)', 'vol'],
};

interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
  value?: any;
}

export function UploadProgramItemsDialog({
  program,
  open,
  onOpenChange,
}: UploadProgramItemsDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [parsedData, setParsedData] = useState<ParsedFile | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [editedRows, setEditedRows] = useState<Record<number, any>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [skipValidation, setSkipValidation] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [diffResult, setDiffResult] = useState<ImportDiffResult | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: existingProgramItems = [] } = useAllProgramItemsForDiff(program.code);
  const bulkUpdateProgramItems = useBulkUpdateProgramItems();
  const logSession = useLogImportSession();

  // Auto-detect column mappings from file headers
  const autoDetectMappings = useCallback((headers: string[]): Record<string, string> => {
    const mappings: Record<string, string> = {};
    const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

    for (const [field, variations] of Object.entries(ITEM_COLUMN_MAPPINGS)) {
      for (const variation of variations) {
        const idx = lowerHeaders.indexOf(variation.toLowerCase());
        if (idx !== -1 && !Object.values(mappings).includes(headers[idx])) {
          mappings[field] = headers[idx];
          break;
        }
      }
    }

    return mappings;
  }, []);

  const proceedToMapping = useCallback(
    (data: ParsedFile) => {
      const allHeaders = data.headers.length > 0
        ? data.headers
        : data.rows.length > 0
          ? Object.keys(data.rows[0])
          : [];

      const autoMappings = autoDetectMappings(allHeaders);
      setColumnMappings(autoMappings);

      const requiredFields = ITEM_FIELDS.filter((f) => f.required);
      const missingRequired = requiredFields.filter((f) => !autoMappings[f.key]);

      if (missingRequired.length > 0) {
        toast.info(`Please map ${missingRequired.length} required field(s)`);
      } else {
        toast.success('All required fields auto-detected. Review mappings.');
      }

      setStep('mapping');
    },
    [autoDetectMappings]
  );

  const handleSourcesReady = useCallback(
    (result: MultiSourceResult) => {
      setParsedData(result);
      setMergeResult(result.mergeResult || null);

      if (result.mergeResult && result.mergeResult.conflicts.length > 0) {
        setStep('conflicts');
        return;
      }

      proceedToMapping(result);
    },
    [proceedToMapping]
  );

  const handleConflictsResolved = useCallback(
    (resolution: ConflictResolution) => {
      if (!parsedData) return;

      const resolvedData: ParsedFile = {
        ...parsedData,
        rows: resolution.rows,
        headers: Array.from(new Set(resolution.rows.flatMap((r) => Object.keys(r)))),
      };
      setParsedData(resolvedData);
      setMergeResult(null);

      toast.success(`Conflicts resolved. ${resolution.rows.length} items ready.`);
      proceedToMapping(resolvedData);
    },
    [parsedData, proceedToMapping]
  );

  // Apply column mappings and validate
  const handleMappingsConfirmed = () => {
    if (!parsedData) return;

    // Apply mappings: rename columns in rows
    const mappedRows = parsedData.rows.map((row) => {
      const mapped: any = {};
      for (const [targetField, sourceHeader] of Object.entries(columnMappings)) {
        if (sourceHeader) {
          // Try exact match first, then case-insensitive
          mapped[targetField] = row[sourceHeader] ?? row[sourceHeader.toLowerCase()] ?? '';
        }
      }
      return mapped;
    });

    const mappedData: ParsedFile = {
      ...parsedData,
      rows: mappedRows,
    };
    setParsedData(mappedData);

    // Validate
    const issues = validateItems(mappedRows);
    setValidationIssues(issues);

    toast.success('Data mapped and validated');
    setStep('preview');
  };

  // Validate item rows
  const validateItems = (rows: any[]): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    rows.forEach((row, idx) => {
      // Required field checks
      if (!row.product_code || String(row.product_code).trim() === '') {
        issues.push({ row: idx + 1, field: 'product_code', message: 'Product code is required', severity: 'error', value: row.product_code });
      }
      if (!row.item_name || String(row.item_name).trim() === '') {
        issues.push({ row: idx + 1, field: 'item_name', message: 'Item name is required', severity: 'error', value: row.item_name });
      }
      if (!row.unit_pack || String(row.unit_pack).trim() === '') {
        issues.push({ row: idx + 1, field: 'unit_pack', message: 'Unit pack is required', severity: 'warning', value: row.unit_pack });
      }

      // Category validation
      if (row.category) {
        const catLower = String(row.category).trim().toLowerCase();
        const matched = ITEM_CATEGORIES.find((c) => c.toLowerCase() === catLower);
        if (!matched) {
          issues.push({ row: idx + 1, field: 'category', message: `Unknown category "${row.category}"`, severity: 'warning', value: row.category });
        }
      }

      // Numeric field validation
      if (row.stock_on_hand && isNaN(Number(row.stock_on_hand))) {
        issues.push({ row: idx + 1, field: 'stock_on_hand', message: 'Stock must be a number', severity: 'warning', value: row.stock_on_hand });
      }
      if (row.unit_price && isNaN(Number(String(row.unit_price).replace(/[₦,]/g, '')))) {
        issues.push({ row: idx + 1, field: 'unit_price', message: 'Price must be a number', severity: 'warning', value: row.unit_price });
      }
    });

    return issues;
  };

  const getMergedRow = (rowIndex: number) => {
    if (editedRows[rowIndex]) return editedRows[rowIndex];
    return parsedData?.rows[rowIndex] || {};
  };

  const handleCellEdit = useCallback(
    (rowIndex: number, field: string, value: any) => {
      setEditedRows((prev) => ({
        ...prev,
        [rowIndex]: {
          ...(prev[rowIndex] || parsedData?.rows[rowIndex] || {}),
          [field]: value,
        },
      }));
    },
    [parsedData]
  );

  // Virtual scrolling for preview
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: parsedData?.rows.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10,
  });

  // Match category case-insensitively
  const normalizeCategory = (raw: any): ItemCategory | null => {
    if (!raw) return null;
    const lower = String(raw).trim().toLowerCase();
    return ITEM_CATEGORIES.find((c) => c.toLowerCase() === lower) || null;
  };

  const buildDbItems = (): DbRow[] => {
    if (!parsedData) return [];
    const items: DbRow[] = [];
    for (let i = 0; i < parsedData.rows.length; i++) {
      const row = getMergedRow(i);
      const productCode = String(row.product_code || '').trim();
      const itemName = String(row.item_name || '').trim();
      if (!productCode && !itemName) continue;
      const category = normalizeCategory(row.category) || 'Tablet';
      const stockRaw = String(row.stock_on_hand || '0').replace(/[,]/g, '');
      const priceRaw = String(row.unit_price || '0').replace(/[₦,]/g, '');
      items.push({
        serial_number: productCode || `TEMP-${Date.now()}-${i}`,
        description: itemName,
        unit_pack: String(row.unit_pack || '').trim() || null,
        category,
        program: program.code,
        stock_on_hand: parseInt(stockRaw) || 0,
        unit_price: parseFloat(priceRaw) || 0,
        batch_number: row.batch_number ? String(row.batch_number).trim() : null,
        expiry_date: row.expiry_date ? String(row.expiry_date).trim() : null,
        lot_number: row.lot_number ? String(row.lot_number).trim() : null,
        weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : null,
        volume_m3: row.volume_m3 ? parseFloat(row.volume_m3) : null,
      });
    }
    return items;
  };

  const handleProceedToDiff = () => {
    const dbItems = buildDbItems();
    const result = computeProgramItemDiff(dbItems, existingProgramItems);
    setDiffResult(result);
    setStep('diff');
  };

  const handleImport = async (selectedUpdateIds: Set<string>) => {
    if (!diffResult) return;
    setStep('importing');
    setImportProgress(0);

    const result: ImportResult = { total: diffResult.newRecords.length + diffResult.updateRecords.length + diffResult.duplicateRecords.length, success: 0, failed: 0, errors: [] };
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    const logErrors: Array<{ rowNumber: number; message: string }> = [];

    try {
      // Insert new records
      if (diffResult.newRecords.length > 0) {
        const BATCH_SIZE = 100;
        const batches = chunk(diffResult.newRecords, BATCH_SIZE);
        for (let b = 0; b < batches.length; b++) {
          const { data, error } = await supabase.from('items').insert(batches[b]).select();
          if (error) {
            result.failed += batches[b].length;
            result.errors.push({ row: b * BATCH_SIZE + 1, error: error.message });
            logErrors.push({ rowNumber: b * BATCH_SIZE + 1, message: error.message });
          } else {
            result.success += (data || []).length;
            insertedIds.push(...(data || []).map((d: any) => d.id));
          }
          setImportProgress(Math.round(((b + 1) / batches.length) * 70));
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
        const { successIds } = await bulkUpdateProgramItems.mutateAsync(updates);
        updatedIds.push(...successIds);
      }
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    }

    queryClient.invalidateQueries({ queryKey: ['items'] });

    await logSession.mutateAsync({
      entityType: 'program_item',
      sourceFile: parsedData?.fileName ?? 'unknown',
      diffResult,
      selectedUpdateIds,
      commitResults: { insertedIds, updatedIds, errors: logErrors },
      getRecordName: (r) => String(r['description'] ?? ''),
      metadata: { program_id: program.id, program_code: program.code },
    });

    setImportResult(result);
    setStep('complete');
    if (result.success > 0) toast.success(`Imported ${result.success} items`);
    if (result.failed > 0) toast.error(`Failed: ${result.failed} items`);
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData(null);
    setColumnMappings({});
    setValidationIssues([]);
    setEditedRows({});
    setImportProgress(0);
    setImportResult(null);
    setSkipValidation(false);
    setMergeResult(null);
    setDiffResult(null);
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    const headers = ITEM_FIELDS.map((f) => f.key).join(',');
    const sampleRow = `MED-001,Paracetamol 500mg,Pack of 10,Tablet,100,250,,,,`;
    const csv = `${headers}\n${sampleRow}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${program.code}_items_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get all available headers for mapping
  const availableHeaders = useMemo(() => {
    if (!parsedData) return [];
    if (parsedData.headers.length > 0) return parsedData.headers;
    if (parsedData.rows.length > 0) return Object.keys(parsedData.rows[0]);
    return [];
  }, [parsedData]);

  const validationSummary = useMemo(() => {
    if (validationIssues.length === 0) return null;
    const errors = validationIssues.filter((i) => i.severity === 'error').length;
    const warnings = validationIssues.filter((i) => i.severity === 'warning').length;
    return { errors, warnings, hasBlockingErrors: errors > 0 };
  }, [validationIssues]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload Items to {program.name}
          </DialogTitle>
          <DialogDescription>
            Upload CSV or Excel files to bulk import items into this program
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-3 flex-wrap">
          <StepIndicator active={step === 'upload'} completed={['conflicts', 'mapping', 'preview', 'importing', 'complete'].includes(step)}>
            1. Upload
          </StepIndicator>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          {(mergeResult?.conflicts.length ?? 0) > 0 && (
            <>
              <StepIndicator active={step === 'conflicts'} completed={['mapping', 'preview', 'importing', 'complete'].includes(step)}>
                2. Resolve
              </StepIndicator>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </>
          )}
          <StepIndicator active={step === 'mapping'} completed={['preview', 'importing', 'complete'].includes(step)}>
            {mergeResult?.conflicts.length ? '3' : '2'}. Map Columns
          </StepIndicator>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator active={step === 'preview'} completed={['importing', 'complete'].includes(step)}>
            {mergeResult?.conflicts.length ? '4' : '3'}. Preview
          </StepIndicator>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator active={step === 'importing'} completed={step === 'complete'}>
            {mergeResult?.conflicts.length ? '5' : '4'}. Import
          </StepIndicator>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <SourceSelector onSourcesReady={handleSourcesReady} />

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <span className="text-xs text-muted-foreground">
                  CSV template with sample data for {program.name}
                </span>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import Guidelines</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    <li>Required fields: product_code, item_name, unit_pack, category</li>
                    <li>Optional: stock_on_hand, unit_price, batch_number, expiry_date</li>
                    <li>All items will be automatically linked to <strong>{program.name}</strong> ({program.code})</li>
                    <li>For Excel files with multiple sheets, select which sheets to import</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 2 (conditional): Resolve Merge Conflicts */}
          {step === 'conflicts' && mergeResult && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Resolve Merge Conflicts</h3>
              <p className="text-xs text-muted-foreground">
                Data from multiple sheets has been merged. Some entries need your review.
              </p>
              <ConflictResolver
                mergeResult={mergeResult}
                onResolved={handleConflictsResolved}
                onBack={() => setStep('upload')}
              />
            </div>
          )}

          {/* Step: Map Columns */}
          {step === 'mapping' && parsedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Map Columns</h3>
                  <p className="text-xs text-muted-foreground">
                    Match your file columns to item fields. Auto-detected mappings are pre-filled.
                  </p>
                </div>
                {parsedData.rows.length > 0 && (
                  <Badge variant="outline">{parsedData.rows.length} rows found</Badge>
                )}
              </div>

              <div className="grid gap-3">
                {ITEM_FIELDS.map((field) => (
                  <div key={field.key} className="grid grid-cols-[200px_1fr_1fr] items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">
                        {field.label}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                    </div>
                    <Select
                      value={columnMappings[field.key] || '__skip__'}
                      onValueChange={(v) =>
                        setColumnMappings((prev) => ({
                          ...prev,
                          [field.key]: v === '__skip__' ? '' : v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Skip" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">-- Skip --</SelectItem>
                        {availableHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground truncate">
                      {columnMappings[field.key] && parsedData.rows[0]
                        ? `e.g. "${String(parsedData.rows[0][columnMappings[field.key]] || '').slice(0, 40)}"`
                        : field.description || ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && parsedData && (
            <div className="space-y-4">
              {/* Validation Summary */}
              {validationSummary && (() => {
                const errorRate = parsedData.rows.length > 0 ? (validationSummary.errors / parsedData.rows.length) * 100 : 0;
                const highErrorRate = errorRate > 20;
                const hasIssues = validationSummary.hasBlockingErrors || highErrorRate;

                return (
                  <Alert variant={hasIssues && !skipValidation ? 'destructive' : 'default'}>
                    {hasIssues && !skipValidation ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    <AlertTitle>{hasIssues && !skipValidation ? 'Validation Issues Detected' : 'Validation Complete'}</AlertTitle>
                    <AlertDescription>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{parsedData.rows.length} rows</Badge>
                        {validationSummary.errors > 0 && (
                          <Badge variant={skipValidation ? 'secondary' : 'destructive'}>
                            {validationSummary.errors} errors
                          </Badge>
                        )}
                        {validationSummary.warnings > 0 && (
                          <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                            {validationSummary.warnings} warnings
                          </Badge>
                        )}
                      </div>
                      {hasIssues && (
                        <div className="flex items-center gap-3 mt-3 p-3 rounded-md border bg-muted/50">
                          <ShieldOff className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <Label htmlFor="skip-validation" className="text-sm font-medium cursor-pointer">
                              Skip Validation
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Import items with available data. Missing info can be edited later.
                            </p>
                          </div>
                          <Switch id="skip-validation" checked={skipValidation} onCheckedChange={setSkipValidation} />
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted border-b">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left font-medium w-12">#</th>
                        <th className="p-2 text-left font-medium min-w-[120px]">Product Code</th>
                        <th className="p-2 text-left font-medium min-w-[200px]">Item Name</th>
                        <th className="p-2 text-left font-medium min-w-[100px]">Unit Pack</th>
                        <th className="p-2 text-left font-medium min-w-[100px]">Category</th>
                        <th className="p-2 text-left font-medium w-24">Stock</th>
                        <th className="p-2 text-left font-medium min-w-[80px]">Issues</th>
                      </tr>
                    </thead>
                  </table>
                </div>
                <div ref={parentRef} className="h-[350px] overflow-auto">
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const idx = virtualRow.index;
                      const row = getMergedRow(idx);
                      const rowIssues = validationIssues.filter((i) => i.row === idx + 1);
                      const hasErrors = rowIssues.some((i) => i.severity === 'error');

                      return (
                        <div
                          key={virtualRow.key}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <table className="w-full text-sm">
                            <tbody>
                              <tr className={hasErrors ? 'bg-destructive/10' : ''}>
                                <td className="p-2 border-t w-12">{idx + 1}</td>
                                <td className="p-2 border-t min-w-[120px]">
                                  <Input
                                    value={row.product_code || ''}
                                    onChange={(e) => handleCellEdit(idx, 'product_code', e.target.value)}
                                    className="h-8"
                                  />
                                </td>
                                <td className="p-2 border-t min-w-[200px]">
                                  <Input
                                    value={row.item_name || ''}
                                    onChange={(e) => handleCellEdit(idx, 'item_name', e.target.value)}
                                    className="h-8"
                                  />
                                </td>
                                <td className="p-2 border-t min-w-[100px]">
                                  <Input
                                    value={row.unit_pack || ''}
                                    onChange={(e) => handleCellEdit(idx, 'unit_pack', e.target.value)}
                                    className="h-8 w-24"
                                  />
                                </td>
                                <td className="p-2 border-t min-w-[100px]">{row.category || '-'}</td>
                                <td className="p-2 border-t w-24">{row.stock_on_hand || '0'}</td>
                                <td className="p-2 border-t min-w-[80px]">
                                  {rowIssues.length > 0 && (
                                    <div className="flex gap-1">
                                      {rowIssues.filter((i) => i.severity === 'error').length > 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                          {rowIssues.filter((i) => i.severity === 'error').length}
                                        </Badge>
                                      )}
                                      {rowIssues.filter((i) => i.severity === 'warning').length > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                          {rowIssues.filter((i) => i.severity === 'warning').length}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Validation Issues List */}
              {validationIssues.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Validation Issues</h4>
                  <ScrollArea className="h-[120px] border rounded-lg p-2">
                    <div className="space-y-1">
                      {validationIssues.map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/50">
                          {issue.severity === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                          )}
                          <div className="flex-1">
                            <span className="font-medium">Row {issue.row}</span>
                            <span className="text-muted-foreground"> ({issue.field}): </span>
                            <span>{issue.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Step: Diff Preview */}
          {step === 'diff' && diffResult && (
            <ImportDiffPreview
              diffResult={diffResult}
              entityLabel="program item"
              getRecordName={(r) => String(r['description'] ?? '')}
              onBack={() => setStep('preview')}
              onConfirm={(ids) => handleImport(ids)}
              isCommitting={false}
            />
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <Upload className="h-12 w-12 mx-auto text-primary animate-pulse" />
                <h3 className="text-lg font-semibold mt-4">Importing Items...</h3>
                <p className="text-sm text-muted-foreground">
                  Importing items into {program.name}
                </p>
              </div>
              <div className="max-w-md mx-auto space-y-4">
                <Progress value={importProgress} className="h-2" />
                <p className="text-center text-lg font-semibold">{importProgress}% complete</p>
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 p-6 border rounded-lg bg-muted/50">
                <CheckCircle className="h-12 w-12 text-success" />
                <div>
                  <h3 className="text-lg font-semibold">Import Complete</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="default" className="bg-success text-success-foreground">
                      {importResult.success} succeeded
                    </Badge>
                    {importResult.failed > 0 && (
                      <Badge variant="destructive">{importResult.failed} failed</Badge>
                    )}
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Import Errors</h4>
                  <ScrollArea className="h-[200px] border rounded-lg">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="p-3 border-b last:border-b-0 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                          <div>
                            <span className="font-medium">Row {err.row}:</span>{' '}
                            <span className="text-muted-foreground">{err.error}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleMappingsConfirmed}>
                Continue to Preview
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === 'preview' && (() => {
            const errorRate =
              parsedData && parsedData.rows.length > 0 && validationSummary
                ? (validationSummary.errors / parsedData.rows.length) * 100
                : 0;
            const highErrorRate = errorRate > 20;
            const importDisabled = !skipValidation && (validationSummary?.hasBlockingErrors || highErrorRate);

            return (
              <>
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Mapping
                </Button>
                <Button onClick={handleProceedToDiff} disabled={importDisabled}>
                  <Eye className="h-4 w-4 mr-2" />
                  Review Changes
                </Button>
              </>
            );
          })()}

          {step === 'complete' && (
            <>
              <Button variant="outline" onClick={() => { handleClose(); navigate('/storefront/imports'); }}>
                View Import History
              </Button>
              <Button onClick={handleClose}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({
  active,
  completed,
  children,
}: {
  active: boolean;
  completed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`
      flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
      ${active ? 'bg-primary text-primary-foreground' : ''}
      ${completed ? 'bg-success text-success-foreground' : ''}
      ${!active && !completed ? 'bg-muted text-muted-foreground' : ''}
    `}
    >
      {completed && <CheckCircle className="h-4 w-4" />}
      {children}
    </div>
  );
}
