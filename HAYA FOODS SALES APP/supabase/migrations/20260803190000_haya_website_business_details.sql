-- Business information and juice catalogue taken from the Haya Foods website.
UPDATE public.company_settings
SET company_name = 'HAYA FOODS PRODUCTS (PVT) LTD',
    address = 'No.239/7, Muhamathiya Nagar, Railway Line, Madcove, Trincomalee, Sri Lanka',
    telephone = '+94 78 811 0101',
    email = 'info@hayafoods.lk',
    tax_percentage = 0,
    invoice_prefix = 'HF-INV'
WHERE id = 1;

INSERT INTO public.categories (name, description)
VALUES ('Fruit Juices & Nectars', 'Haya Foods natural fruit nectars and flavoured juices')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (name, sku, category_id, unit, selling_price, cost_price, stock, reorder_level, active)
SELECT item.name, item.sku, category.id, 'bottle', item.price, 0, 0, 24, true
FROM (VALUES
  ('Mango Nectar 200ml', 'HF-MANGO-200', 150.00),
  ('Orange Nectar 200ml', 'HF-ORANGE-200', 150.00),
  ('Tamarind Nectar 200ml', 'HF-TAMARIND-200', 150.00),
  ('Woodapple Nectar 200ml', 'HF-WOODAPPLE-200', 150.00),
  ('Mixed Fruit Nectar 200ml', 'HF-MIXED-200', 150.00),
  ('Strawberry Flavour Juice 190ml', 'HF-STRAWBERRY-190', 60.00),
  ('Woodapple Flavour Juice 190ml', 'HF-WOODAPPLE-190', 60.00),
  ('Grapes Flavour Juice 190ml', 'HF-GRAPES-190', 60.00),
  ('Orange Flavour Juice 190ml', 'HF-ORANGE-190', 60.00),
  ('Mixed Fruit Flavour Juice 190ml', 'HF-MIXED-190', 60.00)
) AS item(name, sku, price)
CROSS JOIN (SELECT id FROM public.categories WHERE name = 'Fruit Juices & Nectars') category
ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, selling_price = EXCLUDED.selling_price, category_id = EXCLUDED.category_id;
