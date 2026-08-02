/*
# Haya Foods - Products, Inventory and Settings (Part 2)

## Purpose
Adds products with SKU/barcode/price/stock, inventory transactions for stock movement history,
and a company settings singleton.

## New Tables
- `products`: catalogue items with category, prices, stock levels, reorder level, expiry.
- `inventory_transactions`: complete stock movement history (purchase, adjustment, transfer, sale, return).
- `company_settings`: singleton row for Haya Foods branding, tax, invoice numbering, currency.

## Security
- RLS enabled on every table.
- Products: read for all staff; write for admin/manager.
- Inventory transactions: read for all staff; writes scoped by role.
- Company settings: read for all staff; write for admin only.

## Notes
1. All monetary values in LKR numeric(12,2).
2. `products.stock` is the live on-hand quantity, kept in sync via triggers in a later migration.
3. Inventory transactions record every movement with type, quantity delta, and reference.
*/

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  barcode text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  unit text NOT NULL DEFAULT 'pcs',
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  expiry_date date,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_select" ON public.products;
CREATE POLICY "prod_select"
ON public.products FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "prod_insert" ON public.products;
CREATE POLICY "prod_insert"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "prod_update" ON public.products;
CREATE POLICY "prod_update"
ON public.products FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "prod_delete" ON public.products;
CREATE POLICY "prod_delete"
ON public.products FOR DELETE
TO authenticated
USING (public.current_staff_role() = 'admin');

-- Inventory transactions
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase','adjustment','transfer_in','transfer_out','sale','return','wastage')),
  quantity integer NOT NULL,
  balance_after integer,
  reference text,
  notes text,
  created_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invtx_select" ON public.inventory_transactions;
CREATE POLICY "invtx_select"
ON public.inventory_transactions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "invtx_insert" ON public.inventory_transactions;
CREATE POLICY "invtx_insert"
ON public.inventory_transactions FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "invtx_update" ON public.inventory_transactions;
CREATE POLICY "invtx_update"
ON public.inventory_transactions FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "invtx_delete" ON public.inventory_transactions;
CREATE POLICY "invtx_delete"
ON public.inventory_transactions FOR DELETE
TO authenticated
USING (public.current_staff_role() = 'admin');

-- Company settings (singleton)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text NOT NULL DEFAULT 'Haya Foods',
  address text,
  telephone text,
  email text,
  logo_url text,
  tax_percentage numeric(5,2) NOT NULL DEFAULT 0,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  invoice_number_start integer NOT NULL DEFAULT 1001,
  currency text NOT NULL DEFAULT 'LKR',
  payment_methods text[] NOT NULL DEFAULT ARRAY['Cash','Card','Bank Transfer','Credit'],
  notification_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON public.company_settings;
CREATE POLICY "settings_select"
ON public.company_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "settings_insert_admin" ON public.company_settings;
CREATE POLICY "settings_insert_admin"
ON public.company_settings FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() = 'admin');

DROP POLICY IF EXISTS "settings_update_admin" ON public.company_settings;
CREATE POLICY "settings_update_admin"
ON public.company_settings FOR UPDATE
TO authenticated
USING (public.current_staff_role() = 'admin')
WITH CHECK (public.current_staff_role() = 'admin');
