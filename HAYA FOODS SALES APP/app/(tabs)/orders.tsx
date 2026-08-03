import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import { Search, Plus, ChevronRight, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR, formatDate, orderStatusLabel, orderStatusColor, paymentStatusLabel, paymentStatusColor } from '@/lib/format';
import type { Order, OrderItem, OrderStatus, Invoice, InvoiceItem } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Button, Empty, ErrorBox, Badge } from '@/components/ui';
import { printInvoice } from '@/lib/printInvoice';

const STATUS_FLOW: OrderStatus[] = ['draft', 'pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];

export default function OrdersScreen() {
  const { staff } = useAuth();
  const [orders, setOrders] = useState<(Order & { customer?: { name: string } | null })[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<(Order & { customer?: { name: string; phone: string | null } | null; order_items?: OrderItem[] }) | null>(null);
  const [orderInvoice, setOrderInvoice] = useState<(Invoice & { customer?: { name: string; phone: string | null } | null; invoice_items?: InvoiceItem[] }) | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [printerMessage, setPrinterMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    let q = supabase
      .from('orders')
      .select('*, customer:customers(name, phone), order_items')
      .order('created_at', { ascending: false });
    if (staff?.role === 'sales_rep') {
      q = q.eq('created_by', staff.id);
    }
    const { data, error } = await q.limit(60);
    if (error) { setError('Could not load orders.'); setLoading(false); setRefreshing(false); return; }
    setOrders((data as unknown as (Order & { customer?: { name: string } | null })[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [staff?.id, staff?.role]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) {
      setOrderInvoice(null);
      return;
    }
    supabase
      .from('invoices')
      .select('*, customer:customers(name, phone), invoice_items')
      .eq('order_id', selected.id)
      .maybeSingle()
      .then(({ data }) => setOrderInvoice(data as typeof orderInvoice));
  }, [selected]);

  const filtered = orders.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false;
    const s = query.trim().toLowerCase();
    if (!s) return true;
    return o.order_number.toLowerCase().includes(s) || (o.customer?.name ?? '').toLowerCase().includes(s);
  });

  const advanceStatus = async (order: Order, dir: 1 | -1) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    const next = STATUS_FLOW[Math.min(Math.max(idx + dir, 0), STATUS_FLOW.length - 1)];
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id);
    if (error) { setError('Could not update status.'); return; }
    setSelected(null);
    load();
  };

  const createInvoiceForOrder = async () => {
    if (!selected) return;
    setCreatingInvoice(true);
    setError(null);
    try {
      const { data: settings } = await supabase.from('company_settings').select('invoice_prefix').eq('id', 1).maybeSingle();
      const invoiceNumber = `${settings?.invoice_prefix ?? 'INV'}-${Date.now().toString().slice(-6)}`;
      const isCredit = selected.payment_method === 'Credit';
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          order_id: selected.id,
          customer_id: selected.customer_id,
          created_by: staff?.id ?? null,
          subtotal: selected.subtotal,
          discount_amount: selected.discount_amount,
          tax_amount: selected.tax_amount,
          total: selected.total,
          paid_amount: isCredit ? 0 : selected.total,
          balance: isCredit ? selected.total : 0,
          payment_status: isCredit ? 'unpaid' : 'paid',
          payment_method: selected.payment_method,
          notes: selected.notes,
        })
        .select('*, customer:customers(name, phone)')
        .single();
      if (invoiceError || !invoice) throw invoiceError ?? new Error('Could not create invoice.');

      const items = (selected.order_items ?? []).map((item) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        line_total: item.line_total,
      }));
      if (items.length) {
        const { error: itemsError } = await supabase.from('invoice_items').insert(items);
        if (itemsError) throw itemsError;
      }
      setOrderInvoice({ ...(invoice as Invoice), invoice_items: items as InvoiceItem[] });
    } catch {
      setError('Could not create an invoice for this order.');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handlePrint = (invoice: NonNullable<typeof orderInvoice>) => {
    setPrinterMessage(null);
    if (!printInvoice(invoice)) {
      setPrinterMessage('Your browser blocked the invoice window. Allow pop-ups for this app, then tap Print Invoice again.');
    }
  };

  const canManage = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'cashier' || staff?.role === 'sales_rep';

  return (
    <Screen>
      <BrandHeader subtitle="Sales Orders" />
      <View style={styles.searchWrap}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput style={styles.search} placeholder="Search order or customer…" value={query} onChangeText={setQuery} placeholderTextColor={theme.colors.textMuted} />
      </View>
      <ScrollViewHorizontal filters={FILTERS} active={filter} onSelect={setFilter} />
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentContainerStyle={{ paddingTop: 8 }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}
        {filtered.length === 0 ? (
          <Empty title="No orders found" subtitle="Create one from POS or tap New." />
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map((o) => (
              <Card key={o.id} onPress={() => setSelected(o as typeof selected)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ordNo}>{o.order_number}</Text>
                    <Text style={styles.ordCust}>{o.customer?.name ?? 'Walk-in'} · {formatDate(o.created_at)}</Text>
                    <View style={styles.tagsRow}>
                      <Badge label={orderStatusLabel[o.status]} color={orderStatusColor[o.status]} />
                      <Text style={styles.amount}>{formatLKR(o.total)}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={theme.colors.textMuted} />
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
                <Text style={styles.detailTitle}>{selected.order_number}</Text>
                <Pressable onPress={() => setSelected(null)}><X size={22} color={theme.colors.text} /></Pressable>
              </View>
              <Badge label={orderStatusLabel[selected.status]} color={orderStatusColor[selected.status]} />
              <Text style={styles.detailCust}>{selected.customer?.name ?? 'Walk-in customer'}</Text>
              {selected.customer?.phone && <Text style={styles.detailPhone}>{selected.customer.phone}</Text>}
              {selected.delivery_address && <Text style={styles.detailPhone}>{selected.delivery_address}</Text>}

              <Text style={styles.itemsTitle}>Items</Text>
              {(selected.order_items ?? []).map((it) => (
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
              </View>

              {orderInvoice ? (
                <Button title="Print Invoice" onPress={() => handlePrint(orderInvoice)} fullWidth style={{ marginTop: 14 }} />
              ) : canManage ? (
                <Button title="Generate Invoice" onPress={createInvoiceForOrder} loading={creatingInvoice} fullWidth style={{ marginTop: 14 }} />
              ) : null}
              {printerMessage && <Text style={styles.printerMessage}>{printerMessage}</Text>}

              {canManage && selected.status !== 'delivered' && selected.status !== 'cancelled' && (
                <View style={styles.actionRow}>
                  <Button title="Move back" variant="outline" onPress={() => advanceStatus(selected, -1)} style={{ flex: 1 }} />
                  <Button title="Advance status" onPress={() => advanceStatus(selected, 1)} style={{ flex: 1 }} />
                </View>
              )}
            </Card>
          </View>
        )}
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

const FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'out_for_delivery', label: 'Out' },
  { key: 'delivered', label: 'Delivered' },
];

function ScrollViewHorizontal({ filters, active, onSelect }: { filters: typeof FILTERS; active: string; onSelect: (k: OrderStatus | 'all') => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
      {filters.map((f) => (
        <Pressable
          key={f.key}
          onPress={() => onSelect(f.key)}
          style={[styles.chip, active === f.key && styles.chipActive]}
        >
          <Text style={[styles.chipText, active === f.key && styles.chipTextActive]}>{f.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, margin: 12, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  ordNo: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  ordCust: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  amount: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: theme.colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '90%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  detailCust: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginTop: 12 },
  detailPhone: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },
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
  printerMessage: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: theme.colors.primary[50], color: theme.colors.primary[800], fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
