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
  Users,
  Receipt,
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
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [outstandingPayments, setOutstandingPayments] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<(Invoice & { customer?: { name: string } | null })[]>([]);
  const [bestSellers, setBestSellers] = useState<{ name: string; quantity: number; total: number }[]>([]);
  const [salesTrend, setSalesTrend] = useState<{ label: string; total: number }[]>([]);
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
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const trendStart = new Date(todayStart);
    trendStart.setDate(trendStart.getDate() - 6);

    const [salesRes, monthSalesRes, ordersRes, productsRes, invoicesRes, recentRes, itemsRes, customersRes, delRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('total, created_at')
        .gte('created_at', todayStart.toISOString()),
      supabase.from('invoices').select('total, created_at').gte('created_at', monthStart.toISOString()),
      supabase
        .from('orders')
        .select('id, order_number, status, total, customer:customers(name), created_at')
        .in('status', ['pending', 'confirmed', 'packed', 'out_for_delivery'])
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('products').select('*').eq('active', true).order('stock', { ascending: true }).limit(100),
      supabase
        .from('invoices')
        .select('id, invoice_number, total, paid_amount, balance, payment_status, customer:customers(name), created_at')
        .in('payment_status', ['unpaid', 'partial'])
        .order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, customer:customers(name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('invoice_items').select('name, quantity, line_total'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).in('status', ['pending', 'out_for_delivery']),
    ]);

    if (salesRes.error || monthSalesRes.error || ordersRes.error || productsRes.error || invoicesRes.error || recentRes.error || itemsRes.error || customersRes.error || delRes.error) {
      setError('Could not load dashboard data. Pull to refresh.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const sales = (salesRes.data as { total: number }[]).reduce((s, i) => s + Number(i.total), 0);
    const monthlySales = (monthSalesRes.data as { total: number }[]).reduce((s, i) => s + Number(i.total), 0);
    const totalsByProduct = new Map<string, { quantity: number; total: number }>();
    (itemsRes.data as { name: string; quantity: number; line_total: number }[] ?? []).forEach((item) => {
      const current = totalsByProduct.get(item.name) ?? { quantity: 0, total: 0 };
      totalsByProduct.set(item.name, { quantity: current.quantity + Number(item.quantity), total: current.total + Number(item.line_total) });
    });
    const dayTotals = new Map<string, number>();
    (monthSalesRes.data as { total: number; created_at: string }[]).forEach((item) => {
      const day = new Date(item.created_at).toDateString();
      if (new Date(item.created_at) >= trendStart) dayTotals.set(day, (dayTotals.get(day) ?? 0) + Number(item.total));
    });
    setTodaySales(sales);
    setMonthlyRevenue(monthlySales);
    setOutstandingPayments(((invoicesRes.data as unknown as Pick<Invoice, 'balance'>[]) ?? []).reduce((sum, inv) => sum + Number(inv.balance), 0));
    setTotalCustomers(customersRes.count ?? 0);
    setPendingOrders((ordersRes.data as unknown as Order[]) ?? []);
    setLowStock(((productsRes.data as Product[]) ?? []).filter((product) => product.stock <= product.reorder_level).slice(0, 6));
    setUnpaid((invoicesRes.data as unknown as Invoice[]) ?? []);
    setRecentInvoices((recentRes.data as unknown as typeof recentInvoices) ?? []);
    setBestSellers([...totalsByProduct.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.quantity - a.quantity).slice(0, 5));
    setSalesTrend(Array.from({ length: 7 }, (_, index) => {
      const date = new Date(trendStart); date.setDate(trendStart.getDate() + index);
      return { label: date.toLocaleDateString('en-GB', { weekday: 'short' }), total: dayTotals.get(date.toDateString()) ?? 0 };
    }));
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
          <Stat label="Today's Sales" value={formatLKR(todaySales)} tint={theme.colors.primary[700]} icon={<Wallet size={18} color={theme.colors.primary[700]} />} />
          <Stat label="Monthly Revenue" value={formatLKR(monthlyRevenue)} tint={theme.colors.info} icon={<TrendingUp size={18} color={theme.colors.info} />} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Outstanding" value={formatLKR(outstandingPayments)} tint={theme.colors.warning} icon={<Receipt size={18} color={theme.colors.warning} />} />
          <Stat label="Customers" value={formatNumber(totalCustomers)} tint={theme.colors.primary[700]} icon={<Users size={18} color={theme.colors.primary[700]} />} />
        </View>

        {!isDeliveryOnly && <View style={{ marginTop: 16 }}>
          <SectionTitle>Sales: Last 7 Days</SectionTitle>
          <SalesChart data={salesTrend} />
        </View>}

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

        {!isDeliveryOnly && <View style={{ marginTop: 16 }}>
          <SectionTitle>Best Selling Products</SectionTitle>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {bestSellers.length === 0 ? <Empty title="No sales this month" subtitle="Top products will appear after sales are recorded." /> : bestSellers.map((product, index) => (
              <View key={product.name} style={[styles.row, index > 0 && styles.rowBorder]}>
                <View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{product.name}</Text><Text style={styles.rowSub}>{product.quantity} units sold</Text></View>
                <Text style={styles.rowAmount}>{formatLKR(product.total)}</Text>
              </View>
            ))}
          </Card>
        </View>}

        {!isDeliveryOnly && <View style={{ marginTop: 16 }}>
          <SectionTitle action={<ChevronLink onPress={() => router.push('/invoices')} />}>Recent Invoices</SectionTitle>
          {recentInvoices.length === 0 ? <Empty title="No invoices yet" subtitle="Completed sales will appear here." /> : <View style={{ gap: 8 }}>{recentInvoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />)}</View>}
        </View>}

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

function SalesChart({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((point) => point.total), 1);
  return (
    <Card>
      <View style={styles.chart}>
        {data.map((point) => (
          <View key={point.label} style={styles.barColumn}>
            <Text style={styles.barValue}>{point.total > 0 ? formatLKR(point.total).replace('Rs ', 'Rs ') : ''}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: `${Math.max(6, (point.total / max) * 100)}%` }]} />
            </View>
            <Text style={styles.barLabel}>{point.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.chartCaption}>Daily invoice revenue</Text>
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
  rowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.primary[50], alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankText: { color: theme.colors.primary[700], fontWeight: '700', fontSize: 13 },
  chart: { height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: { width: '70%', height: 105, justifyContent: 'flex-end', borderRadius: 8, backgroundColor: theme.colors.primary[50], overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8, backgroundColor: theme.colors.primary[700] },
  barLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 7 },
  barValue: { fontSize: 9, color: theme.colors.textMuted, marginBottom: 4, textAlign: 'center' },
  chartCaption: { fontSize: 12, color: theme.colors.textMuted, marginTop: 10 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, paddingVertical: 14, borderRadius: 12, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  signOutText: { color: theme.colors.error, fontSize: 15, fontWeight: '600' },
});
