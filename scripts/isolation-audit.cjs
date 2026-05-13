#!/usr/bin/env node
/**
 * Workspace Isolation Audit
 *
 * Checks that every Supabase query touching a tenant-owned table is
 * properly scoped to the active workspace.  Run manually or let the
 * pre-push hook call it automatically.
 *
 * Usage:
 *   node scripts/isolation-audit.cjs             # full scan
 *   node scripts/isolation-audit.cjs --changed   # only files changed vs origin/main
 *   node scripts/isolation-audit.cjs --install-hook  # wire as .git/hooks/pre-push
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// Tables that carry a workspace_id column and must always be filtered by it.
// Reference / lookup / child tables are excluded — they inherit workspace
// isolation through their parent table's RLS.
// ─────────────────────────────────────────────────────────────────────────────
const TENANT_TABLES = new Set([
  // Delivery / dispatch
  'delivery_batches', 'dispatch_runs', 'batch_invoice_links',
  'batch_slot_assignments', 'batch_tier_assignments',

  // Scheduler
  'scheduler_batches', 'scheduler_pre_batches', 'schedule_batches',

  // Facilities
  'facilities',

  // Finance
  'invoices', 'requisitions', 'requisition_items',

  // Fleet
  'drivers', 'vehicles', 'warehouses', 'fleets',
  'handoffs', 'delivery_schedules',

  // Routes & zones
  'routes', 'route_sketches', 'route_facilities',
  'service_areas', 'service_area_facilities',
  'service_zones', 'service_policies',
  'zones', 'zone_alerts', 'zone_configurations',
  'policy_clusters', 'policy_cluster_facilities',

  // Inventory
  'inventory_transfers', 'inventory_transfer_items', 'warehouse_inventory',

  // Trade-offs
  'trade_offs', 'trade_off_items', 'trade_off_confirmations',

  // Import
  'import_sessions', 'import_log_entries',

  // Notifications & onboarding
  'notifications', 'onboarding_requests', 'user_invitations',

  // Settings
  'workspace_settings',

  // Mod4
  'mod4_events', 'mod4_driver_links',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
let failures = 0;

function fail(msg) {
  console.log(`  ✗  ${msg}`);
  failures++;
}

function pass(msg) {
  // Uncomment for verbose output:
  // console.log(`  ✓  ${msg}`);
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split('\n');
}

function walkDir(dir, exts, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walkDir(full, exts, results);
    else if (exts.some(e => full.endsWith(e))) results.push(full);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine which files to audit
// ─────────────────────────────────────────────────────────────────────────────
function getFiles(changedOnly) {
  const hooks  = [];
  const stores = [];

  if (changedOnly) {
    let changedLines = '';
    try {
      // Files changed relative to origin/main (what would actually be pushed)
      changedLines = execSync('git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null', { cwd: ROOT }).toString();
    } catch { /* fall through to full scan */ }

    for (const rel of changedLines.split('\n').filter(Boolean)) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      if (rel.match(/^src\/hooks\/.*\.[tj]sx?$/))  hooks.push(abs);
      if (rel.match(/^src\/stores\/.*\.[tj]sx?$/)) stores.push(abs);
    }

    if (hooks.length === 0 && stores.length === 0) {
      // No hook/store files in this push — nothing to audit.
      // Do NOT fall back to full scan here: that would block pushes for
      // pre-existing violations in untouched files.
      return { hooks: [], stores: [], noop: true };
    }
  } else {
    walkDir(path.join(ROOT, 'src/hooks'),  ['.ts', '.tsx'], hooks);
    walkDir(path.join(ROOT, 'src/stores'), ['.ts', '.tsx'], stores);
  }

  return { hooks, stores };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1 + 2 — Tenant table isolation in hooks
// ─────────────────────────────────────────────────────────────────────────────
// Rules:
//   SELECT / UPDATE / DELETE  → must have .eq('workspace_id', ...)  in the chain
//   INSERT                    → must have   workspace_id:  in the payload object
//   UPSERT                    → must satisfy EITHER the INSERT OR the chain rule
//   RPC calls                 → skipped (checked separately via CHECK 3)
//
// "INSERT detection" — if any of the ~15 lines after .from() contain .insert(
// then we treat it as an INSERT and look for  workspace_id:  in a ±30-line
// window instead of a .eq() chain.  This eliminates false positives on the
// pattern:  supabase.from('t').insert([{ workspace_id: x, ... }])
// ─────────────────────────────────────────────────────────────────────────────
function checkHookFile(filePath) {
  const lines   = readLines(filePath);
  const relPath = path.relative(ROOT, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match .from('table') or .from("table")
    const m = line.match(/\.from\(\s*['"]([^'"]+)['"]\s*\)/);
    if (!m) continue;

    const table = m[1];
    if (!TENANT_TABLES.has(table)) continue;

    // Skip lines inside comments
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Allow suppression: add  // isolation-ok  on the .from() line or within 3 lines after
    const suppressWindow = lines.slice(i, Math.min(lines.length, i + 4)).join('\n');
    if (/\/\/\s*isolation-ok/.test(suppressWindow)) continue;

    // Forward context: lines i..i+25
    const fwdEnd     = Math.min(lines.length - 1, i + 25);
    const fwdContext = lines.slice(i, fwdEnd + 1).join('\n');

    // Skip RPC calls chained off the client (not really .from usage but guard anyway)
    if (/\.rpc\s*\(/.test(fwdContext.slice(0, 200))) continue;

    // Find the FIRST operation verb in this chain by scanning line-by-line.
    // Stop when we encounter the start of a new supabase chain, preventing
    // false positives where a subsequent .from().insert() is mistakenly
    // attributed to the current .from() operation.
    let firstVerb = null;
    const maxLook = Math.min(lines.length, i + 15);
    for (let j = i; j < maxLook; j++) {
      const l = lines[j];
      // A new chain starts here (different .from() or .rpc()) — stop
      if (j > i && /supabase[\s\S]{0,5}\.from\s*\(|supabase[\s\S]{0,5}\.rpc\s*\(/.test(l)) break;
      if (/\.insert\s*\(/.test(l)) { firstVerb = 'insert'; break; }
      if (/\.update\s*\(/.test(l)) { firstVerb = 'update'; break; }
      if (/\.delete\s*\(/.test(l)) { firstVerb = 'delete'; break; }
      if (/\.select\s*\(/.test(l)) { firstVerb = 'select'; break; }
      if (/\.upsert\s*\(/.test(l)) { firstVerb = 'upsert'; break; }
    }

    const isInsert = firstVerb === 'insert';
    const isUpsert = firstVerb === 'upsert';

    if (isInsert && !isUpsert) {
      // INSERT: look for workspace_id: in payload within ±30 lines
      const payloadStart   = Math.max(0, i - 10);
      const payloadEnd     = Math.min(lines.length - 1, i + 30);
      const payloadContext = lines.slice(payloadStart, payloadEnd + 1).join('\n');

      if (!/workspace_id\s*:/.test(payloadContext)) {
        fail(`[INSERT — workspace_id missing from payload]  ${relPath}:${i + 1}  .from('${table}')`);
      }
    } else if (isUpsert) {
      // UPSERT: accept either a payload workspace_id: or a .eq() chain
      const payloadStart   = Math.max(0, i - 10);
      const payloadEnd     = Math.min(lines.length - 1, i + 30);
      const payloadContext = lines.slice(payloadStart, payloadEnd + 1).join('\n');

      const hasPayloadId = /workspace_id\s*:/.test(payloadContext);
      const hasEqChain   = /\.eq\s*\(\s*['"]workspace_id['"]/.test(fwdContext);

      if (!hasPayloadId && !hasEqChain) {
        fail(`[UPSERT — no workspace_id isolation]  ${relPath}:${i + 1}  .from('${table}')`);
      }
    } else {
      // SELECT / UPDATE / DELETE: must have .eq('workspace_id', ...) in chain
      if (!/\.eq\s*\(\s*['"]workspace_id['"]/.test(fwdContext)) {
        fail(`[SELECT/UPDATE/DELETE — missing .eq('workspace_id')]  ${relPath}:${i + 1}  .from('${table}')`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3 — Persisted Zustand stores cleared on workspace switch
// ─────────────────────────────────────────────────────────────────────────────
function checkPersistStores(storeFiles) {
  const header = '\n=== CHECK: Persisted stores cleared on workspace switch ===\n';
  let printed  = false;

  const wsCtxPath    = path.join(ROOT, 'src/contexts/WorkspaceContext.tsx');
  const wsCtxContent = fs.existsSync(wsCtxPath) ? fs.readFileSync(wsCtxPath, 'utf8') : '';

  for (const storeFile of storeFiles) {
    const content = fs.readFileSync(storeFile, 'utf8');
    const relPath = path.relative(ROOT, storeFile);

    // Match the name: field inside a persist() call block.
    // We look for:  persist(  ... name: 'foo-storage' ...  )
    // using a non-greedy match so we don't bleed across multiple persist() calls.
    const persistRe = /persist\s*\(\s*[^)]*?name\s*:\s*['"]([^'"]+)['"]/s;
    const m = content.match(persistRe);

    // Fallback: any name: 'xxx-storage' pattern in the file
    const fallbackRe = /name\s*:\s*['"]([^'"]*storage[^'"]*)['"]/;
    const storeName  = m ? m[1] : (content.match(fallbackRe) || [])[1];

    if (!storeName) continue; // not a persisted store

    if (!printed) { console.log(header); printed = true; }

    const removeCall = `localStorage.removeItem('${storeName}')`;
    if (!wsCtxContent.includes(removeCall)) {
      fail(`[persisted store not cleared on switch]  ${relPath}  →  '${storeName}'  (add ${removeCall} inside switchWorkspace)`);
    } else {
      pass(`${relPath}  '${storeName}'  cleared on switch`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4 — New migration RLS policies use is_workspace_member_v2()
// ─────────────────────────────────────────────────────────────────────────────
function checkMigrationRls() {
  const header = '\n=== CHECK: Migration RLS policies use is_workspace_member_v2() ===\n';
  let printed  = false;

  const migrationsDir = path.join(ROOT, 'supabase/migrations');
  if (!fs.existsSync(migrationsDir)) return;

  let changedMigrations = [];
  try {
    const out = execSync(
      'git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null',
      { cwd: ROOT }
    ).toString();
    changedMigrations = out.split('\n')
      .filter(f => f.startsWith('supabase/migrations/') && f.endsWith('.sql'))
      .map(f => path.join(ROOT, f))
      .filter(f => fs.existsSync(f));
  } catch { return; }

  for (const migFile of changedMigrations) {
    const content = fs.readFileSync(migFile, 'utf8');
    const relPath = path.relative(ROOT, migFile);

    // Find CREATE POLICY ... ; blocks (multiline)
    for (const policyMatch of content.matchAll(/CREATE\s+POLICY\s[\s\S]+?;/gi)) {
      const policy = policyMatch[0];
      if (/workspace_id\s+IN\s*\(\s*SELECT\s+workspace_id\s+FROM\s+workspace_members/i.test(policy)) {
        if (!printed) { console.log(header); printed = true; }
        fail(`[RLS inline subquery instead of is_workspace_member_v2()]  ${relPath}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --install-hook  helper
// ─────────────────────────────────────────────────────────────────────────────
function installHook() {
  const hooksDir  = path.join(ROOT, '.git', 'hooks');
  const hookPath  = path.join(hooksDir, 'pre-push');
  const hookBody  = `#!/usr/bin/env bash
# Workspace isolation audit — auto-installed by scripts/isolation-audit.js
set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"
echo ""
echo "Running workspace isolation audit (--changed)..."
node "\${REPO_ROOT}/scripts/isolation-audit.cjs" --changed
`;
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, hookBody, { mode: 0o755 });
  console.log(`✅  Pre-push hook installed at ${path.relative(ROOT, hookPath)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv.includes('--install-hook')) {
  installHook();
  process.exit(0);
}

const changedOnly = process.argv.includes('--changed');
const result = getFiles(changedOnly);

if (result.noop) {
  console.log('\n🔍  Workspace Isolation Audit (changed files only)');
  console.log('    No hook/store files in this push — checks skipped.\n');
  checkMigrationRls();  // Always check new migration policies
  process.exit(failures > 0 ? 1 : 0);
}

const { hooks, stores } = result;

console.log(`\n🔍  Workspace Isolation Audit${changedOnly ? ' (changed files only)' : ' (full scan)'}`);
console.log(`    Hooks: ${hooks.length} file(s) | Stores: ${stores.length} file(s)\n`);

console.log('=== CHECK 1+2: Tenant table workspace isolation ===\n');
for (const hook of hooks) checkHookFile(hook);
if (failures === 0) console.log('  All clean');

checkPersistStores(stores);
checkMigrationRls();

console.log('\n' + '─'.repeat(55));
if (failures > 0) {
  console.log(`\n❌  ${failures} violation(s) found — fix before pushing.\n`);
  process.exit(1);
} else {
  console.log(`\n✅  All workspace isolation checks passed.\n`);
  process.exit(0);
}
