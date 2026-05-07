import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  ArrowLeftRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseCsvBoolean, parseCsvNumber } from '@/lib/facility-validation';
import { toast } from 'sonner';
import {
  validateParsedData,
  validateSingleRow,
  getValidationSummary,
  applyManualMappings,
  type ParsedFile,
  type ValidationResult,
  type SkipConfig,
} from '@/lib/file-import';
import { ColumnMapper, type ColumnMapping, type ColumnMapperResult } from './ColumnMapper';
import { cleanFacilityRows, type DBTables, type NormalizedRow, fuzzyMatchCache } from '@/lib/data-cleaners';
import { SourceSelector } from '@/components/import/SourceSelector';
import { ConflictResolver, type ConflictResolution } from '@/components/import/ConflictResolver';
import type { MultiSourceResult, MergeResult } from '@/lib/multi-source-parser';
import { useFacilityTypes } from '@/hooks/useFacilityTypes';
import { useLevelsOfCare } from '@/hooks/useLevelsOfCare';
import { useOperationalZones } from '@/hooks/useOperationalZones';
import { useAllLGAsWithZones } from '@/hooks/useAdminUnits';
import { batchGenerateWarehouseCodes } from '@/lib/warehouse-code-generator';
import { chunk } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { detectCoordinateIssues } from '@/lib/geo-bounds';
import { computeFacilityDiff, type ImportDiffResult, type DbRow } from '@/lib/import-diff';
import { useAllFacilitiesForDiff, useBulkUpdateFacilities, useLogImportSession } from '@/hooks/useImportDiff';
import { ImportDiffPreview } from '@/components/import/ImportDiffPreview';
import { useNavigate } from 'react-router-dom';

interface EnhancedCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'conflicts' | 'mapping' | 'preview' | 'diff' | 'importing' | 'complete';

interface ImportResult {
  total: number;
  success: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function EnhancedCSVImportDialog({ open, onOpenChange }: EnhancedCSVImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [parsedData, setParsedData] = useState<ParsedFile | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({});
  const [skipConfig, setSkipConfig] = useState<SkipConfig>({});
  const [autoGenerateWarehouseCode, setAutoGenerateWarehouseCode] = useState(false);
  const [normalizedRows, setNormalizedRows] = useState<NormalizedRow[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationResult[]>([]);
  const [editedRows, setEditedRows] = useState<Record<number, any>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [skipValidation, setSkipValidation] = useState(false);
  const [cancelImport, setCancelImport] = useState(false);
  const [importStats, setImportStats] = useState({ processed: 0, currentBatch: 0, totalBatches: 0 });
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [diffResult, setDiffResult] = useState<ImportDiffResult | null>(null);
  const [selectedUpdateIds, setSelectedUpdateIds] = useState<Set<string>>(new Set());
  const [preparedDbFacilities, setPreparedDbFacilities] = useState<DbRow[]>([]);

  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();

  // Fetch DB reference data for normalization and validation
  const { data: facilityTypes = [] } = useFacilityTypes();
  const { data: levelsOfCare = [] } = useLevelsOfCare();
  const { data: zones = [] } = useOperationalZones();
  const { data: lgas = [] } = useAllLGAsWithZones();

  // Diff-related hooks
  const { data: existingFacilitiesForDiff = [] } = useAllFacilitiesForDiff();
  const bulkUpdateFacilities = useBulkUpdateFacilities();
  const logSession = useLogImportSession();

  const proceedToMapping = useCallback((data: ParsedFile) => {
    // Auto-detect mappings from headers
    const autoMappings: ColumnMapping = {};
    const headerSet = new Set(data.headers);

    if (data.columnMappings) {
      data.columnMappings.forEach((diag) => {
        if (diag.isRecognized && diag.mappedTo && headerSet.has(diag.mappedTo)) {
          autoMappings[diag.mappedTo] = diag.mappedTo;
        }
      });
    }

    const knownFields = [
      'name', 'address', 'latitude', 'longitude', 'lga', 'ward',
      'service_zone', 'level_of_care', 'type', 'state', 'warehouse_code',
      'ip_name', 'funding_source', 'programme', 'phone', 'email',
      'contact_person', 'capacity', 'storage_capacity', 'operating_hours',
      'pcr_service', 'cd4_service', 'type_of_service', 'designation',
      'contact_name_pharmacy', 'phone_pharmacy', 'geo_coordinates',
    ];
    for (const field of knownFields) {
      if (headerSet.has(field) && !autoMappings[field]) {
        autoMappings[field] = field;
      }
    }

    setColumnMappings(autoMappings);

    const requiredFields = ['name', 'address', 'latitude', 'longitude', 'lga'];
    const missingRequired = requiredFields.filter(field => !autoMappings[field]);

    if (missingRequired.length > 0) {
      toast.info(`Please map ${missingRequired.length} required fields`);
    } else {
      toast.success('All required fields auto-detected. Please review mappings.');
    }

    setStep('mapping');
  }, []);

  const handleSourcesReady = useCallback((result: MultiSourceResult) => {
    setParsedData(result);
    setMergeResult(result.mergeResult || null);

    // If there are merge conflicts, show the conflict resolution step
    if (result.mergeResult && result.mergeResult.conflicts.length > 0) {
      setStep('conflicts');
      return;
    }

    proceedToMapping(result);
  }, [proceedToMapping]);

  const handleConflictsResolved = useCallback((resolution: ConflictResolution) => {
    if (!parsedData) return;

    // Rebuild parsedData with resolved rows
    const resolvedData: ParsedFile = {
      ...parsedData,
      rows: resolution.rows,
      headers: Array.from(new Set(resolution.rows.flatMap(r => Object.keys(r)))),
    };
    setParsedData(resolvedData);
    setMergeResult(null);

    toast.success(`Conflicts resolved. ${resolution.rows.length} facilities ready.`);
    proceedToMapping(resolvedData);
  }, [parsedData, proceedToMapping]);

  const handleMappingsConfirmed = async (result: ColumnMapperResult) => {
    if (!parsedData) return;

    const { mappings, skipConfig: newSkipConfig, autoGenerateWarehouseCode: autoGenerate } = result;

    setColumnMappings(mappings);
    setSkipConfig(newSkipConfig);
    setAutoGenerateWarehouseCode(autoGenerate);

    // Apply manual mappings to the data
    const mappedData = applyManualMappings(parsedData, mappings);
    setParsedData(mappedData);

    toast.loading('Cleaning and validating data...');

    // Build DB tables for normalization
    const dbTables: DBTables = {
      zones,
      lgas,
      facilityTypes,
      levelsOfCare,
    };

    // Clean and normalize all rows with DB matching (async, yields to UI between chunks)
    const cleaningToastId = mappedData.rows.length > 200
      ? toast.loading('Cleaning data... 0%')
      : undefined;
    const cleaned = await cleanFacilityRows(mappedData.rows, dbTables, (percent) => {
      // Update toast with progress for large files
      if (cleaningToastId) {
        toast.loading(`Cleaning data... ${percent}%`, { id: cleaningToastId });
      }
    });
    if (cleaningToastId) toast.dismiss(cleaningToastId);
    setNormalizedRows(cleaned);

    // Apply normalized values back to parsed data for preview
    const normalizedParsedData = {
      ...mappedData,
      rows: cleaned.map((nr) => nr.normalized),
    };
    setParsedData(normalizedParsedData);

    // Validate with skip config and DB match results
    const issues = validateParsedData(
      normalizedParsedData,
      new Set(), // Will fetch existing warehouse codes later
      newSkipConfig,
      cleaned
    );
    setValidationIssues(issues);

    toast.dismiss();
    toast.success('Data cleaned and validated');
    setStep('preview');
  };

  // Debounced validation ref
  const validationTimeoutRef = useRef<NodeJS.Timeout>();

  const handleCellEdit = useCallback((rowIndex: number, field: string, value: any) => {
    setEditedRows(prev => ({
      ...prev,
      [rowIndex]: {
        ...(prev[rowIndex] || parsedData?.rows[rowIndex] || {}),
        [field]: value,
      },
    }));

    // Debounced validation - only validate the edited row after 300ms
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      if (!parsedData) return;

      // Get the edited row data
      const editedRow = {
        ...(parsedData.rows[rowIndex] || {}),
        ...(editedRows[rowIndex] || {}),
        [field]: value,
      };

      // Validate only this row
      const dbMatchResults = normalizedRows[rowIndex]?.dbMatches;
      const rowIssues = validateSingleRow(
        editedRow,
        rowIndex,
        new Set(),
        skipConfig,
        dbMatchResults
      );

      // Update validation issues - remove old issues for this row, add new ones
      setValidationIssues(prev => {
        const otherRowIssues = prev.filter(issue => issue.row !== rowIndex + 1);
        return [...otherRowIssues, ...rowIssues];
      });
    }, 300);
  }, [parsedData, editedRows, normalizedRows, skipConfig]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  const getMergedRow = (rowIndex: number) => {
    if (editedRows[rowIndex]) {
      return editedRows[rowIndex];
    }
    return parsedData?.rows[rowIndex] || {};
  };

  // Virtual scrolling setup for preview table
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: parsedData?.rows.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Approximate row height in pixels
    overscan: 10, // Render 10 rows above/below viewport
  });

  /**
   * Map free-text facility type values to the Postgres facility_type enum.
   * Valid enum values: hospital, clinic, health_center, pharmacy, lab, other
   */
  const VALID_FACILITY_TYPES = new Set(['hospital', 'clinic', 'health_center', 'pharmacy', 'lab', 'warehouse', 'other']);

  const mapFacilityType = (rawType: any): string => {
    if (!rawType) return 'clinic'; // DB default
    const lower = String(rawType).trim().toLowerCase();

    // Direct enum match
    if (VALID_FACILITY_TYPES.has(lower)) return lower;

    // Common variations → enum
    if (lower.includes('hospital') || lower.includes('general hospital')) return 'hospital';
    if (lower.includes('health center') || lower.includes('health centre') || lower.includes('phc') || lower.includes('primary health')) return 'health_center';
    if (lower.includes('pharmacy') || lower.includes('chemist') || lower.includes('drug')) return 'pharmacy';
    if (lower.includes('lab') || lower.includes('laboratory') || lower.includes('diagnostic')) return 'lab';
    if (lower.includes('clinic') || lower.includes('dispensary')) return 'clinic';
    if (lower.includes('warehouse')) return 'warehouse';

    return 'other';
  };

  /**
   * Build a DB-ready insert object from a CSV row.
   * Only includes columns that exist in the facilities table (all snake_case).
   */
  const buildDbFacility = (row: any, normalizedRow?: NormalizedRow) => {
    const lat = parseFloat(String(row.latitude ?? ''));
    const lng = parseFloat(String(row.longitude ?? ''));

    return {
      name: String(row.name || '').trim(),
      address: String(row.address || '').trim() || null,
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lng) ? 0 : lng,
      phone: row.phone || null,
      contact_person: row.contactPerson || row.contact_person || null,
      capacity: parseCsvNumber(String(row.capacity ?? '')) || null,
      operating_hours: row.operatingHours || row.operating_hours || null,
      warehouse_code: row.warehouse_code || null,
      state: row.state || 'kano',
      ip_name: row.ip_name || null,
      funding_source: row.funding_source || null,
      programme: row.programme || null,
      pcr_service: parseCsvBoolean(String(row.pcr_service ?? '')),
      cd4_service: parseCsvBoolean(String(row.cd4_service ?? '')),
      type_of_service: row.type_of_service || null,
      service_zone: row.service_zone || null,
      level_of_care: row.level_of_care || null,
      lga: row.lga || null,
      ward: row.ward || null,
      contact_name_pharmacy: row.contact_name_pharmacy || null,
      designation: row.designation || null,
      phone_pharmacy: row.phone_pharmacy || null,
      email: row.email || null,
      storage_capacity: parseCsvNumber(String(row.storage_capacity ?? '')) || null,
      // DB-linked foreign keys from normalization
      zone_id: normalizedRow?.dbMatches?.zone?.id || null,
      workspace_id: workspaceId,
    };
  };

  // Step: Prepare rows → compute diff → show diff preview
  const handleProceedToDiff = useCallback(async () => {
    if (!parsedData) return;

    const preparedRows: Array<{ row: any; normalizedRow: NormalizedRow; originalIndex: number }> = [];
    for (let i = 0; i < parsedData.rows.length; i++) {
      const row = getMergedRow(i);
      if (!row.name || String(row.name).trim() === '') continue;
      preparedRows.push({ row, normalizedRow: normalizedRows[i], originalIndex: i });
    }

    if (autoGenerateWarehouseCode) {
      const facilitiesForCodeGen = preparedRows.map((item) => ({
        service_zone: item.row.service_zone,
        originalIndex: item.originalIndex,
      }));
      const warehouseCodeMap = await batchGenerateWarehouseCodes(facilitiesForCodeGen, supabase);
      preparedRows.forEach((item) => {
        const generatedCode = warehouseCodeMap.get(item.originalIndex);
        if (generatedCode) item.row.warehouse_code = generatedCode;
      });
    }

    const dbFacilities = preparedRows.map((item) =>
      buildDbFacility(item.row, item.normalizedRow)
    ) as DbRow[];

    const result = computeFacilityDiff(dbFacilities, existingFacilitiesForDiff);
    setPreparedDbFacilities(dbFacilities);
    setDiffResult(result);
    setSelectedUpdateIds(new Set(result.updateRecords.map(r => r.dbId)));
    setStep('diff');
  }, [parsedData, normalizedRows, autoGenerateWarehouseCode, existingFacilitiesForDiff, getMergedRow, buildDbFacility]);

  // Step: Commit — insert new + update selected, then log the session
  const handleImport = async (confirmedUpdateIds: Set<string>) => {
    if (!diffResult) return;

    setSelectedUpdateIds(confirmedUpdateIds);
    setStep('importing');
    setImportProgress(0);
    setCancelImport(false);

    const result: ImportResult = {
      total: diffResult.newRecords.length + diffResult.updateRecords.length + diffResult.duplicateRecords.length,
      success: 0,
      updated: 0,
      skipped: diffResult.duplicateRecords.length + diffResult.updateRecords.filter(r => !confirmedUpdateIds.has(r.dbId)).length,
      failed: 0,
      errors: [],
    };

    const BATCH_SIZE = 150;
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    const logErrors: Array<{ rowNumber: number; message: string }> = [];

    try {
      // 1. Insert new records
      const newFacilities = diffResult.newRecords;
      if (newFacilities.length > 0) {
        const batches = chunk(newFacilities, BATCH_SIZE);
        const totalBatches = batches.length;
        const CONCURRENCY = 3;
        setImportStats({ processed: 0, currentBatch: 0, totalBatches });
        let completedBatches = 0;

        for (let startIdx = 0; startIdx < batches.length; startIdx += CONCURRENCY) {
          if (cancelImport) { toast.info('Import cancelled'); break; }

          const concurrentBatches = batches.slice(startIdx, startIdx + CONCURRENCY);
          const batchPromises = concurrentBatches.map(async (batch, offsetInGroup) => {
            const batchIndex = startIdx + offsetInGroup;
            const batchStartIndex = batchIndex * BATCH_SIZE;
            try {
              const { data, error } = await supabase.rpc('bulk_insert_facilities', { facilities: batch });
              if (error) throw error;
              const row = Array.isArray(data) ? data[0] : data;
              const insertedCount = row?.inserted_count ?? 0;
              const failedCount = row?.failed_count ?? 0;
              const errMsg = row?.error_message;
              result.success += insertedCount;
              result.failed += failedCount;
              if (errMsg) {
                errMsg.split('; ').forEach((msg: string) => {
                  result.errors.push({ row: batchStartIndex + 1, error: msg });
                  logErrors.push({ rowNumber: batchStartIndex + 1, message: msg });
                });
              }
            } catch (error: any) {
              result.failed += batch.length;
              result.errors.push({ row: batchStartIndex + 1, error: error.message || 'Unknown error' });
              logErrors.push({ rowNumber: batchStartIndex + 1, message: error.message });
            }
          });

          await Promise.all(batchPromises);
          completedBatches += concurrentBatches.length;
          setImportStats({ processed: Math.min(completedBatches * BATCH_SIZE, newFacilities.length), currentBatch: completedBatches, totalBatches });
          setImportProgress(Math.round((completedBatches / totalBatches) * 70));
        }
      }

      // 2. Update selected records
      const selectedUpdates = diffResult.updateRecords
        .filter(r => confirmedUpdateIds.has(r.dbId))
        .map(r => {
          const fields: Record<string, unknown> = {};
          for (const diff of r.fieldDiffs) {
            fields[diff.field] = diff.uploadValue;
          }
          return { id: r.dbId, fields };
        });

      if (selectedUpdates.length > 0) {
        const { successIds, errors: updateErrors } = await bulkUpdateFacilities.mutateAsync(selectedUpdates);
        updatedIds.push(...successIds);
        result.updated = successIds.length;
        result.failed += updateErrors.length;
        updateErrors.forEach(e => {
          result.errors.push({ row: 0, error: `Update failed for ${e.id}: ${e.message}` });
          logErrors.push({ rowNumber: 0, message: e.message, dbId: e.id });
        });
      }
      setImportProgress(90);
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    }

    queryClient.invalidateQueries({ queryKey: ['facilities'] });

    // 3. Log the session
    try {
      const sessionId = await logSession.mutateAsync({
        entityType: 'facility',
        sourceFile: parsedData?.fileName ?? 'unknown',
        diffResult,
        selectedUpdateIds: confirmedUpdateIds,
        commitResults: { insertedIds, updatedIds, errors: logErrors },
        getRecordName: (r) => String(r['name'] ?? ''),
      });
      setImportProgress(100);
      setImportResult({ ...result });
      setStep('complete');
      if (result.success > 0) toast.success(`Imported ${result.success} new facilities`);
      if (result.updated > 0) toast.success(`Updated ${result.updated} facilities`);
      if (result.failed > 0) toast.error(`${result.failed} rows failed`);
      return sessionId;
    } catch {
      setImportResult({ ...result });
      setStep('complete');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData(null);
    setColumnMappings({});
    setSkipConfig({});
    setAutoGenerateWarehouseCode(false);
    setNormalizedRows([]);
    setValidationIssues([]);
    setEditedRows({});
    setImportProgress(0);
    setImportResult(null);
    setSkipValidation(false);
    setCancelImport(false);
    setImportStats({ processed: 0, currentBatch: 0, totalBatches: 0 });
    setMergeResult(null);
    setDiffResult(null);
    setSelectedUpdateIds(new Set());
    setPreparedDbFacilities([]);

    // Clear fuzzy match cache on dialog close
    fuzzyMatchCache.clear();

    onOpenChange(false);
  };

  const handleCancelImport = () => {
    setCancelImport(true);
    toast.info('Cancelling import...');
  };

  const validationSummary = validationIssues.length > 0
    ? getValidationSummary(validationIssues)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Facilities
          </DialogTitle>
          <DialogDescription>
            Upload CSV or Excel files (.csv, .xlsx, .xls) to bulk import facilities
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
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
          <StepIndicator active={step === 'preview'} completed={['diff', 'importing', 'complete'].includes(step)}>
            {mergeResult?.conflicts.length ? '4' : '3'}. Preview
          </StepIndicator>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator active={step === 'diff'} completed={['importing', 'complete'].includes(step)}>
            {mergeResult?.conflicts.length ? '5' : '4'}. Review Changes
          </StepIndicator>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator active={step === 'importing'} completed={step === 'complete'}>
            {mergeResult?.conflicts.length ? '5' : '4'}. Import
          </StepIndicator>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Upload & Source Selection */}
          {step === 'upload' && (
            <div className="space-y-4">
              <SourceSelector onSourcesReady={handleSourcesReady} />

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import Guidelines</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    <li>Required fields: name, address, latitude, longitude</li>
                    <li>Recommended: LGA, service_zone, level_of_care</li>
                    <li>Warehouse codes will be auto-generated if not provided</li>
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

          {/* Step 2/3: Map Columns */}
          {step === 'mapping' && parsedData && (
            <ColumnMapper
              csvHeaders={parsedData.headers}
              autoDetectedMappings={columnMappings}
              sampleRow={parsedData.rows[0]}
              onMappingsConfirmed={handleMappingsConfirmed}
              onBack={() => setStep('upload')}
            />
          )}

          {/* Step 3: Preview & Validate */}
          {step === 'preview' && parsedData && (
            <div className="space-y-4">
              {/* Column Mapping Diagnostics */}
              {parsedData.columnMappings && parsedData.columnMappings.length > 0 && (
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertTitle>Column Mapping Results</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {parsedData.columnMappings
                          .filter(m => m.isRecognized)
                          .map((mapping, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-success/10 border-success/20 text-success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {mapping.originalHeader} → {mapping.mappedTo}
                            </Badge>
                          ))}
                      </div>
                      {parsedData.columnMappings.some(m => !m.isRecognized) && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-warning">Unrecognized columns:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {parsedData.columnMappings
                              .filter(m => !m.isRecognized)
                              .map((mapping, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs bg-warning/10 border-warning/20 text-warning">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {mapping.originalHeader}
                                </Badge>
                              ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            These columns will be ignored during import.
                          </p>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Summary */}
              {validationSummary && (() => {
                const errorRate = parsedData && parsedData.rows.length > 0
                  ? (validationSummary.errors / parsedData.rows.length) * 100
                  : 0;
                const highErrorRate = errorRate > 20;
                const hasIssues = validationSummary.hasBlockingErrors || highErrorRate;

                return (
                  <Alert variant={hasIssues && !skipValidation ? 'destructive' : 'default'}>
                    {hasIssues && !skipValidation ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {hasIssues && !skipValidation ? 'Validation Issues Detected' : skipValidation ? 'Validation Skipped' : 'Validation Complete'}
                    </AlertTitle>
                    <AlertDescription>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="font-medium">
                          {parsedData.rows.length} rows
                        </Badge>
                        {validationSummary.errors > 0 && (
                          <Badge variant={skipValidation ? 'secondary' : 'destructive'} className="font-medium">
                            {validationSummary.errors} errors {skipValidation ? '(skipped)' : '(block import)'}
                          </Badge>
                        )}
                        {validationSummary.warnings > 0 && (
                          <Badge variant="secondary" className="bg-warning/10 text-warning font-medium border-warning/20">
                            {validationSummary.warnings} warnings (allowed)
                          </Badge>
                        )}
                        {errorRate > 0 && (
                          <Badge variant={highErrorRate && !skipValidation ? 'destructive' : 'outline'} className="font-medium">
                            {errorRate.toFixed(1)}% error rate
                          </Badge>
                        )}
                      </div>
                      {hasIssues && !skipValidation && (
                        <p className="text-sm mt-2">
                          Fix errors below, or enable "Skip Validation" to import with available data. Missing fields can be added later.
                        </p>
                      )}
                      {skipValidation && validationSummary.errors > 0 && (
                        <p className="text-sm mt-2 text-muted-foreground">
                          Rows with missing required fields (name) will be skipped. Other missing data can be filled in later.
                        </p>
                      )}
                      {!hasIssues && validationSummary.warnings > 0 && (
                        <p className="text-sm mt-2 text-muted-foreground">
                          Warnings won't block import, but it's recommended to review them for data quality.
                        </p>
                      )}

                      {/* Skip Validation Toggle */}
                      {hasIssues && (
                        <div className="flex items-center gap-3 mt-3 p-3 rounded-md border bg-muted/50">
                          <ShieldOff className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1">
                            <Label htmlFor="skip-validation" className="text-sm font-medium cursor-pointer">
                              Skip Validation
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Import facilities with available data. Missing info can be added later by editing each facility.
                            </p>
                          </div>
                          <Switch
                            id="skip-validation"
                            checked={skipValidation}
                            onCheckedChange={setSkipValidation}
                          />
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {/* Coordinate Swap Action */}
              {(() => {
                if (!parsedData) return null;
                const swappedRowIndices = parsedData.rows
                  .map((row, i) => {
                    const merged = { ...row, ...(editedRows[i] || {}) };
                    const lat = parseFloat(String(merged.latitude ?? merged.lat ?? ''));
                    const lng = parseFloat(String(merged.longitude ?? merged.lng ?? ''));
                    if (isNaN(lat) || isNaN(lng)) return null;
                    const issues = detectCoordinateIssues(lat, lng);
                    return issues.some((x) => x.type === 'likely_swapped') ? i : null;
                  })
                  .filter((i): i is number => i !== null);

                if (swappedRowIndices.length === 0) return null;

                return (
                  <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
                    <ArrowLeftRight className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                      {swappedRowIndices.length} {swappedRowIndices.length === 1 ? 'row has' : 'rows have'} likely swapped lat/lng
                    </AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                      <p className="text-sm mb-2">
                        Coordinates appear to be in longitude/latitude order instead of latitude/longitude.
                        This is a common issue with Nigerian health facility exports.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                        onClick={() => {
                          setEditedRows((prev) => {
                            const next = { ...prev };
                            swappedRowIndices.forEach((i) => {
                              const row = { ...parsedData.rows[i], ...(prev[i] || {}) };
                              const lat = parseFloat(String(row.latitude ?? row.lat ?? ''));
                              const lng = parseFloat(String(row.longitude ?? row.lng ?? ''));
                              next[i] = { ...row, latitude: lng, longitude: lat };
                            });
                            return next;
                          });
                          toast.success(`Swapped coordinates for ${swappedRowIndices.length} rows`);
                        }}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
                        Swap all {swappedRowIndices.length} rows
                      </Button>
                    </AlertDescription>
                  </Alert>
                );
              })()}

              {/* Data Preview Table (Virtualized) */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted border-b">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left font-medium w-12">#</th>
                        <th className="p-2 text-left font-medium min-w-[200px]">Name</th>
                        <th className="p-2 text-left font-medium min-w-[200px]">Address</th>
                        <th className="p-2 text-left font-medium w-24">Latitude</th>
                        <th className="p-2 text-left font-medium w-24">Longitude</th>
                        <th className="p-2 text-left font-medium min-w-[120px]">LGA</th>
                        <th className="p-2 text-left font-medium min-w-[120px]">Issues</th>
                      </tr>
                    </thead>
                  </table>
                </div>
                <div
                  ref={parentRef}
                  className="h-[400px] overflow-auto"
                >
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const idx = virtualRow.index;
                      const mergedRow = getMergedRow(idx);
                      const rowIssues = validationIssues.filter(i => i.row === idx + 1);
                      const hasErrors = rowIssues.some(i => i.severity === 'error');

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
                                <td className="p-2 border-t min-w-[200px]">
                                  <Input
                                    value={mergedRow.name || ''}
                                    onChange={(e) => handleCellEdit(idx, 'name', e.target.value)}
                                    className="h-8"
                                  />
                                </td>
                                <td className="p-2 border-t min-w-[200px]">
                                  <Input
                                    value={mergedRow.address || ''}
                                    onChange={(e) => handleCellEdit(idx, 'address', e.target.value)}
                                    className="h-8"
                                  />
                                </td>
                                <td className="p-2 border-t w-24">
                                  <Input
                                    value={mergedRow.latitude || ''}
                                    onChange={(e) => handleCellEdit(idx, 'latitude', e.target.value)}
                                    className="h-8 w-24"
                                  />
                                </td>
                                <td className="p-2 border-t w-24">
                                  <Input
                                    value={mergedRow.longitude || ''}
                                    onChange={(e) => handleCellEdit(idx, 'longitude', e.target.value)}
                                    className="h-8 w-24"
                                  />
                                </td>
                                <td className="p-2 border-t min-w-[120px]">{mergedRow.lga || '-'}</td>
                                <td className="p-2 border-t min-w-[120px]">
                                  {rowIssues.length > 0 && (
                                    <div className="flex gap-1">
                                      {rowIssues.filter(i => i.severity === 'error').length > 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                          {rowIssues.filter(i => i.severity === 'error').length} errors
                                        </Badge>
                                      )}
                                      {rowIssues.filter(i => i.severity === 'warning').length > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                          {rowIssues.filter(i => i.severity === 'warning').length} warnings
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
                  <ScrollArea className="h-[150px] border rounded-lg p-2">
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
                            {issue.value !== undefined && issue.value !== null && issue.value !== '' && (
                              <span className="block text-xs text-muted-foreground mt-0.5 font-mono bg-muted px-1.5 py-0.5 rounded">
                                Value: "{String(issue.value)}"
                              </span>
                            )}
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
              entityLabel="facility"
              getRecordName={(r) => String(r['name'] ?? '')}
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
                <h3 className="text-lg font-semibold mt-4">Importing Facilities...</h3>
                <p className="text-sm text-muted-foreground">
                  {cancelImport ? 'Cancelling import...' : 'Please wait while we import your data'}
                </p>
              </div>
              <div className="max-w-md mx-auto space-y-4">
                <Progress value={importProgress} className="h-2" />
                <div className="text-center space-y-1">
                  <p className="text-lg font-semibold">
                    {importProgress}% complete
                  </p>
                  {importStats.totalBatches > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Processing batch {importStats.currentBatch} of {importStats.totalBatches}
                      {' • '}
                      {importStats.processed} facilities processed
                    </p>
                  )}
                </div>
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelImport}
                    disabled={cancelImport}
                  >
                    <X className="h-4 w-4 mr-2" />
                    {cancelImport ? 'Cancelling...' : 'Cancel Import'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 p-6 border rounded-lg bg-muted/50">
                <CheckCircle className="h-12 w-12 text-success" />
                <div>
                  <h3 className="text-lg font-semibold">Import Complete</h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {importResult.success > 0 && (
                      <Badge variant="default" className="bg-green-600 text-white">
                        {importResult.success} inserted
                      </Badge>
                    )}
                    {importResult.updated > 0 && (
                      <Badge variant="default" className="bg-blue-600 text-white">
                        {importResult.updated} updated
                      </Badge>
                    )}
                    {importResult.skipped > 0 && (
                      <Badge variant="outline">
                        {importResult.skipped} skipped
                      </Badge>
                    )}
                    {importResult.failed > 0 && (
                      <Badge variant="destructive">
                        {importResult.failed} failed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Details */}
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

          {step === 'preview' && (() => {
            const errorRate = parsedData && parsedData.rows.length > 0 && validationSummary
              ? (validationSummary.errors / parsedData.rows.length) * 100
              : 0;
            const highErrorRate = errorRate > 20;
            const proceedDisabled = !skipValidation && (validationSummary?.hasBlockingErrors || highErrorRate);

            return (
              <>
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Mapping
                </Button>
                <Button
                  onClick={handleProceedToDiff}
                  disabled={proceedDisabled}
                  variant={skipValidation && validationSummary?.hasBlockingErrors ? 'secondary' : 'default'}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Review Changes ({parsedData?.rows.length} rows)
                </Button>
              </>
            );
          })()}

          {step === 'complete' && (
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/storefront/imports')}>
                View Import History
              </Button>
              <Button onClick={handleClose}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ active, completed, children }: { active: boolean; completed: boolean; children: React.ReactNode }) {
  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
      ${active ? 'bg-primary text-primary-foreground' : ''}
      ${completed ? 'bg-success text-success-foreground' : ''}
      ${!active && !completed ? 'bg-muted text-muted-foreground' : ''}
    `}>
      {completed && <CheckCircle className="h-4 w-4" />}
      {children}
    </div>
  );
}
