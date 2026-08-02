export type Role = 'admin' | 'manager' | 'cashier' | 'sales_rep' | 'delivery';

export type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'Cash' | 'Card' | 'Bank Transfer' | 'Credit';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type DeliveryStatus = 'pending' | 'out_for_delivery' | 'delivered' | 'failed';
export type InventoryTxType =
  | 'purchase'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'sale'
  | 'return'
  | 'wastage';

export interface Staff {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  credit_limit: number;
  outstanding_balance: number;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  address_line: string;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  phone: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  unit: string;
  selling_price: number;
  cost_price: number;
  stock: number;
  reorder_level: number;
  expiry_date: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
}

export interface ProductWithCategory extends Product {
  category?: Pick<Category, 'id' | 'name'> | null;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  type: InventoryTxType;
  quantity: number;
  balance_after: number | null;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  created_by: string | null;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_method: PaymentMethod | null;
  delivery_date: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  notes: string | null;
  is_pos: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderWithRelations extends Order {
  customer?: Pick<Customer, 'id' | 'name' | 'phone'> | null;
  order_items?: OrderItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  customer_id: string | null;
  created_by: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  balance: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceWithRelations extends Invoice {
  customer?: Pick<Customer, 'id' | 'name' | 'phone'> | null;
  invoice_items?: InvoiceItem[];
}

export interface Payment {
  id: string;
  invoice_id: string | null;
  customer_id: string | null;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_id: string | null;
  status: DeliveryStatus;
  customer_name: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface DeliveryWithOrder extends Delivery {
  order?: Pick<Order, 'id' | 'order_number' | 'total' | 'payment_method'> | null;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  address: string | null;
  telephone: string | null;
  email: string | null;
  logo_url: string | null;
  tax_percentage: number;
  invoice_prefix: string;
  invoice_number_start: number;
  currency: string;
  payment_methods: PaymentMethod[];
  notification_settings: Record<string, unknown>;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  staff_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export interface PurchaseEntry {
  id: string;
  supplier_id: string | null;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}
