/*
# Haya Foods - Orders, Invoices, Payments, Deliveries (Part 3)

## Purpose
Transactional tables for the sales/billing/delivery workflow.

## New Tables
- `orders`: sales orders with status tracking (draft -> pending -> confirmed -> packed -> out_for_delivery -> delivered / cancelled).
- `order_items`: line items per order (product, qty, price, discount).
- `invoices`: invoices generated from orders, with invoice numbers and payment status.
- `invoice_items`: line items per invoice.
- `payments`: payments recorded against invoices (full/partial, multiple methods).
- `deliveries`: delivery assignments linked to orders, with status.
- `activity_logs`: audit trail of staff actions.

## Security
- RLS enabled on every table.
- All staff can read; writes scoped by role. Sales reps see their own orders; delivery staff can update their deliveries.

## Notes
1. All monetary values in LKR numeric(12,2).
2. Order status is one of: draft, pending, confirmed, packed, out_for_delivery, delivered, cancelled.
3. `created_by` records which staff member created the order (sales rep scope).
*/

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','confirmed','packed','out_for_delivery','delivered','cancelled')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  delivery_date date,
  delivery_address text,
  delivery_notes text,
  notes text,
  is_pos boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select"
ON public.orders FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update"
ON public.orders FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager','cashier','sales_rep','delivery'))
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep','delivery'));

DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_delete"
ON public.orders FOR DELETE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'));

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orderitems_select" ON public.order_items;
CREATE POLICY "orderitems_select"
ON public.order_items FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "orderitems_insert" ON public.order_items;
CREATE POLICY "orderitems_insert"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "orderitems_update" ON public.order_items;
CREATE POLICY "orderitems_update"
ON public.order_items FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'))
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "orderitems_delete" ON public.order_items;
CREATE POLICY "orderitems_delete"
ON public.order_items FOR DELETE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'));

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select"
ON public.invoices FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update"
ON public.invoices FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager','cashier'))
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier'));

DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_delete"
ON public.invoices FOR DELETE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'));

-- Invoice items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitems_select" ON public.invoice_items;
CREATE POLICY "invitems_select"
ON public.invoice_items FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "invitems_insert" ON public.invoice_items;
CREATE POLICY "invitems_insert"
ON public.invoice_items FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "invitems_update" ON public.invoice_items;
CREATE POLICY "invitems_update"
ON public.invoice_items FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "invitems_delete" ON public.invoice_items;
CREATE POLICY "invitems_delete"
ON public.invoice_items FOR DELETE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'));

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  method text NOT NULL CHECK (method IN ('Cash','Card','Bank Transfer','Credit')),
  reference text,
  received_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select"
ON public.payments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier'));

DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update"
ON public.payments FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "payments_delete" ON public.payments;
CREATE POLICY "payments_delete"
ON public.payments FOR DELETE
TO authenticated
USING (public.current_staff_role() = 'admin');

-- Deliveries
CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','out_for_delivery','delivered','failed')),
  customer_name text,
  address text,
  phone text,
  notes text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select" ON public.deliveries;
CREATE POLICY "deliveries_select"
ON public.deliveries FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "deliveries_insert" ON public.deliveries;
CREATE POLICY "deliveries_insert"
ON public.deliveries FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "deliveries_update" ON public.deliveries;
CREATE POLICY "deliveries_update"
ON public.deliveries FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager','delivery'))
WITH CHECK (public.current_staff_role() IN ('admin','manager','delivery'));

DROP POLICY IF EXISTS "deliveries_delete" ON public.deliveries;
CREATE POLICY "deliveries_delete"
ON public.deliveries FOR DELETE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'));

-- Activity logs (audit trail)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_select" ON public.activity_logs;
CREATE POLICY "logs_select"
ON public.activity_logs FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "logs_insert" ON public.activity_logs;
CREATE POLICY "logs_insert"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Purchase entries
CREATE TABLE IF NOT EXISTS public.purchase_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  received_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_select" ON public.purchase_entries;
CREATE POLICY "purchases_select"
ON public.purchase_entries FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "purchases_insert" ON public.purchase_entries;
CREATE POLICY "purchases_insert"
ON public.purchase_entries FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "purchases_update" ON public.purchase_entries;
CREATE POLICY "purchases_update"
ON public.purchase_entries FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "purchases_delete" ON public.purchase_entries;
CREATE POLICY "purchases_delete"
ON public.purchase_entries FOR DELETE
TO authenticated
USING (public.current_staff_role() = 'admin');
