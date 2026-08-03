import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Modal, ScrollView } from 'react-native';
import { Search, ReceiptText, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { formatDate, formatLKR, paymentStatusColor, paymentStatusLabel } from '@/lib/format';
import type { Invoice, InvoiceItem } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Badge, Button, Card, Empty, ErrorBox, Screen, ScreenScroll } from '@/components/ui';
import { printInvoice } from '@/lib/printInvoice';

type DateFilter = 'today' | '7days' | '30days' | 'all';
type Sale = Invoice & { customer?: { name: string } | null };

export default function SalesScreen() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState<DateFilter>('today');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<(Invoice & { customer?: { name: string; phone: string | null } | null; invoice_items?: InvoiceItem[] }) | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [printerMessage, setPrinterMessage] = useState<string | null>(null);

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

  const openInvoice = async (sale: Sale) => {
    setInvoiceLoading(true);
    setPrinterMessage(null);
    const { data, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, customer:customers(name, phone), invoice_items(*)')
      .eq('id', sale.id)
      .single();
    setInvoiceLoading(false);
    if (invoiceError || !data) { setError('Could not open this invoice.'); return; }
    setSelected(data as unknown as typeof selected);
  };

  const handlePrint = () => {
    if (!selected) return;
    setPrinterMessage(null);
    if (!printInvoice(selected)) setPrinterMessage('Your browser blocked the invoice window. Allow pop-ups for this app, then tap Print Invoice again.');
  };

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
        {filtered.length === 0 ? <Empty title="No sales found" subtitle="Completed invoices will appear here." /> : <View style={{ gap: 8 }}>{filtered.map((sale) => <Card key={sale.id} onPress={() => openInvoice(sale)} style={styles.sale}><View style={{ flex: 1 }}><Text style={styles.invoice}>{sale.invoice_number}</Text><Text style={styles.customer}>{sale.customer?.name ?? 'Walk-in customer'} · {formatDate(sale.created_at)}</Text><Badge label={paymentStatusLabel[sale.payment_status]} color={paymentStatusColor[sale.payment_status]} /></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.amount}>{formatLKR(sale.total)}</Text><Text style={styles.balance}>{sale.balance > 0 ? `Balance ${formatLKR(sale.balance)}` : 'Paid in full'}</Text></View></Card>)}</View>}
      </ScreenScroll>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        {selected && <View style={styles.modalOverlay}><Card style={styles.invoiceCard}>
          <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>{selected.invoice_number}</Text><Text style={styles.modalSub}>{formatDate(selected.created_at)}</Text></View><Pressable onPress={() => setSelected(null)}><X size={22} color={theme.colors.text} /></Pressable></View>
          <Text style={styles.billTo}>{selected.customer?.name ?? 'Walk-in customer'}</Text>
          {selected.customer?.phone && <Text style={styles.modalSub}>{selected.customer.phone}</Text>}
          <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingTop: 14 }}>
            {(selected.invoice_items ?? []).map((item) => <View key={item.id} style={styles.itemRow}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.modalSub}>{item.quantity} × {formatLKR(item.unit_price)}</Text></View><Text style={styles.itemTotal}>{formatLKR(item.line_total)}</Text></View>)}
            <View style={styles.totals}><Total label="Subtotal" value={formatLKR(selected.subtotal)} />{selected.discount_amount > 0 && <Total label="Discount" value={`- ${formatLKR(selected.discount_amount)}`} />}<Total label="Tax" value={formatLKR(selected.tax_amount)} /><View style={styles.grand}><Text style={styles.grandText}>Total</Text><Text style={styles.grandText}>{formatLKR(selected.total)}</Text></View><Total label="Paid" value={formatLKR(selected.paid_amount)} /><Total label="Balance" value={formatLKR(selected.balance)} /></View>
          </ScrollView>
          <Button title="Print Invoice" onPress={handlePrint} fullWidth style={{ marginTop: 14 }} />
          {printerMessage && <Text style={styles.printerMessage}>{printerMessage}</Text>}
        </Card></View>}
      </Modal>
    </Screen>
  );
}

function Total({ label, value }: { label: string; value: string }) { return <View style={styles.totalRow}><Text style={styles.totalLabel}>{label}</Text><Text style={styles.totalValue}>{value}</Text></View>; }

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }, invoiceCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '90%' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text }, modalSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 3 }, billTo: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 14 }, itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border }, itemName: { fontSize: 14, fontWeight: '600', color: theme.colors.text }, itemTotal: { fontSize: 14, fontWeight: '700', color: theme.colors.text }, totals: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: theme.colors.neutral[50] }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }, totalLabel: { color: theme.colors.textMuted, fontSize: 14 }, totalValue: { color: theme.colors.text, fontSize: 14, fontWeight: '600' }, grand: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 7, paddingTop: 8 }, grandText: { color: theme.colors.primary[700], fontSize: 17, fontWeight: '800' }, printerMessage: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: theme.colors.primary[50], color: theme.colors.primary[800], fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
