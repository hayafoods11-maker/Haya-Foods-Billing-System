import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Search, ReceiptText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { formatDate, formatLKR, paymentStatusColor, paymentStatusLabel } from '@/lib/format';
import type { Invoice } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Badge, Card, Empty, ErrorBox, Screen, ScreenScroll } from '@/components/ui';

type DateFilter = 'today' | '7days' | '30days' | 'all';
type Sale = Invoice & { customer?: { name: string } | null };

export default function SalesScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState<DateFilter>('today');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: loadError } = await supabase
      .from('invoices')
      .select('*, customer:customers(name)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (loadError) setError('Could not load sales. Pull to refresh and try again.');
    else setSales((data as unknown as Sale[]) ?? []);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (filter === 'today') start.setHours(0, 0, 0, 0);
    if (filter === '7days') start.setDate(start.getDate() - 6);
    if (filter === '30days') start.setDate(start.getDate() - 29);
    const term = query.trim().toLowerCase();
    return sales.filter((sale) => {
      if (filter !== 'all' && new Date(sale.created_at) < start) return false;
      return !term || sale.invoice_number.toLowerCase().includes(term) || (sale.customer?.name ?? '').toLowerCase().includes(term);
    });
  }, [filter, query, sales]);

  const total = filtered.reduce((sum, sale) => sum + Number(sale.total), 0);

  return (
    <Screen>
      <BrandHeader subtitle="Completed Sales" />
      <View style={styles.searchWrap}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput style={styles.search} placeholder="Search invoice or customer" value={query} onChangeText={setQuery} placeholderTextColor={theme.colors.textMuted} />
      </View>
      <View style={styles.filters}>
        <Filter label="Today" value="today" active={filter} onPress={setFilter} />
        <Filter label="7 Days" value="7days" active={filter} onPress={setFilter} />
        <Filter label="30 Days" value="30days" active={filter} onPress={setFilter} />
        <Filter label="All" value="all" active={filter} onPress={setFilter} />
      </View>
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentContainerStyle={{ paddingTop: 8 }}>
        {error && <View style={{ marginBottom: 10 }}><ErrorBox message={error} /></View>}
        <Card style={styles.summary}><View><Text style={styles.summaryLabel}>Sales total</Text><Text style={styles.summaryValue}>{formatLKR(total)}</Text></View><View style={styles.count}><ReceiptText size={18} color={theme.colors.primary[700]} /><Text style={styles.countText}>{filtered.length} invoices</Text></View></Card>
        <Text style={styles.heading}>All completed sales</Text>
        {filtered.length === 0 ? <Empty title="No sales found" subtitle="Completed invoices will appear here." /> : <View style={{ gap: 8 }}>{filtered.map((sale) => <Card key={sale.id} style={styles.sale}><View style={{ flex: 1 }}><Text style={styles.invoice}>{sale.invoice_number}</Text><Text style={styles.customer}>{sale.customer?.name ?? 'Walk-in customer'} · {formatDate(sale.created_at)}</Text><Badge label={paymentStatusLabel[sale.payment_status]} color={paymentStatusColor[sale.payment_status]} /></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.amount}>{formatLKR(sale.total)}</Text><Text style={styles.balance}>{sale.balance > 0 ? `Balance ${formatLKR(sale.balance)}` : 'Paid in full'}</Text></View></Card>)}</View>}
      </ScreenScroll>
    </Screen>
  );
}

function Filter({ label, value, active, onPress }: { label: string; value: DateFilter; active: DateFilter; onPress: (value: DateFilter) => void }) {
  return <Pressable onPress={() => onPress(value)} style={[styles.chip, active === value && styles.chipActive]}><Text style={[styles.chipText, active === value && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, margin: 12, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted }, chipTextActive: { color: theme.colors.white },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.primary[50] }, summaryLabel: { fontSize: 13, color: theme.colors.textMuted }, summaryValue: { marginTop: 4, fontSize: 24, color: theme.colors.primary[700], fontWeight: '800' },
  count: { alignItems: 'flex-end', gap: 4 }, countText: { fontSize: 12, color: theme.colors.primary[800], fontWeight: '700' }, heading: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 18, marginBottom: 8 },
  sale: { flexDirection: 'row', alignItems: 'center', padding: 14 }, invoice: { color: theme.colors.text, fontSize: 15, fontWeight: '700' }, customer: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3, marginBottom: 8 }, amount: { color: theme.colors.primary[700], fontSize: 15, fontWeight: '800' }, balance: { color: theme.colors.textMuted, fontSize: 11, marginTop: 5 },
});
