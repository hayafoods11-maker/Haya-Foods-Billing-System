CREATE OR REPLACE FUNCTION public.update_product_stock_from_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta integer;
  current_stock integer;
BEGIN
  CASE NEW.type
    WHEN 'purchase' THEN delta := NEW.quantity;
    WHEN 'transfer_in' THEN delta := NEW.quantity;
    WHEN 'return' THEN delta := NEW.quantity;
    WHEN 'sale' THEN delta := -NEW.quantity;
    WHEN 'transfer_out' THEN delta := -NEW.quantity;
    WHEN 'adjustment' THEN delta := NEW.quantity;
    WHEN 'wastage' THEN delta := -NEW.quantity;
    ELSE delta := 0;
  END CASE;
  SELECT stock INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock IS NULL THEN RAISE EXCEPTION 'Product not found for inventory transaction'; END IF;
  IF current_stock + delta < 0 THEN RAISE EXCEPTION 'Insufficient stock. Available: %, requested: %', current_stock, ABS(delta); END IF;
  UPDATE public.products SET stock = current_stock + delta WHERE id = NEW.product_id;
  NEW.balance_after := current_stock + delta;
  RETURN NEW;
END;
$$;
