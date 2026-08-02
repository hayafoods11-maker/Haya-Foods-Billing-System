import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { Search, Download, TrendingUp, Package, Wallet, Users, Truck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { formatLKR, formatNumber, formatDate } from '@/lib/format';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Stat, Empty, ErrorBox, Badge } from '@/components/ui';
import type { Invoice, Order, Product } from '@/lib/types';

type Range = 'today' | 'week' | 'month';

export default function ReportsScreen() {
  const [range, setRange] = useState<Range>('week');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (range === 'today') return d;
    if (range === 'week') { d.setDate(d.getDate() - 7); return d; }
    d.setMonth(d.getMonth() - 1); return d;
  }, [range]);

  const load = useCallback(async () => {
    setError(null);
    const [invRes, ordRes, prodRes] = await Promise.all([
      supabase.from('invoices').select('*').gte('created_at', rangeStart.toISOString()).order('created_at', { ascending: false }),
      supabase.from('orders').select('*').gte('created_at', rangeStart.toISOString()),
      supabase.from('products').select('*').order('stock', { ascending: true }),
    ]);
    if (invRes.error || ordRes.error || prodRes.error) { setError('Could not load report data.'); setRefreshing(false); return; }
    setInvoices((invRes.data as Invoice[]) ?? []);
    setOrders((ordRes.data as Order[]) ?? []);
    setProducts((prodRes.data as Product[]) ?? []);
    setRefreshing(false);
  }, [rangeStart]);

  useEffect(() => { load(); }, [load]);

  const totalSales = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid_amount), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.balance), 0);
  const lowStock = products.filter((p) => p.stock <= p.reorder_level);
  const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;

  // simple bar chart data: sales by day
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      const key = new Date(i.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      map.set(key, (map.get(key) ?? 0) + Number(i.total));
    });
    return Array.from(map.entries()).slice(-7).reverse();
  }, [invoices]);
  const maxDay = Math.max(1, ...byDay.map(([, v]) => v));

  // top products by revenue (from invoice items via orders is complex; approximate from orders not available — use invoice totals count)
  // We'll compute a simple "low stock" list and "payment collection" summary instead.

  const exportCSV = () => {
    const rows = [['Invoice', 'Date', 'Customer', 'Total', 'Paid', 'Balance', 'Status']];
    invoices.forEach((i) => rows.push([i.invoice_number, formatDate(i.created_at), '—', String(i.total), String(i.paid_amount), String(i.balance), i.payment_status]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    // On web, trigger a download; on native, we just show a toast-like alert via state.
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `haya-report-${range}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Screen>
      <BrandHeader subtitle="Reports & Analytics" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8, paddingTop: 8 }}>
        {(['today', 'week', 'month'] as Range[]).map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={[styles.chip, range === r && styles.chipActive]}>
            <Text style={[styles.chipText, range === r && styles.chipTextActive]}>{r === 'today' ? 'Today' : r === 'week' ? '7 Days' : '30 Days'}</Text>
          </Pressable>
        ))}
        <Pressable onPress={exportCSV} style={[styles.chip, { backgroundColor: theme.colors.gold[500], borderColor: theme.colors.gold[500] }]}>
          <Text style={[styles.chipText, { color: theme.colors.white }]}>Export CSV</Text>
        </Pressable>
      </ScrollView>

      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentContainerStyle={{ paddingTop: 4 }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}

        <View style={styles.statsRow}>
          <Stat label="Total Sales" value={formatLKR(totalSales)} tint={theme.colors.primary[700]} icon={<TrendingUp size={18} color={theme.colors.primary[700]} />} />
          <Stat label="Collected" value={formatLKR(totalPaid)} tint={theme.colors.success} icon={<Wallet size={18} color={theme.colors.success} />} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Outstanding" value={formatLKR(totalOutstanding)} tint={theme.colors.warning} icon={<Users size={18} color={theme.colors.warning} />} />
          <Stat label="Delivered Orders" value={formatNumber(deliveredOrders)} tint={theme.colors.info} icon={<Truck size={18} color={theme.colors.info} />} />
        </View>

        <View style={{ marginTop: 16 }}>
          <Card>
            <Text style={styles.chartTitle}>Sales Trend</Text>
            {byDay.length === 0 ? (
              <Text style={styles.emptyText}>No sales in this period.</Text>
            ) : (
              <View style={{ gap: 8, marginTop: 12 }}>
                {byDay.map(([label, val]) => (
                  <View key={label} style={styles.barRow}>
                    <Text style={styles.barLabel}>{label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(6, (val / maxDay) * 100)}%` }]} />
                    </View>
                    <Text style={styles.barValue}>{formatLKR(val)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>

        <View style={{ marginTop: 16 }}>
          <Card>
            <Text style={styles.chartTitle}>Low Stock Report</Text>
            {lowStock.length === 0 ? (
              <Text style={styles.emptyText}>All products above reorder level.</Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {lowStock.map((p, i) => (
                  <View key={p.id} style={[styles.reportRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportName}>{p.name}</Text>
                      <Text style={styles.reportSub}>{p.sku} · {formatLKR(p.selling_price)}</Text>
                    </View>
                    <Badge label={`${p.stock} left`} color={p.stock <= p.reorder_level ? '#dc2626' : '#f59e0b'} />
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>

        <View style={{ marginTop: 16 }}>
          <Card>
            <Text style={styles.chartTitle}>Recent Invoices</Text>
            {invoices.length === 0 ? (
              <Text style={styles.emptyText}>No invoices in this period.</Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {invoices.slice(0, 10).map((inv) => (
                  <View key={inv.id} style={[styles.reportRow, { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportName}>{inv.invoice_number}</Text>
                      <Text style={styles.reportSub}>{formatDate(inv.created_at)}</Text>
                    </View>
                    <Text style={styles.reportAmount}>{formatLKR(inv.total)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
        <View style={{ height: 24 }} />
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: theme.colors.white },
  statsRow: { flexDirection: 'row', gap: 12 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { fontSize: 12, color: theme.colors.textMuted, width: 52 },
  barTrack: { flex: 1, height: 24, backgroundColor: theme.colors.neutral[100], borderRadius: 8, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: theme.colors.primary[600], borderRadius: 8 },
  barValue: { fontSize: 12, fontWeight: '600', color: theme.colors.text, width: 96, textAlign: 'right' },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  reportName: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  reportSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  reportAmount: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
});
