ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS case_size integer NOT NULL DEFAULT 1 CHECK (case_size >= 1),
  ADD COLUMN IF NOT EXISTS case_price numeric(12,2) NOT NULL DEFAULT 0;
