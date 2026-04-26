-- ============================================================================
-- Add multi-value array columns for IP Names, Funding Sources, Programmes
-- ============================================================================
-- Facilities can now belong to multiple implementing partners, be funded by
-- multiple sources, and serve multiple programme areas simultaneously.
-- The old single-value TEXT columns are kept for backward compatibility.
-- ============================================================================

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS ip_names TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS funding_sources TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS programmes TEXT[] DEFAULT '{}';

-- Migrate existing single values into the new array columns
UPDATE public.facilities
  SET ip_names = ARRAY[ip_name]
  WHERE ip_name IS NOT NULL AND ip_name <> '' AND (ip_names IS NULL OR ip_names = '{}');

UPDATE public.facilities
  SET funding_sources = ARRAY[funding_source]
  WHERE funding_source IS NOT NULL AND funding_source <> '' AND (funding_sources IS NULL OR funding_sources = '{}');

UPDATE public.facilities
  SET programmes = ARRAY[programme]
  WHERE programme IS NOT NULL AND programme <> '' AND (programmes IS NULL OR programmes = '{}');

-- Indexes for array containment queries
CREATE INDEX IF NOT EXISTS idx_facilities_ip_names ON public.facilities USING GIN(ip_names) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_facilities_funding_sources ON public.facilities USING GIN(funding_sources) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_facilities_programmes ON public.facilities USING GIN(programmes) WHERE deleted_at IS NULL;
