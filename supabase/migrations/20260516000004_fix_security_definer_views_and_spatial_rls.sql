-- Migration: Fix security_definer_view and rls_disabled_in_public linter errors
--
-- 1. Convert 17 SECURITY DEFINER views to SECURITY INVOKER
--    Views are safe to convert because:
--    - Most join tables with open authenticated grants or workspace-scoped RLS
--    - Invitation views (all_invitations_view, pending_invitations_view) LEFT JOIN
--      profiles, but the "Users can view profiles in same workspace" RLS policy
--      ensures invited_by_name is visible to workspace members.
--
-- 2. Enable RLS on spatial_ref_sys (PostGIS system table) and add a
--    permissive SELECT policy — the data is public reference data.
--
-- Approach: ALTER VIEW ... SET (security_invoker = true) avoids rewriting
-- view bodies and is the minimal, low-risk fix recommended by Supabase.

BEGIN;

-- ============================================================
-- PART 1: Convert SECURITY DEFINER views → SECURITY INVOKER
-- ============================================================

-- VLMS / Vehicle views
ALTER VIEW IF EXISTS public.vlms_vehicles_with_taxonomy    SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vlms_active_assignments        SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vlms_available_vehicles        SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vlms_overdue_maintenance       SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vlms_upcoming_maintenance      SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vehicles_with_taxonomy         SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vehicles_unified_v             SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vehicle_tier_stats             SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vehicles_with_tier_stats       SET (security_invoker = true);

-- Slot / Batch views
ALTER VIEW IF EXISTS public.batch_slot_utilization         SET (security_invoker = true);
ALTER VIEW IF EXISTS public.slot_assignment_details        SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vehicle_slot_availability      SET (security_invoker = true);

-- Zone / Facility views
ALTER VIEW IF EXISTS public.zone_metrics                   SET (security_invoker = true);
ALTER VIEW IF EXISTS public.zone_facility_hierarchy        SET (security_invoker = true);

-- Scheduler views
ALTER VIEW IF EXISTS public.scheduler_overview_stats       SET (security_invoker = true);

-- Invitation views
-- These LEFT JOIN public.profiles. The "Users can view profiles in same
-- workspace" RLS policy allows workspace members to see each other's names,
-- so invited_by_name remains visible under SECURITY INVOKER.
ALTER VIEW IF EXISTS public.all_invitations_view           SET (security_invoker = true);
ALTER VIEW IF EXISTS public.pending_invitations_view       SET (security_invoker = true);

-- ============================================================
-- PART 2: Restrict API access to spatial_ref_sys (PostGIS extension table)
-- ============================================================
-- spatial_ref_sys is owned by the PostGIS extension; ALTER TABLE ... ENABLE
-- ROW LEVEL SECURITY requires ownership and will fail with 42501.
-- The equivalent mitigation is to revoke PostgREST roles (anon, authenticated)
-- from querying the table — the app never reads spatial_ref_sys via the API.

REVOKE ALL ON public.spatial_ref_sys FROM anon, authenticated;

COMMIT;
