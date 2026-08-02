/*
# Haya Foods - Seed Orders, Invoices, Payments, Deliveries (Part 9)

## Purpose
Seeds a realistic set of recent orders, invoices, payments and deliveries so the
dashboards and reports have meaningful data on first load. All amounts in LKR.

## Data
- 6 orders across various statuses (delivered, out_for_delivery, pending, confirmed, packed).
- 6 invoices (matching orders) with payment statuses (paid, partial, unpaid).
- 4 payments recorded against invoices.
- 3 deliveries assigned to out-for-delivery / pending orders.
*/

-- Orders + invoices + payments + deliveries created in a DO block so we can use variables.
DO $$
DECLARE
  o_id uuid;
  inv_id uuid;
  sub numeric(12,2);
  tax numeric(12,2);
  tot numeric(12,2);
BEGIN
  -- Order 1: Sunrise Restaurant - delivered, paid
  SELECT id INTO o_id FROM public.customers WHERE name='Sunrise Restaurant';
  sub := 6250.00; tax := 500.00; tot := sub + tax;
  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal, discount_amount, tax_amount, total, payment_method, delivery_date, delivery_address, is_pos, created_at)
  VALUES (gen_random_uuid(), 'ORD-1001', o_id, 'delivered', sub, 0, tax, tot, 'Cash', CURRENT_DATE - 5, '45 Galle Rd, Bambalapitiya', false, now() - interval '5 days')
  RETURNING id INTO o_id;

  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 2, p.selling_price, 2*p.selling_price FROM public.products p WHERE p.sku='FF-001';
  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 3, p.selling_price, 3*p.selling_price FROM public.products p WHERE p.sku='BV-002';

  INSERT INTO public.invoices (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, payment_method, created_at)
  VALUES (gen_random_uuid(), 'INV-1001', o_id, (SELECT id FROM public.customers WHERE name='Sunrise Restaurant'), sub, 0, tax, tot, tot, 0, 'paid', 'Cash', now() - interval '5 days')
  RETURNING id INTO inv_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT inv_id, p.id, p.name, 2, p.selling_price, 2*p.selling_price FROM public.products p WHERE p.sku='FF-001';
  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT inv_id, p.id, p.name, 3, p.selling_price, 3*p.selling_price FROM public.products p WHERE p.sku='BV-002';

  INSERT INTO public.payments (invoice_id, customer_id, amount, method, created_at)
  VALUES (inv_id, (SELECT id FROM public.customers WHERE name='Sunrise Restaurant'), tot, 'Cash', now() - interval '5 days');

  INSERT INTO public.deliveries (order_id, status, customer_name, address, phone, notes, delivered_at, created_at)
  VALUES (o_id, 'delivered', 'Sunrise Restaurant', '45 Galle Rd, Bambalapitiya', '0771234567', 'Left at reception', now() - interval '4 days', now() - interval '5 days');

  -- Order 2: GreenMart Super - out_for_delivery, partial
  SELECT id INTO o_id FROM public.customers WHERE name='GreenMart Super';
  sub := 8700.00; tax := 696.00; tot := sub + tax;
  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal, discount_amount, tax_amount, total, payment_method, delivery_date, delivery_address, is_pos, created_at)
  VALUES (gen_random_uuid(), 'ORD-1002', o_id, 'out_for_delivery', sub, 0, tax, tot, 'Credit', CURRENT_DATE, '12 Kandy Rd, Nugegoda', false, now() - interval '1 day')
  RETURNING id INTO o_id;

  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 4, p.selling_price, 4*p.selling_price FROM public.products p WHERE p.sku='GR-001';
  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 2, p.selling_price, 2*p.selling_price FROM public.products p WHERE p.sku='BV-001';

  INSERT INTO public.invoices (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, payment_method, created_at)
  VALUES (gen_random_uuid(), 'INV-1002', o_id, (SELECT id FROM public.customers WHERE name='GreenMart Super'), sub, 0, tax, tot, 4000.00, tot-4000.00, 'partial', 'Credit', now() - interval '1 day')
  RETURNING id INTO inv_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT inv_id, p.id, p.name, 4, p.selling_price, 4*p.selling_price FROM public.products p WHERE p.sku='GR-001';
  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT inv_id, p.id, p.name, 2, p.selling_price, 2*p.selling_price FROM public.products p WHERE p.sku='BV-001';

  INSERT INTO public.payments (invoice_id, customer_id, amount, method, created_at)
  VALUES (inv_id, (SELECT id FROM public.customers WHERE name='GreenMart Super'), 4000.00, 'Bank Transfer', now() - interval '1 day');

  INSERT INTO public.deliveries (order_id, status, customer_name, address, phone, notes, created_at)
  VALUES (o_id, 'out_for_delivery', 'GreenMart Super', '12 Kandy Rd, Nugegoda', '0772345678', 'Call before delivery', now() - interval '6 hours');

  -- Order 3: Deepa Cafe - pending, unpaid
  SELECT id INTO o_id FROM public.customers WHERE name='Deepa Cafe';
  sub := 2360.00; tax := 188.80; tot := sub + tax;
  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal, discount_amount, tax_amount, total, payment_method, delivery_date, delivery_address, is_pos, created_at)
  VALUES (gen_random_uuid(), 'ORD-1003', o_id, 'pending', sub, 0, tax, tot, 'Credit', CURRENT_DATE + 1, '34 Beach Rd, Mount Lavinia', false, now() - interval '3 hours')
  RETURNING id INTO o_id;

  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 4, p.selling_price, 4*p.selling_price FROM public.products p WHERE p.sku='DR-001';
  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 4, p.selling_price, 4*p.selling_price FROM public.products p WHERE p.sku='SN-001';

  INSERT INTO public.invoices (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, payment_method, created_at)
  VALUES (gen_random_uuid(), 'INV-1003', o_id, (SELECT id FROM public.customers WHERE name='Deepa Cafe'), sub, 0, tax, tot, 0, tot, 'unpaid', 'Credit', now() - interval '3 hours')
  RETURNING id INTO inv_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT inv_id, p.id, p.name, 4, p.selling_price, 4*p.selling_price FROM public.products p WHERE p.sku='DR-001';
  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT inv_id, p.id, p.name, 4, p.selling_price, 4*p.selling_price FROM public.products p WHERE p.sku='SN-001';

  INSERT INTO public.deliveries (order_id, status, customer_name, address, phone, notes, created_at)
  VALUES (o_id, 'pending', 'Deepa Cafe', '34 Beach Rd, Mount Lavinia', '0776789012', 'Deliver after 4pm', now() - interval '3 hours');

  -- Order 4: Kumara Stores - confirmed, partial
  SELECT id INTO o_id FROM public.customers WHERE name='Kumara Stores';
  sub := 2050.00; tax := 164.00; tot := sub + tax;
  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal, discount_amount, tax_amount, total, payment_method, delivery_date, delivery_address, is_pos, created_at)
  VALUES (gen_random_uuid(), 'ORD-1004', o_id, 'confirmed', sub, 0, tax, tot, 'Credit', CURRENT_DATE + 2, '23 Station Rd, Negombo', false, now() - interval '1 day')
  RETURNING id INTO o_id;

  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 5, p.selling_price, 5*p.selling_price FROM public.products p WHERE p.sku='GR-002';

  INSERT INTO public.invoices (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, payment_method, created_at)
  VALUES (gen_random_uuid(), 'INV-1004', o_id, (SELECT id FROM public.customers WHERE name='Kumara Stores'), sub, 0, tax, tot, 1000.00, tot-1000.00, 'partial', 'Credit', now() - interval '1 day');

  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT (SELECT id FROM public.invoices WHERE invoice_number='INV-1004'), p.id, p.name, 5, p.selling_price, 5*p.selling_price FROM public.products p WHERE p.sku='GR-002';

  -- Order 5: City Bakers - packed, unpaid
  SELECT id INTO o_id FROM public.customers WHERE name='City Bakers';
  sub := 2100.00; tax := 168.00; tot := sub + tax;
  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal, discount_amount, tax_amount, total, payment_method, delivery_date, delivery_address, is_pos, created_at)
  VALUES (gen_random_uuid(), 'ORD-1005', o_id, 'packed', sub, 0, tax, tot, 'Credit', CURRENT_DATE, '10 Hill St, Dehiwala', false, now() - interval '5 hours')
  RETURNING id INTO o_id;

  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 10, p.selling_price, 10*p.selling_price FROM public.products p WHERE p.sku='GR-002';

  INSERT INTO public.invoices (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, payment_method, created_at)
  VALUES (gen_random_uuid(), 'INV-1005', o_id, (SELECT id FROM public.customers WHERE name='City Bakers'), sub, 0, tax, tot, 0, tot, 'unpaid', 'Credit', now() - interval '5 hours');

  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT (SELECT id FROM public.invoices WHERE invoice_number='INV-1005'), p.id, p.name, 10, p.selling_price, 10*p.selling_price FROM public.products p WHERE p.sku='GR-002';

  -- Order 6: POS walk-in today, paid cash
  sub := 480.00; tax := 38.40; tot := sub + tax;
  INSERT INTO public.orders (id, order_number, customer_id, status, subtotal, discount_amount, tax_amount, total, payment_method, is_pos, created_at)
  VALUES (gen_random_uuid(), 'ORD-1006', NULL, 'delivered', sub, 0, tax, tot, 'Cash', true, now() - interval '2 hours')
  RETURNING id INTO o_id;

  INSERT INTO public.order_items (order_id, product_id, name, quantity, unit_price, line_total)
  SELECT o_id, p.id, p.name, 1, p.selling_price, 1*p.selling_price FROM public.products p WHERE p.sku='FF-002';

  INSERT INTO public.invoices (id, invoice_number, order_id, customer_id, subtotal, discount_amount, tax_amount, total, paid_amount, balance, payment_status, payment_method, created_at)
  VALUES (gen_random_uuid(), 'INV-1006', o_id, NULL, sub, 0, tax, tot, tot, 0, 'paid', 'Cash', now() - interval '2 hours')
  RETURNING id INTO inv_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, name, quantity, unit_price, line_total)
  SELECT inv_id, p.id, p.name, 1, p.selling_price, 1*p.selling_price FROM public.products p WHERE p.sku='FF-002';

  INSERT INTO public.payments (invoice_id, customer_id, amount, method, created_at)
  VALUES (inv_id, NULL, tot, 'Cash', now() - interval '2 hours');
END $$;
