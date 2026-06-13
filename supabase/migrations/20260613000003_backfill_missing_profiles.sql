-- ============================================================================
-- Backfill: create missing profiles for any auth.users without one
-- ============================================================================
-- The handle_new_user() trigger should create a profiles row on signup, but
-- edge cases leave orphans. Any future operation that touches workspace_members
-- (FK to profiles.id) will fail for these users. Fix them now.
-- ============================================================================

INSERT INTO public.profiles (id, full_name, phone)
SELECT
  au.id,
  au.raw_user_meta_data ->> 'full_name',
  au.raw_user_meta_data ->> 'phone'
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
