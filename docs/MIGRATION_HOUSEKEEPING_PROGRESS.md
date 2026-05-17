# Migration Housekeeping — Session Progress (2026-05-16)

Linked Supabase project: `nksxyuuyklokpsuqwicl`
Local migration files: **278**

## What was completed this session

### 1. Audit verified against live DB

The "Supabase Migration Audit — 271 Files" report was checked against this fork.
Findings: core eras and purge/squash recommendations apply, but the audit's
**specific bug fix proposal was wrong for this DB**. See section 3.

### 2. Critical discovery — tracking table empty

- `SELECT count(*) FROM supabase_migrations.schema_migrations` → **0**
- `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` → **139**

Schema is fully built (139 tables) but the CLI tracking table is empty.
Cause: user recently restored the project via Supabase; snapshot/restore
appears to have wiped `schema_migrations` while preserving the actual schema.

`npx supabase migration list --linked` confirms every local file shows
`Local` filled, `Remote` blank.

### 3. Real bug fixed — RBAC helper functions

Audit assumed the live bug was two `system_admin`-gated policies on
`public.profiles` that needed swapping to `is_admin()`. Verification showed
those policies **do not exist** in this DB. The actual bugs (both stem from
RBAC v2 schema move without updating legacy helpers):

- **`public.is_admin()`** errored at runtime with `42883: function has_role(unknown)
  does not exist` — declared `SET search_path TO ''` but called unqualified
  `has_role(...)`.
- **`public.has_role(text)`** queried `user_roles.role` (text column) which no
  longer exists post-RBAC v2 — column is now `user_roles.role_id` (uuid FK to
  `roles.id`); identifier moved to `roles.code`.

Both rewritten to v2 schema with explicit `search_path = public, pg_temp`.

**Migration file:** `supabase/migrations/20260516000006_fix_is_admin_search_path.sql`

**Applied to live DB:** ✅ via SQL editor.

**Verified:**
- `SELECT public.is_admin()` as `postgres` → `false` (no error).
- Impersonating admin user `2eba77d2-d91a-4181-a121-9ea44580ed6c`:
  `is_admin() = true`, `has_role('admin') = true`. ✅

## Live DB state snapshot (verified)

| Item | Value |
|---|---|
| Local migration files | 278 |
| Tracked in `schema_migrations` | 0 |
| Tables in `public` | 139 |
| `roles` rows | 6 (codes: admin, driver, fleet_manager, ops_manager, owner, viewer) |
| `role_permissions` rows | 129 |
| `workspace_members` rows | 5 |
| `user_roles` rows | 2 (both `admin`) |
| Admin user ids | `2eba77d2-d91a-4181-a121-9ea44580ed6c`, `d5485c1b-1ddc-43c2-9200-1ae7038e6eb8` |
| Broken SECURITY DEFINER fns with empty search_path | 0 (after fix) |

## Active findings still pending

1. **Migration tracking** — `schema_migrations` is empty. Need to decide:
   - Path A: repair tracking via `supabase migration repair --status applied <version>` for all 277 existing versions + the new 20260516000006, restoring normal CLI flow.
   - Path B: treat current DB as baseline — dump schema, replace 278 files with one consolidated baseline, mark only that as applied.

2. **Profiles RLS cleanup (deferred)** — live DB has legacy "System admins can
   view/update org profiles" policies using `is_system_admin()` +
   `get_user_organization()` + `profiles.organization` column. Dead code (no
   role has `code='system_admin'`) but harmless. Also two duplicate own-profile
   policies. Cosmetic, not urgent.

3. **Admin cross-workspace profile visibility** — currently no RLS path for
   admins to see profiles outside their own workspace. Only "Users can view
   profiles in same workspace" is active. Decide whether this is a product
   requirement.

4. **Audit purge list (22 files)** — Cat A UUID-named files + Cat B/C wipes.
   Safe to delete once tracking strategy is decided.

5. **Audit squash plan (94 files → ~10)** — analytics, RBAC v1, OTP chain,
   vehicle consolidation, security hardening, etc. All depend on tracking
   strategy. Note: squash 1 (analytics) must also fold in post-audit fixes
   `20260516000002` and `20260516000003`; squash 7 must fold in
   `20260516000004` and `20260516000005`.

6. **Audit Check 1 (`20251111000000`/`001` marked applied but not executed)**
   — moot now that tracking is empty. The repair migration
   `20260207212006_repair_missing_facilities_and_lgas.sql` is the true source
   for those tables.

## Recommended first action next session

Before any housekeeping: take a safety-net schema dump.

```powershell
mkdir backups\pre_housekeeping_$(Get-Date -Format yyyyMMdd) -Force
npx supabase db dump --linked --schema public,analytics -f backups\pre_housekeeping_$(Get-Date -Format yyyyMMdd)\schema.sql
npx supabase db dump --linked --data-only -f backups\pre_housekeeping_$(Get-Date -Format yyyyMMdd)\data.sql
npx supabase db dump --linked --role-only -f backups\pre_housekeeping_$(Get-Date -Format yyyyMMdd)\roles.sql
```

Then decide Path A vs Path B above.

## Useful verification queries (for next session)

```sql
-- Tracking state
SELECT count(*) FROM supabase_migrations.schema_migrations;

-- Public schema reality
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- RBAC health
SELECT public.is_admin();
SELECT count(*) FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE r.code IN ('admin','super_admin');

-- All is_admin()-gated policies (verify access restored)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE qual LIKE '%is_admin%' OR with_check LIKE '%is_admin%'
ORDER BY schemaname, tablename, policyname;

-- Functions still using empty search_path (should remain 0 broken; some like get_user_organization are fine because fully qualified)
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
  AND proconfig::text LIKE '%search_path=""%'
ORDER BY proname;
```
