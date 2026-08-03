import type { Role } from './types';

export const ROLE_TABS: Record<Role, { name: string; label: string; icon: string }[]> = {
  admin: [
    { name: 'index', label: 'Dashboard', icon: 'LayoutDashboard' },
    { name: 'pos', label: 'POS', icon: 'ScanLine' },
    { name: 'sales', label: 'Sales', icon: 'ReceiptText' },
    { name: 'products', label: 'Products', icon: 'Package' },
    { name: 'inventory', label: 'Inventory', icon: 'Archive' },
    { name: 'customers', label: 'Customers', icon: 'Users' },
    { name: 'deliveries', label: 'Deliveries', icon: 'Truck' },
    { name: 'reports', label: 'Reports', icon: 'BarChart3' },
    { name: 'settings', label: 'Settings', icon: 'Settings' },
  ],
  manager: [
    { name: 'index', label: 'Dashboard', icon: 'LayoutDashboard' },
    { name: 'pos', label: 'POS', icon: 'ScanLine' },
    { name: 'sales', label: 'Sales', icon: 'ReceiptText' },
    { name: 'products', label: 'Products', icon: 'Package' },
    { name: 'inventory', label: 'Inventory', icon: 'Archive' },
    { name: 'customers', label: 'Customers', icon: 'Users' },
    { name: 'deliveries', label: 'Deliveries', icon: 'Truck' },
    { name: 'reports', label: 'Reports', icon: 'BarChart3' },
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
