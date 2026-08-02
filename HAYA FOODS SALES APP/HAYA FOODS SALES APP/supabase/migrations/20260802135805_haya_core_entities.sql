/*
# Haya Foods - Core Entities (Part 1)

## Purpose
Foundation tables for the Haya Foods sales, billing, inventory and delivery system.

## New Tables
- `staff`: employees linked to Supabase auth users, with a role.
- `customers`: customers with credit limits and outstanding balances.
- `customer_addresses`: delivery/billing addresses per customer.
- `categories`: product categories.
- `suppliers`: vendors that supply stock.

## Security
- Helper function `current_staff_role()` created after the staff table.
- RLS enabled on every table with role-based policies.

## Notes
1. `staff.id` references `auth.users(id)`.
2. Monetary values in LKR, numeric(12,2).
*/

-- Staff / users table created first (no function-dependent policies yet).
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('admin','manager','cashier','sales_rep','delivery')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Helper: returns the role of the currently authenticated staff member (or NULL).
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;

-- Staff policies (now that the function exists).
DROP POLICY IF EXISTS "staff_read_authenticated" ON public.staff;
CREATE POLICY "staff_read_authenticated"
ON public.staff FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "staff_insert_self_or_admin" ON public.staff;
CREATE POLICY "staff_insert_self_or_admin"
ON public.staff FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id OR public.current_staff_role() = 'admin');

DROP POLICY IF EXISTS "staff_update_admin" ON public.staff;
CREATE POLICY "staff_update_admin"
ON public.staff FOR UPDATE
TO authenticated
USING (public.current_staff_role() = 'admin')
WITH CHECK (public.current_staff_role() = 'admin');

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  company text,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select"
ON public.customers FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update"
ON public.customers FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_delete"
ON public.customers FOR DELETE
TO authenticated
USING (public.current_staff_role() = 'admin');

-- Customer addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  address_line text NOT NULL,
  city text,
  district text,
  postal_code text,
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addr_select" ON public.customer_addresses;
CREATE POLICY "addr_select"
ON public.customer_addresses FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "addr_insert" ON public.customer_addresses;
CREATE POLICY "addr_insert"
ON public.customer_addresses FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager','cashier','sales_rep'));

DROP POLICY IF EXISTS "addr_update" ON public.customer_addresses;
CREATE POLICY "addr_update"
ON public.customer_addresses FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "addr_delete" ON public.customer_addresses;
CREATE POLICY "addr_delete"
ON public.customer_addresses FOR DELETE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'));

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cat_select" ON public.categories;
CREATE POLICY "cat_select"
ON public.categories FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "cat_insert" ON public.categories;
CREATE POLICY "cat_insert"
ON public.categories FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "cat_update" ON public.categories;
CREATE POLICY "cat_update"
ON public.categories FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "cat_delete" ON public.categories;
CREATE POLICY "cat_delete"
ON public.categories FOR DELETE
TO authenticated
USING (public.current_staff_role() = 'admin');

-- Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sup_select" ON public.suppliers;
CREATE POLICY "sup_select"
ON public.suppliers FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "sup_insert" ON public.suppliers;
CREATE POLICY "sup_insert"
ON public.suppliers FOR INSERT
TO authenticated
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "sup_update" ON public.suppliers;
CREATE POLICY "sup_update"
ON public.suppliers FOR UPDATE
TO authenticated
USING (public.current_staff_role() IN ('admin','manager'))
WITH CHECK (public.current_staff_role() IN ('admin','manager'));

DROP POLICY IF EXISTS "sup_delete" ON public.suppliers;
CREATE POLICY "sup_delete"
ON public.suppliers FOR DELETE
TO authenticated
USING (public.current_staff_role() = 'admin');
