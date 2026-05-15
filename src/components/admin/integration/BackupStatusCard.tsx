import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Database,
  FileArchive,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface BackupSettings {
  last_backup_at?: string;
  last_backup_status?: 'success' | 'partial' | 'failed';
  last_backup_tables_total?: string;
  last_backup_tables_succeeded?: string;
  last_backup_files_synced?: string;
  last_backup_bytes?: string;
  last_backup_schema_version?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface BackupStatusCardProps {
  workspaceId: string | null | undefined;
}

export function BackupStatusCard({ workspaceId }: BackupStatusCardProps) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['backup-status', workspaceId],
    queryFn: async (): Promise<BackupSettings> => {
      if (!workspaceId) return {};

      const keys = [
        'last_backup_at',
        'last_backup_status',
        'last_backup_tables_total',
        'last_backup_tables_succeeded',
        'last_backup_files_synced',
        'last_backup_bytes',
        'last_backup_schema_version',
      ];

      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .eq('workspace_id', workspaceId)
        .in('setting_key', keys);

      if (error) throw error;

      return (data ?? []).reduce<BackupSettings>((acc, row) => {
        (acc as Record<string, string>)[row.setting_key] = row.setting_value;
        return acc;
      }, {});
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const status = settings?.last_backup_status;
  const lastBackupAt = settings?.last_backup_at;
  const tablesTotal = settings?.last_backup_tables_total;
  const tablesSucceeded = settings?.last_backup_tables_succeeded;
  const filesSynced = settings?.last_backup_files_synced;
  const bytes = settings?.last_backup_bytes ? Number(settings.last_backup_bytes) : null;
  const schemaVersion = settings?.last_backup_schema_version;

  const StatusBadge = () => {
    if (!status) return null;
    switch (status) {
      case 'success':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="secondary" className="bg-red-500/10 text-red-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30 animate-pulse">
        <div className="p-2 rounded-lg bg-muted h-9 w-9" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-48" />
          <div className="h-3 bg-muted rounded w-64" />
        </div>
      </div>
    );
  }

  const hasBackup = !!lastBackupAt;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-4 flex-1">
        <div className="p-2 rounded-lg bg-primary/10">
          <HardDrive className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">Backup & Redundancy</h4>
            {hasBackup && <StatusBadge />}
            {!hasBackup && (
              <Badge variant="secondary" className="bg-slate-500/10 text-slate-500">
                Never backed up
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            OneDrive cold redundancy — encrypted copy of Supabase DB and file storage.
          </p>

          {hasBackup && lastBackupAt && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground mt-1 cursor-default inline-flex items-center gap-1 w-fit">
                    <Clock className="h-3 w-3" />
                    Last backup: {formatDistanceToNow(new Date(lastBackupAt), { addSuffix: true })}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {format(new Date(lastBackupAt), 'dd MMM yyyy HH:mm:ss')} UTC
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {hasBackup && (
        <div className="flex items-center gap-6 text-right pr-2">
          {tablesSucceeded && tablesTotal && (
            <div className="flex items-center gap-1.5">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium leading-none">
                  {tablesSucceeded}/{tablesTotal}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">tables</p>
              </div>
            </div>
          )}

          {filesSynced && (
            <div className="flex items-center gap-1.5">
              <FileArchive className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium leading-none">
                  {Number(filesSynced).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">files</p>
              </div>
            </div>
          )}

          {bytes !== null && bytes > 0 && (
            <div>
              <p className="text-sm font-medium leading-none">{formatBytes(bytes)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">backed up</p>
            </div>
          )}

          {schemaVersion && (
            <div className="hidden lg:block">
              <p className="text-xs text-muted-foreground font-mono">{schemaVersion}</p>
              <p className="text-xs text-muted-foreground mt-0.5">schema version</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
