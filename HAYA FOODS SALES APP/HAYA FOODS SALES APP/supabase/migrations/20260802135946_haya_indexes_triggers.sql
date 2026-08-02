/*
# Haya Foods - Indexes and Triggers (Part 4)

## Purpose
Performance indexes and a trigger that automatically inserts an inventory_transaction
and updates product stock whenever an order is confirmed/delivered via inventory_transactions.

## Changes
1. Adds indexes on frequently-queried foreign keys and status columns.
2. Adds a trigger function `update_product_stock_from_tx()` that adjusts product.stock
   whenever an inventory_transaction is inserted (for sale/return/wastage/adjustment/transfer/ purchase).
3. Adds `update_updated_at` trigger for orders.

## Notes
1. Stock is derived from inventory_transactions for purchases and manual adjustments.
   For sales, the app writes an inventory_transaction of type 'sale' which decrements stock.
2. All trigger functions are SECURITY DEFINER so they can update products even from
   non-owner inserts (RLS on inventory_transactions already controls who can insert).
*/

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_product ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_created ON public.inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON public.invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON public.invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON public.deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_logs_created ON public.activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON public.purchase_entries(product_id);

-- Trigger: adjust product stock on inventory transaction insert
CREATE OR REPLACE FUNCTION public.update_product_stock_from_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta integer;
BEGIN
  -- Determine the signed effect on stock.
  CASE NEW.type
    WHEN 'purchase' THEN delta := NEW.quantity;
    WHEN 'transfer_in' THEN delta := NEW.quantity;
    WHEN 'return' THEN delta := NEW.quantity;
    WHEN 'sale' THEN delta := -NEW.quantity;
    WHEN 'transfer_out' THEN delta := -NEW.quantity;
    WHEN 'adjustment' THEN delta := NEW.quantity; -- signed quantity for adjustments
    WHEN 'wastage' THEN delta := -NEW.quantity;
    ELSE delta := 0;
  END CASE;

  UPDATE public.products
    SET stock = GREATEST(stock + delta, 0)
    WHERE id = NEW.product_id;

  NEW.balance_after := (SELECT stock FROM public.products WHERE id = NEW.product_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_stock ON public.inventory_transactions;
CREATE TRIGGER trg_update_stock
  BEFORE INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_product_stock_from_tx();

-- Trigger: keep orders.updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON public.company_settings;
CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
