-- Batch-level inventory details for traceability, expiry control and damaged stock.
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  manufacturing_date date,
  expiry_date date,
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_available integer NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  reference text,
  created_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, batch_number)
);

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "batches_select" ON public.inventory_batches;
CREATE POLICY "batches_select" ON public.inventory_batches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "batches_insert" ON public.inventory_batches;
CREATE POLICY "batches_insert" ON public.inventory_batches FOR INSERT TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));
DROP POLICY IF EXISTS "batches_update" ON public.inventory_batches;
CREATE POLICY "batches_update" ON public.inventory_batches FOR UPDATE TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON public.inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON public.inventory_batches(expiry_date);
