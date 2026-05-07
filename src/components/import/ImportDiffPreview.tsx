import { useState } from 'react';
import { CheckCircle, AlertTriangle, Info, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ImportDiffResult, DiffRecord, FieldDiff, DbRow } from '@/lib/import-diff';

interface ImportDiffPreviewProps {
  diffResult: ImportDiffResult;
  onConfirm: (selectedUpdateIds: Set<string>) => void;
  onBack: () => void;
  entityLabel: string;
  getRecordName: (record: DbRow) => string;
  isCommitting?: boolean;
}

// ─── Field diff row ────────────────────────────────────────────────────────────

function FieldDiffRow({ diff }: { diff: FieldDiff }) {
  const dbDisplay = diff.dbValue == null || diff.dbValue === '' ? '(empty)' : String(diff.dbValue);
  const uploadDisplay = diff.uploadValue == null || diff.uploadValue === '' ? '(empty)' : String(diff.uploadValue);
  const label = diff.field.replace(/_/g, ' ');

  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <span className="w-36 shrink-0 text-muted-foreground capitalize">{label}</span>
      {diff.kind === 'enrichment' ? (
        <>
          <span className="text-muted-foreground line-through">{dbDisplay}</span>
          <ArrowRight className="size-3 shrink-0 mt-0.5 text-green-500" />
          <span className="text-green-700 dark:text-green-400 font-medium">{uploadDisplay}</span>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">{dbDisplay}</span>
          <span className="text-amber-500 mx-1">↔</span>
          <span className="text-amber-700 dark:text-amber-400 font-medium">{uploadDisplay}</span>
        </>
      )}
    </div>
  );
}

// ─── Single update record row ─────────────────────────────────────────────────

function UpdateRow({
  rec,
  checked,
  onToggle,
  getRecordName,
}: {
  rec: DiffRecord;
  checked: boolean;
  onToggle: () => void;
  getRecordName: (r: DbRow) => string;
}) {
  const [open, setOpen] = useState(false);
  const enrichments = rec.fieldDiffs.filter(d => d.kind === 'enrichment');
  const conflicts = rec.fieldDiffs.filter(d => d.kind === 'conflict');

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-start gap-3 py-2 border-b last:border-0">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className="mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{getRecordName(rec.uploadRow)}</span>
            {rec.matchConfidence === 'fuzzy_name' && (
              <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs shrink-0">
                <AlertTriangle className="size-3 mr-1" />
                fuzzy match — verify
              </Badge>
            )}
            {enrichments.length > 0 && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs shrink-0">
                {enrichments.length} enrichment{enrichments.length > 1 ? 's' : ''}
              </Badge>
            )}
            {conflicts.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs shrink-0">
                {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {rec.matchConfidence === 'fuzzy_name' && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Matched by name similarity. If this is a different record, uncheck to skip.
            </p>
          )}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="ml-7 mb-2 pl-3 border-l space-y-0">
          {rec.fieldDiffs.map(diff => (
            <FieldDiffRow key={diff.field} diff={diff} />
          ))}
          {!checked && conflicts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              Unchecked rows with conflicts are saved as "conflict pending" — resolve later in Import History.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImportDiffPreview({
  diffResult,
  onConfirm,
  onBack,
  entityLabel,
  getRecordName,
  isCommitting = false,
}: ImportDiffPreviewProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(diffResult.updateRecords.map(r => r.dbId))
  );

  const toggleOne = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(diffResult.updateRecords.map(r => r.dbId)));
  const deselectAll = () => setSelected(new Set());

  const { newRecords, updateRecords, duplicateRecords } = diffResult;
  const newCount = newRecords.length;
  const updateCount = updateRecords.length;
  const dupCount = duplicateRecords.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary banner */}
      <div className="flex items-center gap-4 rounded-lg border p-3 bg-muted/40 text-sm flex-wrap">
        <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
          <CheckCircle className="size-4" />
          {newCount} new
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
          <AlertTriangle className="size-4" />
          {updateCount} update{updateCount !== 1 ? 's' : ''}
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Info className="size-4" />
          {dupCount} exact duplicate{dupCount !== 1 ? 's' : ''} (auto-skipped)
        </span>
      </div>

      <Tabs defaultValue={updateCount > 0 ? 'updates' : newCount > 0 ? 'new' : 'skipped'}>
        <TabsList className="w-full">
          <TabsTrigger value="new" className="flex-1">
            New ({newCount})
          </TabsTrigger>
          <TabsTrigger value="updates" className="flex-1">
            Updates ({updateCount})
          </TabsTrigger>
          <TabsTrigger value="skipped" className="flex-1">
            Skipped ({dupCount})
          </TabsTrigger>
        </TabsList>

        {/* New records tab */}
        <TabsContent value="new">
          {newCount === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No new {entityLabel}s in this file.</p>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-0.5 py-1">
                {newRecords.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm">
                    <CheckCircle className="size-4 text-green-500 shrink-0" />
                    <span>{getRecordName(row)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Updates tab */}
        <TabsContent value="updates">
          {updateCount === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No updates in this file.</p>
          ) : (
            <>
              <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
                <span>{selected.size} of {updateCount} selected</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAll}>
                    Select all
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={deselectAll}>
                    Deselect all
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="pr-3">
                  {updateRecords.map(rec => (
                    <UpdateRow
                      key={rec.dbId}
                      rec={rec}
                      checked={selected.has(rec.dbId)}
                      onToggle={() => toggleOne(rec.dbId)}
                      getRecordName={getRecordName}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>

        {/* Skipped tab */}
        <TabsContent value="skipped">
          {dupCount === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No exact duplicates found.</p>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-0.5 py-1">
                {duplicateRecords.map((rec, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b last:border-0 text-sm text-muted-foreground">
                    <Info className="size-4 shrink-0" />
                    <span>{getRecordName(rec.uploadRow)}</span>
                    <span className="ml-auto text-xs">exact duplicate</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Conflict note */}
      {updateRecords.some(r => r.fieldDiffs.some(d => d.kind === 'conflict') && !selected.has(r.dbId)) && (
        <p className="text-xs text-muted-foreground border rounded p-2">
          Unchecked rows with conflicts will be logged as "conflict pending" in Import History, where you can resolve them individually.
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="outline" onClick={onBack} disabled={isCommitting}>
          ← Back
        </Button>
        <Button
          onClick={() => onConfirm(selected)}
          disabled={isCommitting || (newCount === 0 && selected.size === 0)}
        >
          {isCommitting ? 'Importing…' : `Confirm Import (${newCount + selected.size} records)`}
        </Button>
      </div>
    </div>
  );
}
