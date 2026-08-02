import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { Search, X, Download, Eye, Wallet } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR, formatDate, formatDateTime, paymentStatusLabel, paymentStatusColor } from '@/lib/format';
import type { Invoice, InvoiceItem, Payment, PaymentMethod } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Button, Empty, ErrorBox, Badge } from '@/components/ui';

export default function InvoicesScreen() {
  const { staff } = useAuth();
  const [invoices, setInvoices] = useState<(Invoice & { customer?: { name: string } | null })[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<(Invoice & { customer?: { name: string; phone: string | null } | null; invoice_items?: InvoiceItem[]; payments?: Payment[] }) | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');

  const canRecordPayment = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'cashier';

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customer:customers(name, phone), invoice_items, payments')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) { setError('Could not load invoices.'); setRefreshing(false); return; }
    setInvoices((data as unknown as typeof invoices) ?? []);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.payment_status !== statusFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return inv.invoice_number.toLowerCase().includes(q) || (inv.customer?.name ?? '').toLowerCase().includes(q);
    });
  }, [invoices, query, statusFilter]);

  const recordPayment = async () => {
    if (!selected) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return;
    const newPaid = Number(selected.paid_amount) + amt;
    const newBal = Math.max(0, Number(selected.balance) - amt);
    const status = newBal <= 0.01 ? 'paid' : 'partial';
    const { error } = await supabase
      .from('invoices')
      .update({ paid_amount: newPaid, balance: newBal, payment_status: status })
      .eq('id', selected.id);
    if (error) { setError('Could not record payment.'); return; }
    await supabase.from('payments').insert({ invoice_id: selected.id, customer_id: selected.customer_id, amount: amt, method: payMethod, received_by: staff?.id ?? null });
    if (selected.customer_id) {
      const { data: cust } = await supabase.from('customers').select('outstanding_balance').eq('id', selected.customer_id).maybeSingle();
      if (cust) {
        await supabase.from('customers').update({ outstanding_balance: Math.max(0, Number(cust.outstanding_balance) - amt) }).eq('id', selected.customer_id);
      }
    }
    setShowPay(false);
    setPayAmount('');
    setSelected(null);
    load();
  };

  const exportInvoice = (inv: typeof selected) => {
    if (!inv) return;
    const lines = [
      `Haya Foods`,
      `Invoice ${inv.invoice_number}`,
      `Date: ${formatDate(inv.created_at)}`,
      `Customer: ${inv.customer?.name ?? 'Walk-in'}`,
      ``,
      `Item,Qty,Price,Total`,
      ...(inv.invoice_items ?? []).map((it) => `${it.name},${it.quantity},${it.unit_price},${it.line_total}`),
      ``,
      `Subtotal,${inv.subtotal}`,
      `Discount,${inv.discount_amount}`,
      `Tax,${inv.tax_amount}`,
      `Total,${inv.total}`,
      `Paid,${inv.paid_amount}`,
      `Balance,${inv.balance}`,
    ];
    const csv = lines.join('\n');
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${inv.invoice_number}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Screen>
      <BrandHeader subtitle="Invoices" />
      <View style={styles.searchWrap}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput style={styles.search} placeholder="Search invoice or customer…" value={query} onChangeText={setQuery} placeholderTextColor={theme.colors.textMuted} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
        {(['all', 'unpaid', 'partial', 'paid'] as const).map((s) => (
          <Pressable key={s} onPress={() => setStatusFilter(s)} style={[styles.chip, statusFilter === s && styles.chipActive]}>
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s === 'all' ? 'All' : paymentStatusLabel[s]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentContainerStyle={{ paddingTop: 4 }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}
        {filtered.length === 0 ? (
          <Empty title="No invoices" subtitle="Invoices from sales will appear here." />
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map((inv) => (
              <Card key={inv.id} onPress={() => setSelected(inv as typeof selected)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invNo}>{inv.invoice_number}</Text>
                    <Text style={styles.invCust}>{inv.customer?.name ?? 'Walk-in'} · {formatDate(inv.created_at)}</Text>
                    <View style={styles.footerRow}>
                      <Badge label={paymentStatusLabel[inv.payment_status]} color={paymentStatusColor[inv.payment_status]} />
                      <Text style={styles.amount}>{formatLKR(inv.total)}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScreenScroll>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={styles.modalOverlay}>
            <Card style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{selected.invoice_number}</Text>
                <Pressable onPress={() => setSelected(null)}><X size={22} color={theme.colors.text} /></Pressable>
              </View>
              <Badge label={paymentStatusLabel[selected.payment_status]} color={paymentStatusColor[selected.payment_status]} />
              <Text style={styles.detailCust}>{selected.customer?.name ?? 'Walk-in customer'}</Text>
              <Text style={styles.detailDate}>{formatDateTime(selected.created_at)}</Text>

              <Text style={styles.itemsTitle}>Items</Text>
              {(selected.invoice_items ?? []).map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemQty}>{it.quantity} × {formatLKR(it.unit_price)}</Text>
                  <Text style={styles.itemTotal}>{formatLKR(it.line_total)}</Text>
                </View>
              ))}

              <View style={styles.totalBlock}>
                <Row label="Subtotal" value={formatLKR(selected.subtotal)} />
                {selected.discount_amount > 0 && <Row label="Discount" value={`- ${formatLKR(selected.discount_amount)}`} />}
                <Row label="Tax" value={formatLKR(selected.tax_amount)} />
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>Total</Text>
                  <Text style={styles.grandValue}>{formatLKR(selected.total)}</Text>
                </View>
                <Row label="Paid" value={formatLKR(selected.paid_amount)} />
                <Row label="Balance" value={formatLKR(selected.balance)} />
              </View>

              <View style={styles.actionRow}>
                <Button title="Export" variant="outline" onPress={() => exportInvoice(selected)} style={{ flex: 1 }} />
                {canRecordPayment && selected.payment_status !== 'paid' && (
                  <Button title="Record Payment" variant="gold" onPress={() => setShowPay(true)} style={{ flex: 1 }} />
                )}
              </View>
            </Card>
          </View>
        )}
      </Modal>

      <Modal visible={showPay} animationType="fade" transparent onRequestClose={() => setShowPay(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.payCard}>
            <Text style={styles.payTitle}>Record Payment</Text>
            <Text style={styles.payCaption}>Balance: {formatLKR(selected?.balance ?? 0)}</Text>
            <Text style={styles.fieldLabel}>Amount (LKR)</Text>
            <TextInput style={styles.input} value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.colors.textMuted} />
            <Text style={styles.fieldLabel}>Method</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Cash', 'Card', 'Bank Transfer'] as PaymentMethod[]).map((m) => (
                <Pressable key={m} onPress={() => setPayMethod(m)} style={[styles.methodChip, payMethod === m && styles.methodChipActive]}>
                  <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <Button title="Save Payment" onPress={recordPayment} fullWidth style={{ marginTop: 14 }} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 14, color: theme.colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, margin: 12, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: theme.colors.white },
  invNo: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  invCust: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  amount: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '90%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  detailCust: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginTop: 12 },
  detailDate: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  itemsTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 16, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  itemName: { flex: 1, fontSize: 14, color: theme.colors.text },
  itemQty: { fontSize: 13, color: theme.colors.textMuted, marginRight: 12 },
  itemTotal: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  totalBlock: { marginTop: 14, backgroundColor: theme.colors.neutral[50], borderRadius: 12, padding: 12 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 6, paddingTop: 8 },
  grandLabel: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  grandValue: { fontSize: 17, fontWeight: '800', color: theme.colors.primary[700] },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  payCard: { borderRadius: 20, padding: 20, paddingBottom: 28 },
  payTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  payCaption: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.neutral[50] },
  methodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  methodChipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  methodText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  methodTextActive: { color: theme.colors.white },
});
