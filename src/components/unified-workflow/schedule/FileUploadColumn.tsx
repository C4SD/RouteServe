/**
 * =====================================================
 * File Upload Column (Left Column — Upload source)
 * =====================================================
 * Accepts PDF, CSV, XLSX, DOCX, extracts facility names,
 * then opens FacilityMatchingStep as a popup dialog for review.
 * After confirming, closes back to the 3-column scheduler layout.
 */

import * as React from 'react';
import {
  Upload,
  Loader2,
  XCircle,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FacilityMatchingStep } from '@/components/shared/FacilityMatchingStep';
import { bestMatch } from '@/lib/facility-matcher';
import type { ParsedFacility } from '@/types/unified-workflow';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Facility {
  id: string;
  name: string;
  lga?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface FileUploadColumnProps {
  allFacilities: Facility[];
  parsedFacilities: ParsedFacility[] | null;
  onFileParsed: (facilities: ParsedFacility[]) => void;
  onUpdateRow: (rowIndex: number, updates: Partial<ParsedFacility>) => void;
  onAddValidToWorkingSet: () => void;
  className?: string;
}

// ─── File-type icon ───────────────────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'xlsx')
    return <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

// ─── File parsers ─────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = '.csv,.xlsx,.pdf,.docx';

async function parseCSV(file: File): Promise<string[]> {
  const Papa = await import('papaparse');
  return new Promise((resolve, reject) => {
    Papa.default.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) return resolve([]);
        const colNames = Object.keys(rows[0]);
        const FACILITY_HEADER_RE =
          /facility|consignee|recipient|health.{0,10}facility|delivery.{0,5}point|dispatch.{0,5}point|site|location|destination/i;
        const facilityCol =
          colNames.find((c) => FACILITY_HEADER_RE.test(c)) ??
          // Heuristic fallback: prefer the column with the most non-numeric values
          colNames.reduce((best, col) => {
            const nonNumeric = rows.filter(r => r[col] && !/^\d+$/.test(r[col])).length;
            const bestNonNumeric = rows.filter(r => r[best] && !/^\d+$/.test(r[best])).length;
            return nonNumeric > bestNonNumeric ? col : best;
          }, colNames[0]);
        resolve(rows.map((r) => r[facilityCol]).filter(Boolean));
      },
      error: (err: any) => reject(err),
    });
  });
}

async function parseXLSX(file: File): Promise<string[]> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.default.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  // headers is 1-indexed (ExcelJS col is 1-based)
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value || '');
  });

  // Prefer columns whose header looks like a facility/place name field
  const FACILITY_HEADER_RE =
    /facility|consignee|recipient|health.{0,10}facility|delivery.{0,5}point|dispatch.{0,5}point|site|location|destination/i;

  let colIdx = headers.findIndex((h) => FACILITY_HEADER_RE.test(h));

  if (colIdx === -1) {
    // Heuristic: pick the column with the most distinct non-numeric string values
    // (row numbers / serial numbers are purely numeric and should score low)
    const colScores = new Map<number, number>();
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      row.eachCell((cell, col) => {
        const v = String(cell.value ?? '').trim();
        if (v && !/^\d+$/.test(v)) {
          colScores.set(col, (colScores.get(col) ?? 0) + 1);
        }
      });
    });
    let bestCol = 1;
    let bestScore = -1;
    for (const [col, score] of colScores) {
      if (score > bestScore) { bestScore = score; bestCol = col; }
    }
    colIdx = bestCol;
  }

  const names: string[] = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const val = row.getCell(colIdx).value;
    if (val) names.push(String(val).trim());
  });
  return names;
}

async function parsePDF(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    content.items
      .map((item: any) => item.str)
      .join(' ')
      .split(/[\n\r]+/)
      .forEach((l: string) => {
        const t = l.trim();
        if (t.length > 2) lines.push(t);
      });
  }
  return lines;
}

async function parseDOCX(file: File): Promise<string[]> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const div = document.createElement('div');
  div.innerHTML = result.value;
  return (div.textContent || '')
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
}

async function extractFacilityNames(file: File): Promise<string[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv': return parseCSV(file);
    case 'xlsx': return parseXLSX(file);
    case 'pdf': return parsePDF(file);
    case 'docx': return parseDOCX(file);
    default: throw new Error(`Unsupported file type: .${ext}`);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileUploadColumn({
  allFacilities,
  parsedFacilities,
  onFileParsed,
  onUpdateRow,
  onAddValidToWorkingSet,
  className,
}: FileUploadColumnProps) {
  const [isParsing, setIsParsing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [matchingOpen, setMatchingOpen] = React.useState(false);

  // Auto-open the matching dialog as soon as a file is freshly parsed
  const hadParsedRef = React.useRef(false);
  React.useEffect(() => {
    if (parsedFacilities && !hadParsedRef.current) {
      setMatchingOpen(true);
    }
    hadParsedRef.current = !!parsedFacilities;
  }, [parsedFacilities]);

  const handleFile = React.useCallback(
    async (file: File) => {
      setIsParsing(true);
      setError(null);
      setFileName(file.name);

      try {
        const names = await extractFacilityNames(file);
        if (names.length === 0) {
          setError('No facility names found in the file. Please check the format.');
          return;
        }

        const unique = [...new Set(names)];

        const parsed: ParsedFacility[] = unique.map((rawName, idx) => {
          const match = bestMatch(rawName, allFacilities, 0.5);
          return {
            row_index: idx,
            raw_name: rawName,
            matched_facility_id: match?.id ?? null,
            matched_facility_name: match?.name ?? null,
            confidence_score: match?.score ?? 0,
            is_valid: !!match,
            // Carry coordinates so road routing works without a second lookup
            lat: match?.facility.lat ?? undefined,
            lng: match?.facility.lng ?? undefined,
          };
        });

        onFileParsed(parsed);
      } catch (err: any) {
        setError(err.message || 'Failed to parse file');
      } finally {
        setIsParsing(false);
      }
    },
    [allFacilities, onFileParsed],
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  function handleReset() {
    onFileParsed(null as any);
    setFileName(null);
    setError(null);
    setMatchingOpen(false);
    hadParsedRef.current = false;
  }

  function handleConfirm() {
    onAddValidToWorkingSet();
    setMatchingOpen(false);
  }

  // Summary stats for compact view
  const matchedCount =
    parsedFacilities?.filter(
      (f) => f.is_valid && !(f.user_corrected && !f.matched_facility_id),
    ).length ?? 0;
  const needsReviewCount =
    parsedFacilities?.filter(
      (f) => !f.is_valid && !(f.user_corrected && !f.matched_facility_id),
    ).length ?? 0;
  const skippedCount =
    parsedFacilities?.filter((f) => f.user_corrected && !f.matched_facility_id).length ?? 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Upload zone */}
      {!parsedFacilities && !isParsing && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
              'hover:border-primary/50 hover:bg-accent/30 text-muted-foreground',
            )}
          >
            <Upload className="h-10 w-10" />
            <div className="text-center">
              <p className="font-medium text-foreground">Drop file here or click to browse</p>
              <p className="text-xs mt-1">Supports PDF, CSV, XLSX, DOCX</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mt-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </>
      )}

      {/* Parsing spinner */}
      {isParsing && (
        <div className="flex flex-col items-center justify-center gap-3 p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Parsing {fileName}…</p>
        </div>
      )}

      {/* Compact summary after file is loaded */}
      {parsedFacilities && !isParsing && (
        <div className="flex flex-col gap-3">
          {/* File chip */}
          <div className="flex items-center gap-2 text-sm">
            <FileIcon name={fileName || ''} />
            <span className="font-medium truncate max-w-[160px]">{fileName}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs text-muted-foreground h-6 px-2"
              onClick={handleReset}
            >
              Change file
            </Button>
          </div>

          {/* Stats */}
          <p className="text-xs text-muted-foreground">
            {parsedFacilities.length} facilities from file
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matchedCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {matchedCount} matched
              </Badge>
            )}
            {needsReviewCount > 0 && (
              <Badge
                variant="secondary"
                className="gap-1 text-[11px] text-amber-700 bg-amber-50"
              >
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                {needsReviewCount} need review
              </Badge>
            )}
            {skippedCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <SkipForward className="h-3 w-3 text-muted-foreground" />
                {skippedCount} skipped
              </Badge>
            )}
          </div>

          {/* Re-open dialog */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 mt-1"
            onClick={() => setMatchingOpen(true)}
          >
            {needsReviewCount > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Review {needsReviewCount} unmatched
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                Review matches
              </>
            )}
          </Button>
        </div>
      )}

      {/* Facility Matching Dialog */}
      <Dialog open={matchingOpen} onOpenChange={setMatchingOpen}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-base font-semibold">
              Review facility matches
              {fileName && (
                <span className="text-muted-foreground font-normal ml-2 text-sm">
                  — {fileName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6 py-5 min-h-0">
            {parsedFacilities && (
              <FacilityMatchingStep
                parsedFacilities={parsedFacilities}
                allFacilities={allFacilities}
                onUpdate={onUpdateRow}
                onConfirm={handleConfirm}
                confirmLabel={`Add ${matchedCount} to schedule`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FileUploadColumn;
