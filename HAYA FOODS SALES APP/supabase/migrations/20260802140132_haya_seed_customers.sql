/*
# Haya Foods - Seed Customers (Part 8)

## Purpose
Seeds realistic Sri Lankan customers with credit limits, outstanding balances and
delivery addresses.

## Data
- 8 customers (mix of restaurants, retailers and individuals).
- Each gets a default delivery address.
*/

INSERT INTO public.customers (name, phone, email, company, credit_limit, outstanding_balance, notes, active)
SELECT * FROM (VALUES
  ('Sunrise Restaurant', '0771234567', 'orders@sunrise.lk', 'Sunrise Restaurant', 50000.00, 12500.00, 'Daily wholesale buyer', true),
  ('GreenMart Super', '0772345678', 'purchase@greenmart.lk', 'GreenMart Super', 80000.00, 32000.00, 'Weekly settlement', true),
  ('Kandy Food Corner', '0813456789', 'kandyfood@gmail.com', 'Kandy Food Corner', 30000.00, 0.00, 'Pays on delivery', true),
  ('Kumara Stores', '0774567890', 'kumara@stores.lk', 'Kumara Stores', 20000.00, 8500.00, 'Monthly credit', true),
  ('Nimal Perera', '0775678901', 'nimal.p@gmail.com', NULL, 5000.00, 0.00, 'Walk-in regular', true),
  ('Deepa Cafe', '0776789012', 'deepa.cafe@gmail.com', 'Deepa Cafe', 25000.00, 14000.00, 'Weekly delivery', true),
  ('City Bakers', '0777890123', 'city@bakers.lk', 'City Bakers', 40000.00, 0.00, 'Bulk flour buyer', true),
  ('Amal Restaurant', '0778901234', 'amal.r@gmail.com', 'Amal Restaurant', 15000.00, 6700.00, 'Frequent buyer', true)
) AS t(name, phone, email, company, credit_limit, outstanding_balance, notes, active)
ON CONFLICT DO NOTHING;

INSERT INTO public.customer_addresses (customer_id, label, address_line, city, district, postal_code, phone, is_default)
SELECT c.id, a.label, a.address_line, a.city, a.district, a.postal_code, a.phone, a.is_default
FROM (VALUES
  ('Sunrise Restaurant', 'Store', '45 Galle Rd, Bambalapitiya', 'Colombo', 'Colombo', '00400', '0771234567', true),
  ('GreenMart Super', 'Outlet', '12 Kandy Rd, Nugegoda', 'Colombo', 'Colombo', '10250', '0772345678', true),
  ('Kandy Food Corner', 'Shop', '88 Peradeniya Rd, Kandy', 'Kandy', 'Kandy', '20000', '0813456789', true),
  ('Kumara Stores', 'Shop', '23 Station Rd, Negombo', 'Gampaha', 'Gampaha', '11500', '0774567890', true),
  ('Nimal Perera', 'Home', '7 Temple Rd, Maharagama', 'Colombo', 'Colombo', '10280', '0775678901', true),
  ('Deepa Cafe', 'Cafe', '34 Beach Rd, Mount Lavinia', 'Colombo', 'Colombo', '10370', '0776789012', true),
  ('City Bakers', 'Bakery', '10 Hill St, Dehiwala', 'Colombo', 'Colombo', '10350', '0777890123', true),
  ('Amal Restaurant', 'Store', '56 Station Rd, Moratuwa', 'Colombo', 'Colombo', '10400', '0778901234', true)
) AS a(name, label, address_line, city, district, postal_code, phone, is_default)
JOIN public.customers c ON c.name = a.name
ON CONFLICT DO NOTHING;
