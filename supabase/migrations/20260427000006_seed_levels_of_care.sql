-- Ensure the three standard levels of care exist.
-- Safe to run multiple times; ON CONFLICT DO NOTHING is idempotent.
INSERT INTO public.levels_of_care (name, description, hierarchy_level) VALUES
  ('Primary',   'Primary level health facilities (PHCs, health posts)',                  1),
  ('Secondary', 'Secondary level health facilities (general hospitals)',                  2),
  ('Tertiary',  'Tertiary level health facilities (teaching/specialist hospitals)',        3)
ON CONFLICT (name) DO NOTHING;
