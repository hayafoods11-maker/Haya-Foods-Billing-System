import { type Role, type OrderStatus, type PaymentStatus, type DeliveryStatus } from './types';

export const formatLKR = (amount: number): string => {
  return `Rs ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatNumber = (n: number): string => n.toLocaleString('en-LK');

export const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export const roleLabel: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  sales_rep: 'Sales Rep',
  delivery: 'Delivery Staff',
};

export const roleColor: Record<Role, string> = {
  admin: '#7c3aed',
  manager: '#2563eb',
  cashier: '#059669',
  sales_rep: '#d97706',
  delivery: '#dc2626',
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const orderStatusColor: Record<OrderStatus, string> = {
  draft: '#64748b',
  pending: '#f59e0b',
  confirmed: '#2563eb',
  packed: '#7c3aed',
  out_for_delivery: '#0891b2',
  delivered: '#059669',
  cancelled: '#dc2626',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

export const paymentStatusColor: Record<PaymentStatus, string> = {
  unpaid: '#dc2626',
  partial: '#f59e0b',
  paid: '#059669',
};

export const deliveryStatusLabel: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed: 'Failed',
};

export const deliveryStatusColor: Record<DeliveryStatus, string> = {
  pending: '#f59e0b',
  out_for_delivery: '#0891b2',
  delivered: '#059669',
  failed: '#dc2626',
};
