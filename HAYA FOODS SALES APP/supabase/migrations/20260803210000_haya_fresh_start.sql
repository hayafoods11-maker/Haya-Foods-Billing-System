-- Fresh start: removes demo/business transaction data but keeps auth users and staff accounts.
TRUNCATE TABLE
  public.activity_logs,
  public.deliveries,
  public.payments,
  public.invoice_items,
  public.invoices,
  public.order_items,
  public.orders,
  public.inventory_transactions,
  public.purchase_entries,
  public.inventory_batches,
  public.customer_addresses,
  public.customers,
  public.products,
  public.categories,
  public.suppliers
RESTART IDENTITY CASCADE;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS case_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS case_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wholesale_price numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.company_settings
SET company_name = 'HAYA FOODS PRODUCTS (PVT) LTD',
    address = 'No.239/7, Muhamathiya Nagar, Railway Line, Madcove, Trincomalee, Sri Lanka',
    telephone = '+94 78 811 0101',
    email = 'info@hayafoods.lk',
    tax_percentage = 0,
    invoice_prefix = 'HF-INV'
WHERE id = 1;

INSERT INTO public.categories (name, description)
VALUES ('Fruit Juices & Nectars', 'Haya Foods natural fruit nectars and flavoured juices');

INSERT INTO public.products (name, sku, category_id, unit, selling_price, wholesale_price, case_size, case_price, cost_price, stock, reorder_level, active)
SELECT item.name, item.sku, category.id, 'bottle', item.retail_price, item.wholesale_price, item.case_size, item.wholesale_price * item.case_size, 0, 0, 24, true
FROM (VALUES
  ('Mango Nectar 200ml', 'HF-MANGO-200', 150.00, 135.00, 24),
  ('Orange Nectar 200ml', 'HF-ORANGE-200', 150.00, 135.00, 24),
  ('Tamarind Nectar 200ml', 'HF-TAMARIND-200', 150.00, 135.00, 24),
  ('Woodapple Nectar 200ml', 'HF-WOODAPPLE-200', 150.00, 135.00, 24),
  ('Mixed Fruit Nectar 200ml', 'HF-MIXED-200', 150.00, 135.00, 24),
  ('Mango Nectar 500ml', 'HF-MANGO-500', 320.00, 288.00, 12),
  ('Orange Nectar 500ml', 'HF-ORANGE-500', 320.00, 288.00, 12),
  ('Tamarind Nectar 500ml', 'HF-TAMARIND-500', 320.00, 288.00, 12),
  ('Woodapple Nectar 500ml', 'HF-WOODAPPLE-500', 320.00, 288.00, 12),
  ('Mixed Fruit Nectar 500ml', 'HF-MIXED-500', 320.00, 288.00, 12),
  ('Strawberry Flavour Juice 190ml', 'HF-STRAWBERRY-190', 60.00, 54.00, 12),
  ('Woodapple Flavour Juice 190ml', 'HF-WOODAPPLE-190', 60.00, 54.00, 12),
  ('Grapes Flavour Juice 190ml', 'HF-GRAPES-190', 60.00, 54.00, 12),
  ('Orange Flavour Juice 190ml', 'HF-ORANGE-190', 60.00, 54.00, 12),
  ('Mixed Fruit Flavour Juice 190ml', 'HF-MIXED-190', 60.00, 54.00, 12)
) AS item(name, sku, retail_price, wholesale_price, case_size)
CROSS JOIN (SELECT id FROM public.categories WHERE name = 'Fruit Juices & Nectars') category;
