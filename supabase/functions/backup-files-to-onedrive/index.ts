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

// ─── Bucket → OneDrive path mapping ──────────────────────────────────────────

const BUCKET_FOLDER_MAP: Record<string, string> = {
  'documents':     'Driver_Evidence',
  'vlms-documents': 'VLMS_Documents',
  'vlms-photos':   'VLMS_Photos',
  'vehicle-photos': 'Vehicle_Photos',
  'avatars':       'Avatars',
};

const ALL_BUCKETS = Object.keys(BUCKET_FOLDER_MAP);

// ─── Storage file listing ─────────────────────────────────────────────────────

interface StorageFile {
  name: string;
  fullPath: string;
  bucket: string;
  metadata?: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function collectBucketFiles(supabase: any, bucket: string): Promise<StorageFile[]> {
  const files: StorageFile[] = [];
  await collectFolder(supabase, bucket, '', files);
  return files;
}

// deno-lint-ignore no-explicit-any
async function collectFolder(supabase: any, bucket: string, prefix: string, acc: StorageFile[], pageSize = 100) {
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      const itemPath = prefix ? `${prefix}${item.name}` : item.name;
      if (item.id === null) {
        // Folder — recurse
        await collectFolder(supabase, bucket, `${itemPath}/`, acc, pageSize);
      } else {
        acc.push({ name: item.name, fullPath: itemPath, bucket, metadata: item.metadata });
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
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
  const buckets: string[] = body.buckets ?? ALL_BUCKETS;
  const globalOffset: number = body.offset ?? 0;
  const limit: number = body.limit ?? 50;

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

  // Collect all files across requested buckets
  let allFiles: StorageFile[] = [];
  for (const bucket of buckets) {
    try {
      const files = await collectBucketFiles(supabase, bucket);
      allFiles = allFiles.concat(files);
    } catch (err) {
      console.error(JSON.stringify({ event: 'bucket_list_error', bucket, error: String(err) }));
    }
  }

  const totalFiles = allFiles.length;
  const pageFiles = allFiles.slice(globalOffset, globalOffset + limit);
  const done = globalOffset + limit >= totalFiles;
  const nextOffset = done ? totalFiles : globalOffset + limit;

  // deno-lint-ignore no-explicit-any
  const results: any[] = [];
  let processed = 0;
  let totalBytes = 0;

  for (const file of pageFiles) {
    const t0 = Date.now();
    try {
      // Download from Supabase Storage
      const { data: blob, error: dlErr } = await supabase.storage
        .from(file.bucket)
        .download(file.fullPath);

      if (dlErr || !blob) {
        results.push({ bucket: file.bucket, path: file.fullPath, success: false, error: dlErr?.message ?? 'no data' });
        continue;
      }

      const rawBytes = new Uint8Array(await blob.arrayBuffer());
      const hash = await sha256hex(rawBytes);
      const encrypted = await encryptAndCompress(rawBytes, encKey);

      // Determine OneDrive folder: Routeserve_Backups/{bucket-folder}/{bucket}/{original-path-prefix}
      const bucketFolder = BUCKET_FOLDER_MAP[file.bucket] ?? file.bucket;
      const pathParts = file.fullPath.split('/');
      const filename = pathParts.pop()!;
      const subPath = pathParts.length > 0 ? pathParts.join('/') : '';
      const onedrivePath = subPath
        ? `Routeserve_Backups/${bucketFolder}/${file.bucket}/${subPath}`
        : `Routeserve_Backups/${bucketFolder}/${file.bucket}`;

      const folderId = await ensureFolder(token, config.driveId, onedrivePath);
      const uploadRes = await uploadFile(
        token,
        config.driveId,
        folderId,
        `${filename}.enc`,
        encrypted
      );

      results.push({
        bucket: file.bucket,
        path: file.fullPath,
        onedrive_path: `${onedrivePath}/${filename}.enc`,
        success: uploadRes.ok,
        bytes_raw: rawBytes.byteLength,
        bytes_uploaded: encrypted.byteLength,
        sha256_pre_encryption: hash,
        error: uploadRes.error,
        duration_ms: Date.now() - t0,
      });

      if (uploadRes.ok) { processed++; totalBytes += encrypted.byteLength; }

      console.log(JSON.stringify({ event: 'file_backup', bucket: file.bucket, path: file.fullPath, success: uploadRes.ok }));
    } catch (err) {
      results.push({ bucket: file.bucket, path: file.fullPath, success: false, error: String(err), duration_ms: Date.now() - t0 });
      console.error(JSON.stringify({ event: 'file_backup_error', bucket: file.bucket, path: file.fullPath, error: String(err) }));
    }
  }

  // Write backup status to system_settings when this is the final batch
  if (done) {
    try {
      const { data: ws } = await supabase.from('workspaces').select('id').limit(1).single();
      if (ws?.id) {
        const failed = results.filter(r => !r.success).length;
        await supabase.from('system_settings').upsert(
          { workspace_id: ws.id, setting_key: 'last_backup_files_synced', setting_value: String(processed) },
          { onConflict: 'workspace_id,setting_key' }
        );
        await supabase.from('system_settings').upsert(
          { workspace_id: ws.id, setting_key: 'last_backup_bytes', setting_value: String(totalBytes) },
          { onConflict: 'workspace_id,setting_key' }
        );
        if (failed === 0) {
          await supabase.from('system_settings').upsert(
            { workspace_id: ws.id, setting_key: 'last_backup_status', setting_value: 'success' },
            { onConflict: 'workspace_id,setting_key' }
          );
        } else if (processed > 0) {
          await supabase.from('system_settings').upsert(
            { workspace_id: ws.id, setting_key: 'last_backup_status', setting_value: 'partial' },
            { onConflict: 'workspace_id,setting_key' }
          );
        }
        await supabase.from('system_settings').upsert(
          { workspace_id: ws.id, setting_key: 'last_backup_at', setting_value: new Date().toISOString() },
          { onConflict: 'workspace_id,setting_key' }
        );
      }
    } catch { /* non-critical */ }
  }

  const response = {
    done,
    next_offset: nextOffset,
    total_files: totalFiles,
    processed,
    page_size: pageFiles.length,
    total_bytes: totalBytes,
    duration_ms: Date.now() - startTime,
    errors: results.filter((r) => !r.success),
    results,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
