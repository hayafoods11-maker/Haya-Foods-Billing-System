/*
# Haya Foods - Seed Categories, Suppliers, Settings (Part 6)

## Purpose
Inserts the base reference data: product categories, suppliers, and the singleton
company settings row for Haya Foods. Products, customers and orders are seeded in
subsequent migrations so each file stays small.

## Data inserted
- 6 categories: Frozen Foods, Snacks, Spices, Beverages, Groceries, Dairy.
- 4 suppliers: Ceylon Cold Stores, Mass Distributors, Lanka Spice Traders, Nesto Distributors.
- 1 company_settings row (singleton, id=1).

## Notes
1. Uses ON CONFLICT DO NOTHING so re-running is safe.
2. Settings row is inserted by admin-equivalent SECURITY DEFINER context (migration role).
*/

INSERT INTO public.categories (name, description)
SELECT * FROM (VALUES
  ('Frozen Foods', 'Frozen vegetables, meats and ready-to-cook items'),
  ('Snacks', 'Chips, biscuits and savoury snacks'),
  ('Spices', 'Whole and ground spices'),
  ('Beverages', 'Soft drinks, juices and tea'),
  ('Groceries', 'Rice, flour, dhal and staples'),
  ('Dairy', 'Milk, butter and cheese')
) AS t(name, description)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.suppliers (name, contact_person, phone, email, address)
SELECT * FROM (VALUES
  ('Ceylon Cold Stores', 'Nuwan Perera', '0112345678', 'sales@ceyloncold.lk', '35 Negombo Rd, Colombo 15'),
  ('Mass Distributors', 'Roshan Silva', '0112876543', 'orders@massdist.lk', '12 Kandy Rd, Colombo 07'),
  ('Lanka Spice Traders', 'Anura Bandara', '0113456789', 'info@lankaspice.lk', '88 Main St, Matale'),
  ('Nesto Distributors', 'Tharuka Jay', '0114567890', 'hello@nesto.lk', '5 Galle Rd, Colombo 03')
) AS t(name, contact_person, phone, email, address)
ON CONFLICT DO NOTHING;

INSERT INTO public.company_settings (id, company_name, address, telephone, email, tax_percentage, invoice_prefix, invoice_number_start, currency, payment_methods)
VALUES (1, 'Haya Foods', '120 Galle Road, Colombo 04, Sri Lanka', '+94 11 245 6789', 'hello@hayafoods.lk', 8.00, 'INV', 1001, 'LKR', ARRAY['Cash','Card','Bank Transfer','Credit'])
ON CONFLICT (id) DO NOTHING;
