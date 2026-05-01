ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS program VARCHAR(100);

COMMENT ON COLUMN public.invoices.program IS 'Associated program (e.g., Family Planning, HIV/AIDS)';
