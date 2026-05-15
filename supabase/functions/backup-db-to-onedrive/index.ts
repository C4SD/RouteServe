import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  getGraphToken,
  ensureFolder,
  uploadFile,
  encryptAndCompress,
  sha256hex,
  type OneDriveConfig,
} from "../_shared/onedrive-client.ts";

// ─── Table tiers ──────────────────────────────────────────────────────────────

const TIER1 = [
  'workspaces', 'zones', 'lgas', 'admin_units', 'countries',
  'facilities', 'warehouses', 'programs', 'funding_sources',
  'implementing_partners', 'items', 'vehicles', 'drivers',
  'fleets', 'vendors', 'profiles', 'roles', 'permissions',
  'permission_sets', 'workspace_members', 'user_roles', 'user_scope_bindings',
];

const TIER2 = [
  'requisitions', 'requisition_items', 'invoices', 'invoice_line_items',
  'invoice_packaging', 'package_items', 'delivery_batches', 'dispatch_runs',
  'delivery_schedules', 'delivery_logs', 'route_history', 'handoffs',
  'routes', 'route_facilities', 'service_areas', 'service_area_facilities',
  'service_zones', 'service_policies', 'policy_clusters', 'policy_cluster_facilities',
  'facility_services', 'facility_stock', 'facility_assignments', 'facility_deliveries',
  'warehouse_inventory', 'inventory_transfers', 'inventory_transfer_items',
  'driver_documents', 'vehicle_maintenance', 'vehicle_trips', 'driver_vehicle_history',
  'zone_configurations', 'zone_assignments', 'slot_assignments',
  'batch_slot_assignments', 'batch_invoice_links',
];

const TIER3 = [
  'mod4_events', 'audit_logs', 'rbac_audit_logs', 'facility_audit_log',
  'user_status_history', 'org_status_history', 'map_action_audit',
  'forensics_query_log', 'optimization_runs', 'optimization_cache',
  'import_sessions', 'import_log_entries', 'scheduler_pre_batches',
  'scheduler_batches', 'schedule_batches', 'trade_offs',
  'trade_off_items', 'trade_off_confirmations',
  // driver_gps_events handled separately (partitioned)
];

const TIER4 = [
  'vehicle_types', 'vehicle_categories', 'vehicle_tiers',
  'facility_types', 'levels_of_care', 'programme_categories',
  'role_permissions', 'permission_set_permissions',
  'user_permissions', 'user_permission_sets',
  'user_groups', 'group_members', 'group_permissions',
  'member_permissions', 'notification_preferences', 'user_preferences',
  'workspace_readiness', 'workspace_countries', 'workspace_lgas', 'workspace_states',
  'upload_validations', 'schedule_templates', 'scheduler_settings',
  'packaging_slot_costs', 'recurring_schedules', 'driver_availability',
];

const VLMS = [
  'vlms_vehicles', 'vlms_assignments', 'vlms_maintenance_records',
  'vlms_fuel_logs', 'vlms_inspections', 'vlms_incidents', 'vlms_disposal_records',
  'driver_sessions', 'driver_devices', 'vehicle_merge_audit',
];

const OTP = ['mod4_driver_links', 'mod4_otp_codes', 'email_login_otps', 'user_invitations'];

const TIER_MAP: Record<string, string[]> = {
  '1': TIER1,
  '2': TIER2,
  '3': TIER3,
  '4': TIER4,
  'vlms': VLMS,
  'otp': OTP,
};

// Tables with no updated_at — use created_at for incremental filter
const CREATED_AT_TABLES = new Set([
  'audit_logs', 'rbac_audit_logs', 'facility_audit_log', 'mod4_events',
  'route_history', 'delivery_logs', 'handoffs', 'driver_gps_events',
  'import_log_entries', 'map_action_audit', 'forensics_query_log',
  'user_status_history', 'org_status_history',
]);

// Tables with no timestamp — always full export
const FULL_ONLY_TABLES = new Set([
  'admin_units', 'countries', 'vehicle_types', 'vehicle_categories', 'vehicle_tiers',
  'facility_types', 'levels_of_care', 'programme_categories',
  'role_permissions', 'permission_set_permissions', 'user_groups',
  'group_members', 'group_permissions', 'packaging_slot_costs',
]);

// ─── Pagination ───────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function* paginateTable(supabase: any, table: string, filter?: string, pageSize = 1000) {
  let offset = 0;
  while (true) {
    // deno-lint-ignore no-explicit-any
    let q = supabase.from(table).select('*').range(offset, offset + pageSize - 1);
    if (filter) {
      // filter is a raw condition string — applied via RPC if needed; here passed as-is
      // For incremental: caller passes filter via .gte()
    }
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    yield data;
    if (data.length < pageSize) break;
    offset += pageSize;
  }
}

// deno-lint-ignore no-explicit-any
async function* paginateTableIncremental(supabase: any, table: string, since: string, pageSize = 1000) {
  const tsCol = CREATED_AT_TABLES.has(table) ? 'created_at' : 'updated_at';
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte(tsCol, since)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    yield data;
    if (data.length < pageSize) break;
    offset += pageSize;
  }
}

// deno-lint-ignore no-explicit-any
async function exportTable(supabase: any, table: string, mode: string, since: string): Promise<{ json: string; rows: number }> {
  const isIncremental = mode === 'daily' && !FULL_ONLY_TABLES.has(table);
  let jsonStr = '[';
  let first = true;
  let rows = 0;

  const gen = isIncremental
    ? paginateTableIncremental(supabase, table, since)
    : paginateTable(supabase, table);

  for await (const page of gen) {
    for (const row of page) {
      if (!first) jsonStr += ',';
      jsonStr += JSON.stringify(row);
      first = false;
      rows++;
    }
  }
  jsonStr += ']';
  return { json: jsonStr, rows };
}

// GPS events — partitioned by month, export current + previous month
// deno-lint-ignore no-explicit-any
async function exportGpsEvents(supabase: any, dateStr: string): Promise<{ json: string; rows: number }> {
  const now = new Date(dateStr);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const since = prevMonth.toISOString();

  let jsonStr = '[';
  let first = true;
  let rows = 0;
  let offset = 0;
  const pageSize = 5000;

  while (true) {
    const { data, error } = await supabase
      .from('driver_gps_events')
      .select('*')
      .gte('captured_at', since)
      .range(offset, offset + pageSize - 1)
      .order('captured_at');
    if (error) throw new Error(`driver_gps_events: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (!first) jsonStr += ',';
      jsonStr += JSON.stringify(row);
      first = false;
      rows++;
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  jsonStr += ']';
  return { json: jsonStr, rows };
}

// ─── Storage objects snapshot ─────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function exportStorageObjects(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .schema('storage')
    .from('objects')
    .select('id, bucket_id, name, owner, created_at, updated_at, metadata, path_tokens');
  if (error) {
    console.error(JSON.stringify({ event: 'storage_objects_error', error: error.message }));
    return '[]';
  }
  return JSON.stringify(data ?? []);
}

// ─── Schema version ───────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function getSchemaVersion(supabase: any): Promise<{ version: string; checksum: string }> {
  try {
    const { data } = await supabase
      .schema('supabase_migrations')
      .from('schema_migrations')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .single();
    const version = data?.version ?? 'unknown';

    const { data: allVersions } = await supabase
      .schema('supabase_migrations')
      .from('schema_migrations')
      .select('version')
      .order('version');
    const versionList = (allVersions ?? []).map((r: { version: string }) => r.version).join(',');
    const checksumBytes = new TextEncoder().encode(versionList);
    const checksumBuf = await crypto.subtle.digest('SHA-256', checksumBytes);
    const checksum = Array.from(new Uint8Array(checksumBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return { version, checksum };
  } catch {
    return { version: 'unknown', checksum: 'unknown' };
  }
}

// ─── Write backup status to system_settings ───────────────────────────────────

// deno-lint-ignore no-explicit-any
async function writeBackupStatus(supabase: any, workspaceId: string, summary: Record<string, string>) {
  for (const [key, value] of Object.entries(summary)) {
    await supabase.from('system_settings').upsert(
      { workspace_id: workspaceId, setting_key: key, setting_value: value },
      { onConflict: 'workspace_id,setting_key' }
    );
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  // Auth guard
  const authSecret = Deno.env.get('BACKUP_AUTH_SECRET') ?? '';
  if (req.headers.get('x-backup-secret') !== authSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode: string = body.mode ?? 'daily';        // daily | weekly | full | deployment
  const tierArg: string = body.tier ?? 'all';        // all | 1 | 2 | 3 | 4 | vlms | otp
  const dateStr: string = body.date ?? new Date().toISOString().slice(0, 10);
  const gitCommit: string = body.git_commit ?? 'unknown';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const config: OneDriveConfig = {
    tenantId: Deno.env.get('ONEDRIVE_TENANT_ID') ?? '',
    clientId: Deno.env.get('ONEDRIVE_CLIENT_ID') ?? '',
    clientSecret: Deno.env.get('ONEDRIVE_CLIENT_SECRET') ?? '',
    driveId: Deno.env.get('ONEDRIVE_DRIVE_ID') ?? '',
  };
  const encKey = Deno.env.get('BACKUP_ENCRYPTION_KEY') ?? '';

  const startTime = Date.now();

  // Determine OneDrive target folder
  let targetFolder: string;
  if (mode === 'deployment') {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
    targetFolder = `Routeserve_Backups/Deployment_Snapshots/${ts}`;
  } else if (mode === 'weekly' || mode === 'full') {
    const week = getISOWeek(new Date(dateStr));
    targetFolder = `Routeserve_Backups/Database/Weekly/${week}`;
  } else {
    targetFolder = `Routeserve_Backups/Database/Daily/${dateStr}`;
  }

  // Since date for incremental
  const yesterday = new Date(new Date(dateStr).getTime() - 86400000).toISOString();

  // Acquire Graph token
  let token: string;
  try {
    token = await getGraphToken(config);
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get schema version
  const { version: migrationVersion, checksum: schemaChecksum } = await getSchemaVersion(supabase);

  // Determine which tiers to export
  const tiersToRun = tierArg === 'all'
    ? (['1', '2', '3', '4', 'vlms', 'otp'] as const)
    : [tierArg];

  // deno-lint-ignore no-explicit-any
  const results: any[] = [];
  let totalBytes = 0;
  let totalRows = 0;
  let succeeded = 0;
  let failed = 0;

  for (const tier of tiersToRun) {
    const tables = TIER_MAP[tier] ?? [];
    const tierFolder = tier === '1' ? 'tier1'
      : tier === '2' ? 'tier2'
      : tier === '3' ? 'tier3'
      : tier === '4' ? 'tier4'
      : tier;

    let folderId: string;
    try {
      folderId = await ensureFolder(token, config.driveId, `${targetFolder}/${tierFolder}`);
    } catch (err) {
      results.push({ tier, error: String(err), success: false });
      failed++;
      continue;
    }

    for (const table of tables) {
      const t0 = Date.now();
      try {
        const { json, rows } = await exportTable(supabase, table, mode, yesterday);
        const raw = new TextEncoder().encode(json);
        const hash = await sha256hex(raw);
        const encrypted = await encryptAndCompress(raw, encKey);
        const filename = `${table}.json.gz.enc`;

        const uploadRes = await uploadFile(token, config.driveId, folderId, filename, encrypted);
        if (!uploadRes.ok) {
          results.push({ table, success: false, error: uploadRes.error, duration_ms: Date.now() - t0 });
          failed++;
        } else {
          results.push({ table, success: true, rows, bytes_raw: raw.byteLength, bytes_uploaded: encrypted.byteLength, sha256_pre_encryption: hash, duration_ms: Date.now() - t0 });
          totalBytes += encrypted.byteLength;
          totalRows += rows;
          succeeded++;
        }
        console.log(JSON.stringify({ event: 'table_backup', table, rows, success: uploadRes.ok }));
      } catch (err) {
        results.push({ table, success: false, error: String(err), duration_ms: Date.now() - t0 });
        failed++;
        console.error(JSON.stringify({ event: 'table_backup_error', table, error: String(err) }));
      }
    }
  }

  // Export driver_gps_events separately for tier3 / all
  if (tierArg === 'all' || tierArg === '3') {
    try {
      const gpsFolderId = await ensureFolder(token, config.driveId, `${targetFolder}/tier3`);
      const { json, rows } = await exportGpsEvents(supabase, dateStr);
      const raw = new TextEncoder().encode(json);
      const hash = await sha256hex(raw);
      const encrypted = await encryptAndCompress(raw, encKey);
      const uploadRes = await uploadFile(token, config.driveId, gpsFolderId, 'driver_gps_events.json.gz.enc', encrypted);
      results.push({ table: 'driver_gps_events', success: uploadRes.ok, rows, bytes_raw: raw.byteLength, bytes_uploaded: encrypted.byteLength, sha256_pre_encryption: hash, error: uploadRes.error });
      if (uploadRes.ok) { succeeded++; totalBytes += encrypted.byteLength; totalRows += rows; } else { failed++; }
    } catch (err) {
      results.push({ table: 'driver_gps_events', success: false, error: String(err) });
      failed++;
    }
  }

  // Export storage.objects metadata snapshot
  try {
    const storageJson = await exportStorageObjects(supabase);
    const raw = new TextEncoder().encode(storageJson);
    const hash = await sha256hex(raw);
    const encrypted = await encryptAndCompress(raw, encKey);
    const rootFolderId = await ensureFolder(token, config.driveId, targetFolder);
    const uploadRes = await uploadFile(token, config.driveId, rootFolderId, 'storage_objects_snapshot.json.gz.enc', encrypted);
    results.push({ table: 'storage_objects_snapshot', success: uploadRes.ok, sha256_pre_encryption: hash, bytes_uploaded: encrypted.byteLength, error: uploadRes.error });
    if (uploadRes.ok) succeeded++; else failed++;
  } catch (err) {
    results.push({ table: 'storage_objects_snapshot', success: false, error: String(err) });
    failed++;
  }

  // For deployment snapshots: add retention.json
  if (mode === 'deployment') {
    try {
      const rootFolderId = await ensureFolder(token, config.driveId, targetFolder);
      const retentionBytes = new TextEncoder().encode(JSON.stringify({ permanent: true }));
      await uploadFile(token, config.driveId, rootFolderId, 'retention.json', retentionBytes, 'application/json');
    } catch { /* non-critical */ }
  }

  // Build and upload manifest
  const manifest = {
    migration_version: migrationVersion,
    schema_checksum: schemaChecksum,
    git_commit: gitCommit,
    backup_timestamp: new Date().toISOString(),
    mode,
    tier: tierArg,
    supabase_project_id: Deno.env.get('SUPABASE_URL')?.split('.')?.[0]?.split('//')?.pop() ?? 'unknown',
    summary: { total: results.length, succeeded, failed, total_bytes: totalBytes, total_rows: totalRows },
    files: results,
  };

  const manifestRaw = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  const manifestEncrypted = await encryptAndCompress(manifestRaw, encKey);
  const manifestFolderId = await ensureFolder(token, config.driveId, targetFolder);
  await uploadFile(token, config.driveId, manifestFolderId, 'manifest.json.gz.enc', manifestEncrypted);

  // Write status back to system_settings
  try {
    const { data: ws } = await supabase.from('workspaces').select('id').limit(1).single();
    if (ws?.id) {
      await writeBackupStatus(supabase, ws.id, {
        last_backup_at: new Date().toISOString(),
        last_backup_status: failed === 0 ? 'success' : succeeded > 0 ? 'partial' : 'failed',
        last_backup_tables_total: String(results.filter(r => r.table && r.table !== 'storage_objects_snapshot').length),
        last_backup_tables_succeeded: String(succeeded),
        last_backup_bytes: String(totalBytes),
        last_backup_schema_version: migrationVersion,
      });
    }
  } catch { /* non-critical */ }

  const response = {
    success: failed === 0,
    mode,
    duration_ms: Date.now() - startTime,
    summary: manifest.summary,
    errors: results.filter((r) => !r.success),
  };

  return new Response(JSON.stringify(response), {
    status: failed > 0 && succeeded === 0 ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
