# RBAC v2 Sanitation Audit

Date: 2026-05-17
Scope: `supabase/migrations/**`, `src/**`, `supabase/functions/**`

This audit catalogs every place that still references **legacy RBAC** (the
pre-RBAC-v2 model that lived in `app_role` enum, `user_roles.role` text col,
and `workspace_members.role` text col) and rates impact on the current
production schema (RBAC v2 was activated by `20260324000001_cleanup_legacy_rbac.sql`
+ `20260324000002_rbac_v2_schema.sql`).

> **Reference reality on the live DB**
> - Legacy `public.app_role` ENUM — **DROPPED** (`20260324000001`)
> - Legacy `user_roles.role` TEXT col — **DROPPED** (`20260324000001`)
> - `workspace_members.role` TEXT col — **kept** for backward compat,
>   populated by `create_workspace`/`create_organization_with_admin`/
>   `accept_invitation`, but is **not** the source of truth.
> - Source of truth for workspace roles → `workspace_members.role_id` →
>   `roles.code` ∈ `{owner, admin, ops_manager, fleet_manager, driver, viewer}`
> - Source of truth for system-wide roles → `user_roles.role_id` →
>   `roles.code`. Today only `admin` is meaningfully used.
> - `super_admin` referenced by `is_admin()` does **not exist** as a row in
>   `roles` (never seeded). `has_role('super_admin')` is always false.

---

## A. CRITICAL — currently broken or silently denying

### A1. `user_invitations` SELECT/INSERT/UPDATE policies use legacy text col
- **Files:** `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260121000003_user_invitations.sql:160-196`
- **Impact:** Members page → "Invitations" panel returns 0 rows for any
  workspace admin whose `workspace_members.role` is not literally
  `'owner' | 'admin'` (e.g. an invited admin under v2 paths that map text col
  to `'member'`). View `pending_invitations_view` / `all_invitations_view`
  was switched to `security_invoker = true` in
  `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260516000004_fix_security_definer_views_and_spatial_rls.sql:49-50`
  which exposes this gap.
- **Status:** **Patched** in
  `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260517000001_fix_user_invitations_rls_rbac_v2.sql`
  (this PR).

### A2. Onboarding wizard sends invitations with the **wrong RPC arg name**
- **File:** `@c:\Users\USER\CascadeProjects\RouteServe\src\hooks\onboarding\useOnboardingWizard.ts:265-269`
- **Code passes `p_app_role`** but the RPC signature is
  `invite_user(p_email, p_workspace_id, p_role_code, p_workspace_role, p_personal_message)`
  (`@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260513000001_fix_invite_user_resend.sql:5-11`).
- **Impact:** PostgREST raises `function invite_user(...) does not exist` →
  every onboarding-step team invite fails silently (caught by `console.error`).
- **Fix:** rename arg to `p_role_code`, drop `as any`.

### A3. Onboarding wizard role values are **not in the v2 `roles` table**
- **File:** `@c:\Users\USER\CascadeProjects\RouteServe\src\components\onboarding\steps\TeamSetupStep.tsx:14-19`
- **Sends:** `'operations_user' | 'fleetops_user' | 'driver' | 'viewer'`
- **v2 `roles.code` values:** `owner | admin | ops_manager | fleet_manager | driver | viewer`
- **Impact:** Even after A2 is fixed, `invite_user` raises
  `Invalid role_code: operations_user`. Same wrong values used as default
  state on line 25 / line 29.
- **Fix:** map `operations_user → ops_manager`, `fleetops_user → fleet_manager`.

### A4. `ZoneManagerAssignment` queries dead role codes
- **File:** `@c:\Users\USER\CascadeProjects\RouteServe\src\components\zones\ZoneManagerAssignment.tsx:60-66`
- **Filters `roles.code IN ('zonal_manager','system_admin','operations_user','fleetops_user')`** — none exist in v2.
- **Impact:** `roleIds` is always `[]` → "manager-eligible users" search returns nothing.
- **Fix:** use `('admin','fleet_manager','ops_manager')` or whatever the
  intended set is.

### A5. Reference-table policies depend on a redefined `is_admin()`
- **Files:** `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260326000005_tighten_reference_table_rls.sql:16-80`
  (defines `is_admin` as workspace-admin via text col),
  later overwritten by
  `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260516000006_fix_is_admin_search_path.sql:48-57`
  (rewrites `is_admin` as **system-admin** via `user_roles`).
- **Impact:** Tables `vehicle_tiers`, `vehicle_types`, `facility_types`,
  `levels_of_care` now require the caller to have a `user_roles` row →
  `roles.code = 'admin'`. Workspace owners created via `create_workspace`
  (`20260325000006`) get a workspace_members.role_id of 'owner' but **no
  user_roles row** (only `create_organization_with_admin` writes to
  `user_roles`). So those owners cannot manage reference data.
- **Decision needed:** Should ref-table writes require system-admin or
  workspace-owner? Two options:
  - **(a) Keep system-admin semantics** (current): backfill `user_roles`
    for every workspace owner.
  - **(b) Add `is_workspace_admin()` helper** and switch ref-table policies
    to use it (preserves intent of `20260326000005`).

### A6. `requisitions` / `requisition_items` policies use phantom roles
- **File:** `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260430083600_fix_requisition_items_rls.sql:43-114`
- **Calls** `has_role('warehouse_officer')` — that role doesn't exist in
  v2 (`@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260324000002_rbac_v2_schema.sql:49-58`).
- **Calls `is_admin()`** which (post-`20260516000006`) means system-admin only.
- **Impact:** Only system-admins (or row owners) can manage requisitions —
  ops_manager / fleet_manager are locked out.
- **Fix:** rewrite to use v2 codes (likely `ops_manager`, `admin`, `owner`).

### A7. Pre-v2 RLS policies on legacy migrations were **silently dropped**
- The `DROP TYPE app_role CASCADE` in `20260324000001_cleanup_legacy_rbac.sql:83`
  also cascades-dropped every policy whose body referenced `'system_admin'::app_role`,
  `'warehouse_officer'::app_role`, etc.
- **Tables affected by lost policies** (originals in
  `20251009*`, `20251012*`, `20251014*`, `20251022*`, `20251023*`,
  `20251027*`):
  - `service_zones`
  - `vehicle_types` (admin policy lost — partially restored by `20260326000005`)
  - `driver_availability`
  - `vehicle_maintenance`
  - `vehicle_trips`
  - `driver_vehicle_history`
  - `recurring_schedules`
  - `delivery_schedules`
  - `schedule_batches`
  - `upload_validations`
  - `notifications` (per `20251009104316`)
  - storage policy for `vehicle-photos` bucket
- **Impact:** Any of these tables that didn't get a replacement policy in a
  later migration now have either no policies (table closed to all
  authenticated users) **or** rely on default permissive policies.
- **Action:** spot-check each table with `pg_policies` query (see
  Verification section). Tables that lost their only RBAC-gated policy need
  v2 replacements.

---

## B. HIGH — works today but fragile

### B1. Workspace-admin RPCs still gate on `wm.role IN ('owner','admin')` text col
Functionally OK because every active code path that inserts into
`workspace_members` also writes the legacy text col. But the text col is
**not enforced**, so any direct INSERT or future code path that writes only
`role_id` will break these.

Locations:
- `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260131000001_fix_workspace_members_rls.sql:42-94`
- `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260222200001_onboarding_v2_rpcs.sql:159-243`
- `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260326000004_workspace_lgas.sql:54-98`
- `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260404000001_fix_admin_units_rls_and_upsert.sql:39-44`
- `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260425000001_fix_otp_created_by_nullable.sql:36-41`
- `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260427000004_lga_zone_assignment_rpc.sql:23-53`
- `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260222200000_onboarding_v2_schema.sql:79-156`
  (workspace_countries / workspace_states policies)

**Fix pattern (recommended):**
```sql
WHERE wm.user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.roles r
    WHERE r.id = wm.role_id AND r.code IN ('owner','admin')
  );
```

### B2. Inconsistent owner role assignment
- `create_organization_with_admin` (`20260326000007:38-46`) → role_id is `'admin'`
- `create_workspace` (`20260325000006/8/11`, `20260325000005`) → role_id is `'owner'` (falls back to `'admin'`)
- Effect: two workspace creators can have different role codes for the
  same conceptual role. The `'owner'` row was added in
  `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260325000005_workspace_lifecycle_owner_archive.sql:14-22`.
- **Fix:** unify both RPCs on `'owner'`.

### B3. `accept_invitation` does not write `user_roles`
- **File:** `@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260418000001_fix_invitations_rbac_v2.sql:140-152`
- Result: an invited workspace admin can fully manage the workspace but is
  not a system admin (no `user_roles` row). This is correct per RBAC v2
  scoping — but combined with A5/A6, it means invited admins can't manage
  reference tables / requisitions.
- **Decision:** keep this behaviour and fix A5/A6 to use workspace-scoped
  checks.

### B4. `invite_user` `ON CONFLICT` predicate
- `ON CONFLICT (email, workspace_id) WHERE status = 'pending' DO UPDATE`
  (`20260513000001:54-63`). Requires a partial unique index with the same
  predicate. Confirm:
  ```sql
  SELECT indexdef FROM pg_indexes
  WHERE schemaname='public' AND tablename='user_invitations';
  ```
  The base table migration creates a non-partial unique index
  (`@c:\Users\USER\CascadeProjects\RouteServe\supabase\migrations\20260121000003_user_invitations.sql`)
  — verify a later migration created the partial form, otherwise resend
  fails with `there is no unique or exclusion constraint matching the
  ON CONFLICT specification`.

---

## C. MEDIUM — cosmetic / code hygiene

### C1. `src/integrations/supabase/types.ts` is stale
- References `Database["public"]["Enums"]["app_role"]` (dropped) and
  `pre_assigned_role` column (renamed to `role_code` in `20260418000001`).
- Lines: 5906, 5926, 5946, 6046, 6054, 6062, 9002, 11035, 11165, 11199,
  11941, 11981, 12201.
- **Fix:** regenerate via `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`.

### C2. `InviteUserParams.app_role` legacy compat
- `@c:\Users\USER\CascadeProjects\RouteServe\src\types\onboarding.ts:138-145`
- The hook `@c:\Users\USER\CascadeProjects\RouteServe\src\hooks\useInvitations.ts:159-165` accepts both fields.
- Only one consumer still uses it: `LinkByEmailDialog.tsx:38-43`. Migrate
  it to `role_code` and remove the compat field.

### C3. `recovery.html` / `invite.html` templates
- Currently open in your editor. Not RBAC-related, but configured in
  `@c:\Users\USER\CascadeProjects\RouteServe\supabase\config.toml:3-9`.
  No legacy refs found.

---

## D. Verification queries

Run these against the live DB to confirm each finding:

```sql
-- 1. Workspaces whose creator has wm.role NOT IN ('owner','admin')
SELECT w.id, w.name, wm.user_id, wm.role, r.code AS role_code
FROM public.workspaces w
JOIN public.workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN public.roles r ON r.id = wm.role_id
WHERE r.code IN ('owner','admin')
  AND (wm.role IS NULL OR wm.role NOT IN ('owner','admin'));

-- 2. Reference tables with NO mutating RLS policy
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname='public'
  AND t.tablename IN (
    'service_zones','driver_availability','vehicle_maintenance',
    'vehicle_trips','driver_vehicle_history','recurring_schedules',
    'delivery_schedules','schedule_batches','upload_validations'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname='public' AND p.tablename=t.tablename
      AND p.cmd IN ('INSERT','UPDATE','DELETE','ALL')
  );

-- 3. Confirm app_role enum is gone (should return 0 rows)
SELECT typname FROM pg_type WHERE typname = 'app_role';

-- 4. Confirm has_role/is_admin definitions are v2-correct
SELECT proname, prosrc FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('has_role','is_admin','is_system_admin','is_workspace_member_v2');

-- 5. Partial unique index on user_invitations (B4)
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='user_invitations';

-- 6. Roles seeded
SELECT code, name, is_system_role FROM public.roles ORDER BY code;
-- Expect: admin, driver, fleet_manager, ops_manager, owner, viewer
```

---

## E. Remediation status

| #  | Item            | Status        | Artifact                                                                                     |
|----|-----------------|---------------|----------------------------------------------------------------------------------------------|
| E1 | A1              | DONE (code)   | `supabase/migrations/20260517000001_fix_user_invitations_rls_rbac_v2.sql` — pending DB apply |
| E1 | A2 + A3 + A4    | DONE          | `useOnboardingWizard.ts`, `TeamSetupStep.tsx`, `ZoneManagerAssignment.tsx`                   |
| E2 | A5 + A6         | DONE (code)   | `supabase/migrations/20260517000002_rbac_v2_helpers_and_ref_table_policies.sql` — pending DB apply |
| E3 | A7              | DIAGNOSTIC    | `scripts/audit-rbac-v2-lost-policies.sql` — run in SQL editor, share output                  |
| E4 | C1              | DONE          | `src/integrations/supabase/types.ts` regenerated via `supabase gen types --linked`           |
| —  | C2              | OPEN          | `InviteUserParams.app_role` legacy field + `LinkByEmailDialog` consumer                      |
| —  | B1              | OPEN          | Sweep `wm.role IN ('owner','admin')` → role_id joins across ~7 files                         |
| —  | B2              | OPEN          | Unify `create_organization_with_admin` on the `'owner'` role                                 |
| —  | B4              | OPEN          | Confirm partial unique index on `user_invitations(email, workspace_id) WHERE status='pending'` |
| —  | A7 follow-up    | OPEN          | After running scripts/audit-rbac-v2-lost-policies.sql, write targeted policy migrations      |

**Side fix:** `supabase/migrations/20241113000000_vlms_schema.sql:34` —
`CHECK (year ... <= EXTRACT(YEAR FROM CURRENT_DATE) + 1)` rewritten to
`<= 2200` to unblock `db push` (non-IMMUTABLE function rejected in CHECK).

## F. Next deploy steps

```powershell
# 1. Apply the two new migrations to the linked project
npx supabase db push

# 2. Run scripts/audit-rbac-v2-lost-policies.sql in the Supabase SQL editor
#    Share the verdict column output so we can write targeted A7 fixes.
```
