export interface OneDriveConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  driveId: string;
}

export interface UploadResult {
  ok: boolean;
  path?: string;
  bytes?: number;
  error?: string;
  status?: number;
}

export interface GraphResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// ─── Token ────────────────────────────────────────────────────────────────────

export async function getGraphToken(config: OneDriveConfig): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph token error ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

// ─── Folder management ────────────────────────────────────────────────────────

export async function ensureFolder(
  token: string,
  driveId: string,
  folderPath: string
): Promise<string> {
  const segments = folderPath.split('/').filter(Boolean);
  let parentId = 'root';

  for (const segment of segments) {
    const checkRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}:/${segment}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (checkRes.ok) {
      const item = await checkRes.json();
      parentId = item.id;
      continue;
    }

    // Create folder
    const createRes = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentId}/children`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: segment,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        }),
      }
    );

    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`Cannot create folder "${segment}": ${createRes.status} ${body}`);
    }
    const created = await createRes.json();
    parentId = created.id;
  }

  return parentId;
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

export async function sha256hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function encryptAndCompress(
  data: Uint8Array,
  hexKey: string
): Promise<Uint8Array> {
  // Import key from hex
  const keyBytes = hexToBytes(hexKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Gzip compress
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());

  // AES-256-GCM encrypt with random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, compressed);

  // Prepend 12-byte IV to ciphertext
  const result = new Uint8Array(12 + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), 12);
  return result;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024; // 4 MB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

export async function uploadFile(
  token: string,
  driveId: string,
  folderId: string,
  filename: string,
  content: Uint8Array,
  contentType = 'application/octet-stream'
): Promise<UploadResult> {
  try {
    if (content.byteLength <= SMALL_FILE_THRESHOLD) {
      return await uploadSmall(token, driveId, folderId, filename, content, contentType);
    }
    return await uploadLarge(token, driveId, folderId, filename, content, contentType);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function uploadSmall(
  token: string,
  driveId: string,
  folderId: string,
  filename: string,
  content: Uint8Array,
  contentType: string
): Promise<UploadResult> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${encodeURIComponent(filename)}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: content,
    }
  );
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `${res.status} ${body}`, status: res.status };
  }
  return { ok: true, bytes: content.byteLength };
}

async function uploadLarge(
  token: string,
  driveId: string,
  folderId: string,
  filename: string,
  content: Uint8Array,
  contentType: string
): Promise<UploadResult> {
  // Create upload session
  const sessionRes = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}:/${encodeURIComponent(filename)}:/createUploadSession`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'replace' },
      }),
    }
  );
  if (!sessionRes.ok) {
    const body = await sessionRes.text();
    return { ok: false, error: `Session error ${sessionRes.status}: ${body}` };
  }
  const { uploadUrl } = await sessionRes.json();

  const total = content.byteLength;
  let offset = 0;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    const chunk = content.slice(offset, end);

    let attempt = 0;
    let success = false;
    while (attempt < 3 && !success) {
      const chunkRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${offset}-${end - 1}/${total}`,
          'Content-Length': String(chunk.byteLength),
        },
        body: chunk,
      });
      if (chunkRes.ok || chunkRes.status === 202) {
        success = true;
      } else if (attempt < 2) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        attempt++;
      } else {
        const body = await chunkRes.text();
        return { ok: false, error: `Chunk ${offset}-${end} failed: ${chunkRes.status} ${body}` };
      }
    }

    offset = end;
  }

  return { ok: true, bytes: total };
}
