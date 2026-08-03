import type { Role } from './types';

export const ROLE_TABS: Record<Role, { name: string; label: string; icon: string }[]> = {
  admin: [
    { name: 'index', label: 'Dashboard', icon: 'LayoutDashboard' },
    { name: 'pos', label: 'POS', icon: 'ScanLine' },
    { name: 'sales', label: 'Sales', icon: 'ReceiptText' },
    { name: 'products', label: 'Products', icon: 'Package' },
    { name: 'more', label: 'More', icon: 'Menu' },
  ],
  manager: [
    { name: 'index', label: 'Dashboard', icon: 'LayoutDashboard' },
    { name: 'pos', label: 'POS', icon: 'ScanLine' },
    { name: 'sales', label: 'Sales', icon: 'ReceiptText' },
    { name: 'products', label: 'Products', icon: 'Package' },
    { name: 'more', label: 'More', icon: 'Menu' },
  ],
  cashier: [
    { name: 'index', label: 'Dashboard', icon: 'LayoutDashboard' },
    { name: 'pos', label: 'POS', icon: 'ScanLine' },
    { name: 'sales', label: 'Sales', icon: 'ReceiptText' },
    { name: 'customers', label: 'Customers', icon: 'Users' },
    { name: 'invoices', label: 'Invoices', icon: 'ReceiptText' },
  ],
  sales_rep: [
    { name: 'index', label: 'Dashboard', icon: 'LayoutDashboard' },
    { name: 'sales', label: 'Sales', icon: 'ReceiptText' },
    { name: 'customers', label: 'Customers', icon: 'Users' },
  ],
  delivery: [
    { name: 'index', label: 'Dashboard', icon: 'LayoutDashboard' },
    { name: 'deliveries', label: 'Deliveries', icon: 'Truck' },
  ],
};
