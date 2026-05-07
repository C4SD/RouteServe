import { useState } from 'react';
import { format } from 'date-fns';
import {
  History,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import {
  useImportSessions,
  useImportSessionEntries,
  useResolveImportConflict,
  useApplySkippedEntry,
  useRetryImportEntry,
  useDismissImportEntry,
  type ImportSession,
  type ImportLogEntry,
  type ImportOutcome,
  type ImportSessionFilters,
} from '@/hooks/useImportSessions';
import type { FieldDiff } from '@/lib/import-diff';

// ─── Outcome display helpers ───────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: ImportOutcome }) {
  switch (outcome) {
    case 'inserted':
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">inserted</Badge>;
    case 'updated':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">updated</Badge>;
    case 'skipped_duplicate':
      return <Badge variant="outline" className="text-muted-foreground text-xs">duplicate</Badge>;
    case 'skipped_by_user':
      return <Badge variant="outline" className="text-muted-foreground text-xs">skipped</Badge>;
    case 'conflict_pending':
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs">conflict pending</Badge>;
    case 'error':
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs">error</Badge>;
  }
}

function EntityLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    facility: 'Facilities',
    item: 'Items',
    program_item: 'Program Items',
  };
  return <span>{labels[type] ?? type}</span>;
}

// ─── Session summary row ───────────────────────────────────────────────────────

function SessionRow({
  session,
  isSelected,
  onSelect,
}: {
  session: ImportSession;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const hasPending = session.failed > 0 || (session.status === 'partial');

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors ${isSelected ? 'bg-muted' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            <EntityLabel type={session.entity_type} />
            {session.source_file && ` — ${session.source_file}`}
          </span>
          {hasPending && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs shrink-0">
              needs attention
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span>{format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}</span>
          <span className="flex items-center gap-1">
            <CheckCircle className="size-3 text-green-500" />{session.inserted} inserted
          </span>
          <span className="flex items-center gap-1">
            <RefreshCw className="size-3 text-blue-500" />{session.updated} updated
          </span>
          <span className="flex items-center gap-1">
            <Info className="size-3 text-muted-foreground" />{session.skipped} skipped
          </span>
          {session.failed > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="size-3" />{session.failed} failed
            </span>
          )}
        </div>
      </div>
      <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
    </button>
  );
}

// ─── Field diff display ────────────────────────────────────────────────────────

function FieldDiffDisplay({ diffs }: { diffs: FieldDiff[] }) {
  return (
    <div className="space-y-1 py-1">
      {diffs.filter(d => d.kind !== 'unchanged').map(diff => (
        <div key={diff.field} className="flex items-start gap-2 text-xs">
          <span className="w-32 shrink-0 text-muted-foreground capitalize">
            {diff.field.replace(/_/g, ' ')}
          </span>
          {diff.kind === 'enrichment' ? (
            <span className="text-green-700 dark:text-green-400">
              (empty) → <strong>{String(diff.uploadValue)}</strong>
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">
              <span className="line-through text-muted-foreground mr-1">{String(diff.dbValue)}</span>
              ↔ <strong>{String(diff.uploadValue)}</strong>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Single log entry row ─────────────────────────────────────────────────────

function EntryRow({
  entry,
  entityType,
}: {
  entry: ImportLogEntry;
  entityType: 'facility' | 'item' | 'program_item';
}) {
  const [open, setOpen] = useState(false);
  const resolve = useResolveImportConflict();
  const applySkipped = useApplySkippedEntry();
  const retry = useRetryImportEntry();
  const dismiss = useDismissImportEntry();

  const navigate = useNavigate();
  const entityPath = entityType === 'facility' ? '/storefront/facilities' : '/storefront/items';

  const isResolved = !!entry.resolved_at;
  const hasDiffs = entry.field_diffs && entry.field_diffs.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`border-b py-2 ${isResolved ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <OutcomeBadge outcome={entry.outcome} />
              <span className="text-sm font-medium truncate">
                {entry.record_name ?? `Row ${entry.row_number}`}
              </span>
              {entry.match_confidence === 'fuzzy_name' && (
                <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                  fuzzy match
                </Badge>
              )}
              {isResolved && (
                <span className="text-xs text-muted-foreground">
                  resolved {format(new Date(entry.resolved_at!), 'MMM d HH:mm')}
                </span>
              )}
            </div>
            {entry.error_message && (
              <p className="text-xs text-red-600 mt-0.5">{entry.error_message}</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {hasDiffs && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </Button>
              </CollapsibleTrigger>
            )}

            {/* Action buttons per outcome */}
            {!isResolved && entry.outcome === 'conflict_pending' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ entry, action: 'keep_db', entityType })}
                >
                  Keep DB
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ entry, action: 'apply_upload', entityType })}
                >
                  Apply Upload
                </Button>
              </>
            )}

            {!isResolved && entry.outcome === 'skipped_by_user' && hasDiffs && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={applySkipped.isPending}
                onClick={() => applySkipped.mutate({ entry, entityType })}
              >
                Apply Now
              </Button>
            )}

            {!isResolved && entry.outcome === 'error' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate({ entry, entityType })}
                >
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => dismiss.mutate(entry.id)}
                >
                  Dismiss
                </Button>
              </>
            )}

            {entry.entity_id && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => navigate(entityPath)}
                title="View record"
              >
                <ExternalLink className="size-3" />
              </Button>
            )}
          </div>
        </div>

        <CollapsibleContent>
          {hasDiffs && (
            <div className="ml-12 mt-1">
              <FieldDiffDisplay diffs={entry.field_diffs!} />
            </div>
          )}
          {entry.raw_data && entry.outcome === 'error' && (
            <details className="ml-12 mt-1">
              <summary className="text-xs text-muted-foreground cursor-pointer">Raw data</summary>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                {JSON.stringify(entry.raw_data, null, 2)}
              </pre>
            </details>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Session detail panel ──────────────────────────────────────────────────────

function SessionDetail({
  session,
  onBack,
}: {
  session: ImportSession;
  onBack: () => void;
}) {
  const [outcomeFilter, setOutcomeFilter] = useState<ImportOutcome | 'all'>('all');
  const { data: entries = [], isLoading } = useImportSessionEntries(session.id, outcomeFilter);

  const conflictCount = entries.filter(e => e.outcome === 'conflict_pending' && !e.resolved_at).length;
  const errorCount = entries.filter(e => e.outcome === 'error' && !e.resolved_at).length;

  const exportCsv = () => {
    const rows = [
      ['Row', 'Outcome', 'Record Name', 'Error', 'Match Confidence'],
      ...entries.map(e => [
        e.row_number,
        e.outcome,
        e.record_name ?? '',
        e.error_message ?? '',
        e.match_confidence ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-${session.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">
            <EntityLabel type={session.entity_type} />
            {session.source_file && ` — ${session.source_file}`}
          </h2>
          <p className="text-xs text-muted-foreground">
            {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')} ·{' '}
            {session.total_rows} rows · {session.inserted} inserted · {session.updated} updated ·{' '}
            {session.skipped} skipped · {session.failed} failed
            {conflictCount > 0 && ` · ${conflictCount} conflicts pending`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4 mr-1" /> Export
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={outcomeFilter}
        onValueChange={v => setOutcomeFilter(v as ImportOutcome | 'all')}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-4 pt-2">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7">All ({session.total_rows})</TabsTrigger>
            <TabsTrigger value="inserted" className="text-xs h-7">New ({session.inserted})</TabsTrigger>
            <TabsTrigger value="updated" className="text-xs h-7">Updated ({session.updated})</TabsTrigger>
            <TabsTrigger value="conflict_pending" className="text-xs h-7 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
              Conflicts {conflictCount > 0 && `(${conflictCount})`}
            </TabsTrigger>
            <TabsTrigger value="error" className="text-xs h-7 data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
              Errors {errorCount > 0 && `(${errorCount})`}
            </TabsTrigger>
            <TabsTrigger value="skipped_duplicate" className="text-xs h-7">Skipped ({session.skipped})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={outcomeFilter} className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full px-4">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No entries for this filter.</div>
            ) : (
              <div className="py-2">
                {entries.map(entry => (
                  <EntryRow key={entry.id} entry={entry} entityType={session.entity_type} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ImportHistoryPage() {
  const [filters, setFilters] = useState<ImportSessionFilters>({});
  const [selectedSession, setSelectedSession] = useState<ImportSession | null>(null);
  const { data: sessions = [], isLoading } = useImportSessions(filters);

  if (selectedSession) {
    return (
      <div className="h-full flex flex-col">
        <SessionDetail
          session={selectedSession}
          onBack={() => setSelectedSession(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Import History</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filters.entityType ?? 'all'}
            onValueChange={v => setFilters(f => ({ ...f, entityType: v === 'all' ? undefined : v as ImportSessionFilters['entityType'] }))}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="facility">Facilities</SelectItem>
              <SelectItem value="item">Items</SelectItem>
              <SelectItem value="program_item">Program Items</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? undefined : v as ImportSessionFilters['status'] }))}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading import history…</div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <History className="size-8 mx-auto mb-2 opacity-30" />
            No import sessions yet. Upload facilities, items, or program items to get started.
          </div>
        ) : (
          sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              isSelected={selectedSession?.id === session.id}
              onSelect={() => setSelectedSession(session)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
