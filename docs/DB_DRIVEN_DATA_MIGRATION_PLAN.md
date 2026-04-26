# DB-Driven Data Migration Plan
**Created:** 2026-04-26  
**Status:** Ready to execute  
**Context:** Replace hardcoded frontend constants with DB-fetched data. Based on full dependency audit completed in this session.

---

## What was already fixed (this session)

- `ITEM_PROGRAMS` / `program` field on requisitions → wired to `useProgrammeCategories` in:
  - `src/pages/storefront/items/page.tsx` (filter dropdown)
  - `src/pages/storefront/requisitions/components/NewRequisitionWizard/ManualEntryForm.tsx` (freetext input → Select)

---

## Item 1 — `ITEM_CATEGORIES` → DB-driven

**Priority:** High  
**Risk:** High — 8 consumers across 7 files, no DB table yet  
**Estimated effort:** Medium

### Background
`ITEM_CATEGORIES` is a hardcoded array of 16 strings in `src/types/items.ts`. No `item_categories` table exists in the DB yet.

### Consumers and their usage pattern

| File | Usage type | Migration complexity |
|---|---|---|
| `src/hooks/useItems.ts:353` | Returns from `getAvailableCategories()` | Replace with DB call |
| `src/pages/storefront/items/page.tsx:286` | Filter dropdown | Replace with hook |
| `src/pages/storefront/items/components/ItemFormDialog.tsx:62,75,91` | Dropdown + default value (`ITEM_CATEGORIES[0]`) | Replace with hook + handle loading state |
| `src/pages/storefront/programs/components/AddItemManuallyDialog.tsx:145` | Dropdown | Replace with hook |
| `src/pages/storefront/programs/components/UploadProgramItemsDialog.tsx:254,303` | **Synchronous CSV parser** — `.find()` for validation | Pass categories as parameter |
| `src/pages/storefront/items/components/UploadItemsDialog.tsx:210` | **Synchronous CSV parser** | Pass categories as parameter |
| `src/pages/storefront/invoice/components/UploadFileForm.tsx:283` | **Synchronous CSV parser** | Pass categories as parameter |

### Steps

**Step 1 — DB migration**
Create `supabase/migrations/[timestamp]_create_item_categories.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read item_categories"
  ON public.item_categories FOR SELECT TO authenticated USING (true);
-- Seed with existing 16 categories
INSERT INTO public.item_categories (name, code, sort_order) VALUES
  ('Tablet', 'tablet', 1), ('Capsule', 'capsule', 2), ('Suspension', 'suspension', 3),
  ('Syrup', 'syrup', 4), ('Injection', 'injection', 5), ('Intravenous', 'intravenous', 6),
  ('Oral Fluid', 'oral_fluid', 7), ('Opthal-Mics', 'opthal_mics', 8), ('Cream', 'cream', 9),
  ('Extemporaneous', 'extemporaneous', 10), ('Consummable', 'consummable', 11),
  ('Aerosol', 'aerosol', 12), ('Vaccine', 'vaccine', 13), ('Powder', 'powder', 14),
  ('Device', 'device', 15), ('Insertion', 'insertion', 16);
```

**Step 2 — Create hook**
Create `src/hooks/useItemCategories.ts`:
- `useItemCategories(onlyActive = true)` — fetches from `item_categories`, ordered by `sort_order`
- Export `ItemCategory` interface

**Step 3 — Update `useItems.ts`**
- `getAvailableCategories()` at line 353: return categories from hook or accept as parameter

**Step 4 — Update UI dropdowns (4 files)**
- `items/page.tsx`, `ItemFormDialog.tsx`, `AddItemManuallyDialog.tsx`: import hook, replace `ITEM_CATEGORIES.map(...)` with `categories.map(...)`
- `ItemFormDialog.tsx` default value: handle empty array gracefully (no fallback to `'Tablet'` hardcode)

**Step 5 — Update upload parsers (3 files)**
The parsers are synchronous — they cannot use hooks. Strategy: fetch categories once at the dialog level and pass them down as a prop to the parser functions.
- `UploadProgramItemsDialog.tsx`: call `useItemCategories()` in the component, pass `categories` to the validation functions
- `UploadItemsDialog.tsx`: same pattern
- `UploadFileForm.tsx`: same pattern

**Step 6 — Keep `ITEM_CATEGORIES` export as deprecated fallback** (don't delete yet — ensure all consumers work before removing)

---

## Item 2 — `activeIntegrations` → DB-driven

**Priority:** Medium  
**Risk:** Low — isolated to one page  
**Estimated effort:** Small

### Background
`src/pages/admin/integration/page.tsx` has `activeIntegrations` hardcoded to a single Mod4 entry with comment `// Mock active integrations (in real app, fetch from database)`. The `AVAILABLE_INTEGRATIONS` catalog (in `src/data/integrations.ts`) is legitimately static and should stay.

### Steps

**Step 1 — DB migration**
Create `supabase/migrations/[timestamp]_create_workspace_integrations.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_type text NOT NULL,        -- matches AvailableIntegration.type
  status text NOT NULL DEFAULT 'active', -- active | disabled | error
  config jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, integration_type)
);
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;
-- Members of workspace can read; admins can write
CREATE POLICY "Workspace members can read integrations"
  ON public.workspace_integrations FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "Workspace admins can manage integrations"
  ON public.workspace_integrations FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));
```

**Step 2 — Create hook**
Create `src/hooks/useWorkspaceIntegrations.ts`:
- `useWorkspaceIntegrations(workspaceId)` — fetches from `workspace_integrations`
- `useUpsertWorkspaceIntegration()` — mutation for save config
- `useDisableWorkspaceIntegration()` — mutation for disable

**Step 3 — Update `integration/page.tsx`**
- Replace `activeIntegrations` hardcoded array with hook data
- Wire `handleSaveConfig` to call `useUpsertWorkspaceIntegration` mutation
- Wire `handleDisable` to call `useDisableWorkspaceIntegration` mutation
- Remove the `TODO: Refresh active integrations list` comment (query invalidation handles it)

---

## Item 3 — `VEHICLE_CATEGORIES` (vehicleTaxonomy.ts) → DB-driven

**Priority:** Medium  
**Risk:** High — module-level usage, two different taxonomy systems in play  
**Estimated effort:** Large

### Background
There are two separate vehicle classification systems in the codebase:
1. **EU taxonomy** (`vehicle_categories` DB table) — codes like L1, M1, N1. Already wired via `useVehicleCategories` in `CategorySelector`, `CategoryTypeSelector`, `VehicleConfigurator`, `Step1CategorySelect`.
2. **VLMS taxonomy** (`src/lib/vlms/vehicleTaxonomy.ts`) — custom IDs like `cat-light-mobility`, `cat-passenger`. Used only by the VLMS onboarding wizard steps.

These serve different workflows and are not interchangeable today.

### Key risk
`VehicleCategoryStep.tsx` lines 15–16 reference `VEHICLE_CATEGORIES` **at module level** (outside any component function). This means the data is consumed at import time — switching to async requires moving this inside the component.

### Steps

**Step 1 — Decide: reconcile or separate**
Two options:
- **Option A (Recommended):** Seed the VLMS taxonomy IDs into `vehicle_categories` table alongside EU codes, add a `taxonomy` column (`eu` | `vlms`), and use the hook filtered by `taxonomy = 'vlms'` in the onboarding steps.
- **Option B:** Leave as-is, treat `vehicleTaxonomy.ts` as a curated static config (like a route config file).

Option A requires a migration to add VLMS categories to the DB table.

**Step 2 — DB migration (if Option A)**
Add VLMS taxonomy entries to `vehicle_categories` table with a `taxonomy` discriminator column. Include all 5 VLMS categories and their sub-types (25 types).

**Step 3 — Create `useVlmsTaxonomy` hook**
Hook fetches from `vehicle_categories` filtered by `taxonomy = 'vlms'`, reconstructs nested `{ category, subtypes }` structure that matches what `getSubtypesByCategory` returns today.

**Step 4 — Refactor the 3 onboarding step components**
- `VehicleCategoryStep.tsx`: Move `mainCategories` and `specializedCategories` from module level into component body. Add loading state.
- `VehicleSubcategoryStep.tsx`: Replace `getSubtypesByCategory(categoryId)` call with hook data.
- `VehicleTypeConfigStep.tsx`: Replace `getSubtypesByCategory` and `getSlotConstraints` calls. Slot constraints would need to be stored in DB as JSONB on the vehicle type row.

**Step 5 — Keep `vehicleTaxonomy.ts` as fallback** until all onboarding steps are verified working with DB data.

---

## Item 4 — `DEFAULT_SLOT_COSTS` (packaging-calculator.ts)

**Priority:** None  
**Action:** No change needed

The functions `computePackaging` and `createPackagingRecord` in `packaging-calculator.ts` are **never called from frontend code**. Packaging is handled entirely by the `auto_packaging_trigger` DB trigger, which reads from the `packaging_slot_costs` table directly. The `DEFAULT_SLOT_COSTS` constant is already a dead-code fallback. Leave the file as-is.

---

## Execution Order

1. **Item 2 — `activeIntegrations`** — isolated, low risk, one page. Good warm-up.
2. **Item 1 — `ITEM_CATEGORIES`** — highest business value, many consumers. Do migration first, then update consumers file by file.
3. **Item 3 — Vehicle taxonomy** — confirm Option A vs B before starting. Largest scope.

---

## Pre-execution checklist (for each item)

- [ ] Run `npx tsc --noEmit` clean before starting
- [ ] Migration tested locally (`supabase db push`)
- [ ] Hook created with correct `staleTime` and error handling
- [ ] All consumers updated
- [ ] `npx tsc --noEmit` clean after
- [ ] Test UI manually for affected pages
