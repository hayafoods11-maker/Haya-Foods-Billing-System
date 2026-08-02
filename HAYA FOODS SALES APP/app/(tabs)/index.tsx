import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  Wallet,
  ShoppingBag,
  Truck,
  AlertTriangle,
  FileText,
  TrendingUp,
  ChevronRight,
  Plus,
  LogOut,
  Package,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR, formatNumber, formatDate, orderStatusLabel, orderStatusColor, paymentStatusColor, paymentStatusLabel } from '@/lib/format';
import type { Invoice, Order, Product } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Stat, SectionTitle, Empty, ErrorBox } from '@/components/ui';

export default function Dashboard() {
  const { staff, signOut } = useAuth();
  const [todaySales, setTodaySales] = useState(0);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [unpaid, setUnpaid] = useState<Invoice[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [salesRes, ordersRes, productsRes, invoicesRes, delRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('total, created_at')
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('orders')
        .select('id, order_number, status, total, customer:customers(name), created_at')
        .in('status', ['pending', 'confirmed', 'packed', 'out_for_delivery'])
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('products').select('*').lt('stock', 12).order('stock', { ascending: true }).limit(6),
      supabase
        .from('invoices')
        .select('id, invoice_number, total, paid_amount, balance, payment_status, customer:customers(name), created_at')
        .in('payment_status', ['unpaid', 'partial'])
        .order('created_at', { ascending: false })
        .limit(6),
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).in('status', ['pending', 'out_for_delivery']),
    ]);

    if (salesRes.error || ordersRes.error || productsRes.error || invoicesRes.error || delRes.error) {
      setError('Could not load dashboard data. Pull to refresh.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const sales = (salesRes.data as { total: number }[]).reduce((s, i) => s + Number(i.total), 0);
    setTodaySales(sales);
    setPendingOrders((ordersRes.data as unknown as Order[]) ?? []);
    setLowStock((productsRes.data as Product[]) ?? []);
    setUnpaid((invoicesRes.data as unknown as Invoice[]) ?? []);
    setActiveDeliveries(delRes.count ?? 0);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isDeliveryOnly = staff?.role === 'delivery';
  const isSales = staff?.role === 'sales_rep';

  return (
    <Screen>
      <BrandHeader subtitle={`Welcome, ${staff?.full_name ?? ''}`} />
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {error && <View style={{ marginBottom: 12 }}><ErrorBox message={error} /></View>}

        <View style={styles.statsRow}>
          <Stat label="Sales Today" value={formatLKR(todaySales)} tint={theme.colors.primary[700]} icon={<Wallet size={18} color={theme.colors.primary[700]} />} />
          <Stat label="Active Deliveries" value={formatNumber(activeDeliveries)} tint={theme.colors.info} icon={<Truck size={18} color={theme.colors.info} />} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Pending Orders" value={formatNumber(pendingOrders.length)} tint={theme.colors.warning} icon={<ShoppingBag size={18} color={theme.colors.warning} />} />
          <Stat label="Low Stock Items" value={formatNumber(lowStock.length)} tint={theme.colors.error} icon={<AlertTriangle size={18} color={theme.colors.error} />} />
        </View>

        {!isDeliveryOnly && !isSales && (
          <View style={{ marginTop: 16 }}>
            <SectionTitle action={<QuickPOS />}>Quick Actions</SectionTitle>
            <View style={styles.quickRow}>
              <QuickAction label="New Bill" icon={<Plus size={20} color={theme.colors.white} />} onPress={() => router.push('/pos')} tint={theme.colors.primary[700]} />
              <QuickAction label="Orders" icon={<ShoppingBag size={20} color={theme.colors.white} />} onPress={() => router.push('/orders')} tint={theme.colors.info} />
              <QuickAction label="Customers" icon={<TrendingUp size={20} color={theme.colors.white} />} onPress={() => router.push('/customers')} tint={theme.colors.gold[500]} />
              <QuickAction label="Reports" icon={<FileText size={20} color={theme.colors.white} />} onPress={() => router.push('/reports')} tint={theme.colors.neutral[700]} />
              {(staff?.role === 'admin' || staff?.role === 'manager') && (
                <QuickAction label="Inventory" icon={<Package size={20} color={theme.colors.white} />} onPress={() => router.push('/inventory')} tint={theme.colors.success} />
              )}
            </View>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <SectionTitle action={<ChevronLink onPress={() => router.push('/orders')} />}>Pending Orders</SectionTitle>
          {pendingOrders.length === 0 ? (
            <Empty title="No pending orders" subtitle="All caught up." />
          ) : (
            <View style={{ gap: 8 }}>
              {pendingOrders.slice(0, 4).map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </View>
          )}
        </View>

        <View style={{ marginTop: 16 }}>
          <SectionTitle action={<ChevronLink onPress={() => router.push('/products')} />}>Low Stock Alerts</SectionTitle>
          {lowStock.length === 0 ? (
            <Empty title="Stock levels healthy" subtitle="No products below reorder level." />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {lowStock.map((p, i) => (
                <View key={p.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{p.name}</Text>
                    <Text style={styles.rowSub}>{p.sku}</Text>
                  </View>
                  <View style={[styles.stockChip, { backgroundColor: (p.stock <= p.reorder_level ? theme.colors.error : theme.colors.warning) + '1a' }]}>
                    <Text style={[styles.stockText, { color: p.stock <= p.reorder_level ? theme.colors.error : theme.colors.warning }]}>{p.stock} left</Text>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>

        {!isDeliveryOnly && (
          <View style={{ marginTop: 16 }}>
            <SectionTitle action={<ChevronLink onPress={() => router.push('/invoices')} />}>Unpaid Invoices</SectionTitle>
            {unpaid.length === 0 ? (
              <Empty title="No unpaid invoices" subtitle="All invoices settled." />
            ) : (
              <View style={{ gap: 8 }}>
                {unpaid.slice(0, 4).map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </View>
            )}
          </View>
        )}

        <Pressable onPress={signOut} style={styles.signOut}>
          <LogOut size={18} color={theme.colors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <View style={{ height: 24 }} />
      </ScreenScroll>
    </Screen>
  );
}

function QuickPOS() {
  return (
    <Pressable onPress={() => router.push('/pos')} style={styles.qpos}>
      <Text style={styles.qposText}>Open POS</Text>
    </Pressable>
  );
}

function QuickAction({ label, icon, onPress, tint }: { label: string; icon: React.ReactNode; onPress: () => void; tint: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.qa, { backgroundColor: tint }, pressed && { opacity: 0.85 }]}>
      {icon}
      <Text style={styles.qaLabel}>{label}</Text>
    </Pressable>
  );
}

function ChevronLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <ChevronRight size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function OrderRow({ order }: { order: Order & { customer?: { name: string } | null } }) {
  return (
    <Card style={{ padding: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{order.order_number}</Text>
          <Text style={styles.rowSub}>{order.customer?.name ?? 'Walk-in'} · {formatDate(order.created_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={styles.rowAmount}>{formatLKR(order.total)}</Text>
          <View style={{ backgroundColor: (orderStatusColor[order.status] ?? '#64748b') + '1a', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: orderStatusColor[order.status] ?? '#64748b', fontSize: 11, fontWeight: '600' }}>{orderStatusLabel[order.status]}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice & { customer?: { name: string } | null } }) {
  return (
    <Card style={{ padding: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{invoice.invoice_number}</Text>
          <Text style={styles.rowSub}>{invoice.customer?.name ?? 'Walk-in'} · {formatDate(invoice.created_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={styles.rowAmount}>{formatLKR(invoice.balance)}</Text>
          <View style={{ backgroundColor: (paymentStatusColor[invoice.payment_status] ?? '#64748b') + '1a', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: paymentStatusColor[invoice.payment_status] ?? '#64748b', fontSize: 11, fontWeight: '600' }}>{paymentStatusLabel[invoice.payment_status]}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qa: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  qaLabel: { color: theme.colors.white, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  qpos: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.colors.primary[50], borderRadius: 999 },
  qposText: { color: theme.colors.primary[700], fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  rowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  stockChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stockText: { fontSize: 12, fontWeight: '700' },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, paddingVertical: 14, borderRadius: 12, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  signOutText: { color: theme.colors.error, fontSize: 15, fontWeight: '600' },
});
