import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileSpreadsheet,
  FileUp,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  inspectFile,
  parseSelectedSources,
  type FileInfo,
  type SheetInfo,
  type MultiSourceResult,
  type SourceSelection,
} from '@/lib/multi-source-parser';

export interface SourceSelectorProps {
  onSourcesReady: (result: MultiSourceResult) => void;
  onBack?: () => void;
  accept?: string;
  maxFiles?: number;
}

interface FileEntry {
  info: FileInfo;
  selectedSheets: Set<number>; // sheet indices
  expanded: boolean;
}

export function SourceSelector({
  onSourcesReady,
  onBack,
  accept = '.csv,.xlsx,.xls',
  maxFiles = 10,
}: SourceSelectorProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (newFiles: File[]) => {
    if (newFiles.length === 0) return;

    setInspecting(true);
    const toastId = toast.loading('Inspecting files...');

    try {
      const entries: FileEntry[] = [];

      for (const file of newFiles) {
        const info = await inspectFile(file);
        const allSheetIndices = new Set(info.sheets.map(s => s.index));
        entries.push({
          info,
          // Auto-select all sheets
          selectedSheets: allSheetIndices,
          expanded: info.sheets.length > 1,
        });
      }

      setFiles(prev => {
        const combined = [...prev, ...entries];
        if (combined.length > maxFiles) {
          toast.warning(`Maximum ${maxFiles} files allowed`);
          return combined.slice(0, maxFiles);
        }
        return combined;
      });

      toast.dismiss(toastId);

      // Auto-advance for simple cases: single CSV or single-sheet Excel
      if (entries.length === 1 && entries[0].info.sheets.length === 1 && files.length === 0) {
        handleContinue([{
          info: entries[0].info,
          selectedSheets: entries[0].selectedSheets,
          expanded: false,
        }]);
        return;
      }

      toast.success(`${entries.length} file(s) inspected`);
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(`Failed to inspect file: ${error.message}`);
    } finally {
      setInspecting(false);
    }
  }, [files.length, maxFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target?.files;
    if (!selected) return;
    addFiles(Array.from(selected));
    e.target.value = '';
  }, [addFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }, [addFiles]);

  const toggleSheet = useCallback((fileIdx: number, sheetIdx: number) => {
    setFiles(prev => prev.map((entry, i) => {
      if (i !== fileIdx) return entry;
      const next = new Set(entry.selectedSheets);
      if (next.has(sheetIdx)) {
        next.delete(sheetIdx);
      } else {
        next.add(sheetIdx);
      }
      return { ...entry, selectedSheets: next };
    }));
  }, []);

  const toggleExpanded = useCallback((fileIdx: number) => {
    setFiles(prev => prev.map((entry, i) =>
      i === fileIdx ? { ...entry, expanded: !entry.expanded } : entry
    ));
  }, []);

  const removeFile = useCallback((fileIdx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== fileIdx));
  }, []);

  const handleContinue = useCallback(async (filesToParse?: FileEntry[]) => {
    const entries = filesToParse || files;
    const selections: SourceSelection[] = [];

    for (const entry of entries) {
      for (const sheetIdx of entry.selectedSheets) {
        const sheet = entry.info.sheets.find(s => s.index === sheetIdx);
        if (entry.info.format === 'csv') {
          selections.push({
            file: entry.info.file,
            sheetName: entry.info.file.name,
          });
        } else {
          selections.push({
            file: entry.info.file,
            sheetIndex: sheetIdx,
            sheetName: sheet?.name || `Sheet ${sheetIdx + 1}`,
          });
        }
      }
    }

    if (selections.length === 0) {
      toast.error('Please select at least one data source');
      return;
    }

    setParsing(true);
    const toastId = toast.loading('Parsing selected sources...');

    try {
      const result = await parseSelectedSources(selections);
      toast.dismiss(toastId);

      // Build descriptive toast with merge stats
      let msg = `Parsed ${result.rows.length} rows from ${result.sources.length} source(s)`;
      if (result.mergeResult) {
        const { autoMergedCount, conflicts } = result.mergeResult;
        if (autoMergedCount > 0) msg += ` (${autoMergedCount} auto-merged)`;
        if (conflicts.length > 0) msg += ` — ${conflicts.length} conflict(s) to review`;
      }
      toast.success(msg);
      onSourcesReady(result);
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(`Failed to parse: ${error.message}`);
    } finally {
      setParsing(false);
    }
  }, [files, onSourcesReady]);

  const totalSelectedRows = files.reduce((sum, entry) => {
    return sum + entry.info.sheets
      .filter(s => entry.selectedSheets.has(s.index))
      .reduce((s, sheet) => s + sheet.rowCount, 0);
  }, 0);

  const totalSelectedSources = files.reduce(
    (sum, entry) => sum + entry.selectedSheets.size,
    0
  );

  // No files added yet — show drop zone
  if (files.length === 0) {
    return (
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            CSV, XLSX, XLS — multiple files supported
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={inspecting}
            onClick={() => fileInputRef.current?.click()}
          >
            {inspecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            {inspecting ? 'Inspecting...' : 'Choose Files'}
          </Button>
          <input
            ref={fileInputRef}
            name="file-upload"
            type="file"
            multiple
            accept={accept}
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        )}
      </div>
    );
  }

  // Files added — show source list with sheet selection
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Data Sources</h3>
          <p className="text-xs text-muted-foreground">
            {totalSelectedSources} source(s) selected — {totalSelectedRows} total rows
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={inspecting}
          onClick={() => addMoreInputRef.current?.click()}
        >
          {inspecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          Add More
        </Button>
        <input
          ref={addMoreInputRef}
          name="file-upload-more"
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      <ScrollArea className="max-h-[300px]">
        <div className="space-y-2">
          {files.map((entry, fileIdx) => (
            <div key={fileIdx} className="border rounded-lg">
              {/* File header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate flex-1">
                  {entry.info.file.name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {entry.info.format.toUpperCase()}
                </Badge>
                {entry.info.sheets.length > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    {entry.info.sheets.length} sheets
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => removeFile(fileIdx)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Sheet list for multi-sheet Excel files */}
              {entry.info.sheets.length > 1 ? (
                <div>
                  <button
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/20 w-full"
                    onClick={() => toggleExpanded(fileIdx)}
                  >
                    {entry.expanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {entry.selectedSheets.size} of {entry.info.sheets.length} sheets selected
                  </button>

                  {entry.expanded && (
                    <div className="border-t max-h-[200px] overflow-y-auto">
                      {entry.info.sheets.map((sheet) => (
                        <SheetRow
                          key={sheet.index}
                          sheet={sheet}
                          selected={entry.selectedSheets.has(sheet.index)}
                          onToggle={() => toggleSheet(fileIdx, sheet.index)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Single-sheet file: show inline info
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-t">
                  {entry.info.sheets[0]?.rowCount ?? 0} rows —{' '}
                  {entry.info.sheets[0]?.headers.slice(0, 4).join(', ')}
                  {(entry.info.sheets[0]?.headers.length ?? 0) > 4 && '...'}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex justify-between">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        )}
        <Button
          onClick={() => handleContinue()}
          disabled={parsing || totalSelectedSources === 0}
          className="ml-auto"
        >
          {parsing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {parsing ? 'Parsing...' : `Continue with ${totalSelectedRows} rows`}
        </Button>
      </div>
    </div>
  );
}

function SheetRow({
  sheet,
  selected,
  onToggle,
}: {
  sheet: SheetInfo;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/20 cursor-pointer"
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{sheet.name}</div>
        <div className="text-xs text-muted-foreground">
          {sheet.rowCount} rows —{' '}
          {sheet.headers.slice(0, 4).join(', ')}
          {sheet.headers.length > 4 && '...'}
        </div>
        {sheet.sampleValues.length > 0 && (
          <div className="text-xs text-muted-foreground/60 truncate mt-0.5">
            e.g. {sheet.sampleValues.slice(0, 3).filter(Boolean).join(', ')}
          </div>
        )}
      </div>
      <Badge variant="outline" className="text-xs flex-shrink-0">
        {sheet.rowCount}
      </Badge>
    </label>
  );
}
