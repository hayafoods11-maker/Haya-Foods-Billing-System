/*
# Haya Foods - Seed Products (Part 7)

## Purpose
Seeds realistic Haya Foods products across all categories with SKU, barcode, prices
(in LKR), stock and reorder levels.

## Data
20 products spanning Frozen Foods, Snacks, Spices, Beverages, Groceries, Dairy.
Prices reflect typical Sri Lankan retail values.
*/

INSERT INTO public.products (name, sku, barcode, category_id, unit, selling_price, cost_price, stock, reorder_level, expiry_date, active)
SELECT p.name, p.sku, p.barcode, c.id, p.unit, p.selling_price, p.cost_price, p.stock, p.reorder_level, p.expiry_date::date, true
FROM (VALUES
  ('Frozen Chicken Drumsticks 1kg', 'FF-001', '8901001', 'Frozen Foods', 'kg', 1250.00, 1080.00, 60, 15, '2026-12-31'),
  ('Frozen Mixed Vegetables 500g', 'FF-002', '8901002', 'Frozen Foods', 'pack', 480.00, 410.00, 40, 10, '2026-10-31'),
  ('Frozen Fish Fingers 300g', 'FF-003', '8901003', 'Frozen Foods', 'pack', 690.00, 590.00, 25, 10, '2026-09-30'),
  ('Frozen Samosa 12pc', 'FF-004', '8901004', 'Frozen Foods', 'pack', 540.00, 460.00, 8, 12, '2026-08-31'),
  ('Munchee Cheese Balls 150g', 'SN-001', '8902001', 'Snacks', 'pack', 220.00, 185.00, 120, 30, '2026-11-30'),
  ('Munchee Lemon Puff 200g', 'SN-002', '8902002', 'Snacks', 'pack', 260.00, 215.00, 80, 25, '2026-11-30'),
  ('Ritz Crackers 150g', 'SN-003', '8902003', 'Snacks', 'pack', 340.00, 290.00, 6, 20, '2026-10-31'),
  ('Ceylon Tea 200g', 'BV-001', '8904001', 'Beverages', 'pack', 720.00, 620.00, 90, 20, '2027-06-30'),
  ('Elephant House Cream Soda 1L', 'BV-002', '8904002', 'Beverages', 'btl', 290.00, 245.00, 150, 40, '2026-12-31'),
  ('Elephant House Orange Bar 350ml', 'BV-003', '8904003', 'Beverages', 'btl', 110.00, 92.00, 200, 50, '2026-12-31'),
  ('Mango Nectar 1L', 'BV-004', '8904004', 'Beverages', 'btl', 380.00, 325.00, 45, 15, '2026-10-31'),
  ('Roasted Curry Powder 100g', 'SP-001', '8903001', 'Spices', 'pack', 180.00, 150.00, 110, 25, '2027-03-31'),
  ('Chili Powder 100g', 'SP-002', '8903002', 'Spices', 'pack', 165.00, 138.00, 95, 25, '2027-03-31'),
  ('Cinnamon Sticks 50g', 'SP-003', '8903003', 'Spices', 'pack', 240.00, 200.00, 30, 12, '2027-06-30'),
  ('Samba Rice 5kg', 'GR-001', '8905001', 'Groceries', 'pack', 1450.00, 1320.00, 70, 20, '2027-01-31'),
  ('Wheat Flour 1kg', 'GR-002', '8905002', 'Groceries', 'kg', 210.00, 178.00, 140, 30, '2027-01-31'),
  ('Dhal 1kg', 'GR-003', '8905003', 'Groceries', 'kg', 410.00, 360.00, 9, 15, '2027-01-31'),
  ('Kotmale Fresh Milk 1L', 'DR-001', '8906001', 'Dairy', 'btl', 410.00, 365.00, 60, 20, '2026-09-15'),
  ('Kotmale Butter 100g', 'DR-002', '8906002', 'Dairy', 'pack', 280.00, 245.00, 35, 12, '2026-09-30'),
  ('Kotmale Cheese Slice 200g', 'DR-003', '8906003', 'Dairy', 'pack', 620.00, 540.00, 4, 10, '2026-10-31')
) AS p(name, sku, barcode, category_name, unit, selling_price, cost_price, stock, reorder_level, expiry_date)
JOIN public.categories c ON c.name = p.category_name
ON CONFLICT (sku) DO NOTHING;
