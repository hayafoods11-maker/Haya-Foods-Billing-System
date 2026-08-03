import { useEffect, useState, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Search, Minus, Plus, Trash2, ShoppingCart, X, UserPlus, Check, CreditCard } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR } from '@/lib/format';
import type { ProductWithCategory, Customer, CompanySettings, PaymentMethod, Invoice, InvoiceItem } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, Card, Button, Empty, ErrorBox } from '@/components/ui';
import { printInvoice } from '@/lib/printInvoice';

interface CartLine {
  product: ProductWithCategory;
  qty: number;
}

const BREAKPOINT = 768;

export default function POSScreen() {
  const { staff } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= BREAKPOINT;

  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discountPct, setDiscountPct] = useState('0');
  const [showPay, setShowPay] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<(Invoice & { customer?: { name: string; phone: string | null } | null; invoice_items?: InvoiceItem[] }) | null>(null);
  const [printerMessage, setPrinterMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [pRes, cRes, sRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(id,name)').eq('active', true).order('name'),
      supabase.from('customers').select('*').eq('active', true).order('name'),
      supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (pRes.error || cRes.error) {
      setError('Could not load products.');
      return;
    }
    setProducts((pRes.data as ProductWithCategory[]) ?? []);
    setCustomers((cRes.data as Customer[]) ?? []);
    setSettings(sRes.data as CompanySettings | null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, customerQuery]);

  const addToCart = (p: ProductWithCategory) => {
    if (p.stock <= 0) {
      setError(`${p.name} is out of stock.`);
      return;
    }
    setCart((c) => {
      const ex = c.find((l) => l.product.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) {
          setError(`Only ${p.stock} ${p.unit} of ${p.name} is available.`);
          return c;
        }
        return c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { product: p, qty: 1 }];
    });
    setSuccess(null);
  };

  const changeQty = (id: string, delta: number) => {
    setCart((c) =>
      c
        .map((l) => (l.product.id === id ? { ...l, qty: Math.min(l.product.stock, Math.max(0, l.qty + delta)) } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const removeLine = (id: string) => setCart((c) => c.filter((l) => l.product.id !== id));

  const subtotal = cart.reduce((s, l) => s + l.product.selling_price * l.qty, 0);
  const discount = (subtotal * (Number(discountPct) || 0)) / 100;
  const taxable = subtotal - discount;
  const tax = (taxable * (settings?.tax_percentage ?? 0)) / 100;
  const total = taxable + tax;

  const completeSale = async (method: PaymentMethod) => {
    if (cart.length === 0 || processing) return;
    setError(null);
    setProcessing(true);
    try {
    const { data: currentProducts, error: stockError } = await supabase.from('products').select('id, name, stock').in('id', cart.map((line) => line.product.id));
    if (stockError) throw stockError;
    const currentStock = new Map((currentProducts ?? []).map((product) => [product.id, product]));
    const unavailable = cart.find((line) => Number(currentStock.get(line.product.id)?.stock ?? 0) < line.qty);
    if (unavailable) throw new Error(`Not enough stock for ${unavailable.product.name}. Refresh and try again.`);
    const prefix = settings?.invoice_prefix ?? 'INV';
    const invNo = `${prefix}-${Date.now().toString().slice(-6)}`;
    const ordNo = `ORD-${Date.now().toString().slice(-6)}`;

    const { data: orderData, error: ordErr } = await supabase
      .from('orders')
      .insert({
        order_number: ordNo,
        customer_id: selectedCustomer?.id ?? null,
        created_by: staff?.id ?? null,
        status: 'delivered',
        subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total,
        payment_method: method,
        is_pos: true,
      })
      .select()
      .single();
    if (ordErr || !orderData) throw ordErr ?? new Error('Could not create the order.');
    const orderId = orderData.id;

    const orderItems = cart.map((l) => ({
      order_id: orderId,
      product_id: l.product.id,
      name: l.product.name,
      quantity: l.qty,
      unit_price: l.product.selling_price,
      discount_amount: 0,
      line_total: l.product.selling_price * l.qty,
    }));
    const { error: orderItemsError } = await supabase.from('order_items').insert(orderItems);
    if (orderItemsError) throw orderItemsError;

    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invNo,
        order_id: orderId,
        customer_id: selectedCustomer?.id ?? null,
        created_by: staff?.id ?? null,
        subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total,
        paid_amount: method === 'Credit' ? 0 : total,
        balance: method === 'Credit' ? total : 0,
        payment_status: method === 'Credit' ? 'unpaid' : 'paid',
        payment_method: method,
      })
      .select()
      .single();
    if (invErr || !invData) throw invErr ?? new Error('Could not create the invoice.');

    const invoiceItems = cart.map((l) => ({
      invoice_id: invData.id,
      product_id: l.product.id,
      name: l.product.name,
      quantity: l.qty,
      unit_price: l.product.selling_price,
      discount_amount: 0,
      line_total: l.product.selling_price * l.qty,
    }));
    const { error: invoiceItemsError } = await supabase.from('invoice_items').insert(invoiceItems);
    if (invoiceItemsError) throw invoiceItemsError;

    const txs = cart.map((l) => ({
      product_id: l.product.id,
      type: 'sale' as const,
      quantity: l.qty,
      reference: ordNo,
      created_by: staff?.id ?? null,
    }));
    const { error: transactionError } = await supabase.from('inventory_transactions').insert(txs);
    if (transactionError) throw transactionError;

    if (method !== 'Credit') {
      const { error: paymentError } = await supabase.from('payments').insert({
        invoice_id: invData.id,
        customer_id: selectedCustomer?.id ?? null,
        amount: total,
        method,
        received_by: staff?.id ?? null,
      });
      if (paymentError) throw paymentError;
    } else if (selectedCustomer) {
      const { error: customerError } = await supabase
        .from('customers')
        .update({ outstanding_balance: selectedCustomer.outstanding_balance + total })
        .eq('id', selectedCustomer.id);
      if (customerError) throw customerError;
    }

    setShowPay(false);
    setShowCart(false);
    setCart([]);
    setSelectedCustomer(null);
    setDiscountPct('0');
    setSuccess(`Sale complete — ${invNo}`);
    setCompletedInvoice({
      ...(invData as Invoice),
      customer: selectedCustomer ? { name: selectedCustomer.name, phone: selectedCustomer.phone } : null,
      invoice_items: invoiceItems as InvoiceItem[],
    });
    await load();
    } catch (saleError) {
      setError(saleError instanceof Error ? saleError.message : 'Could not save this sale. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const printCompletedInvoice = () => {
    if (!completedInvoice) return;
    setPrinterMessage(null);
    if (!printInvoice(completedInvoice)) {
      setPrinterMessage('Your browser blocked the invoice window. Allow pop-ups for this app, then tap Print Invoice again.');
    }
  };

  const numCols = isWide ? 3 : 2;

  const productList = (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      numColumns={numCols}
      key={`grid-${numCols}`}
      contentContainerStyle={{ padding: 12, gap: 10 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => addToCart(item)}
          style={({ pressed }) => [styles.productCard, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.prodName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.prodSub}>{item.category?.name ?? '—'}</Text>
          <View style={styles.prodFooter}>
            <Text style={styles.prodPrice}>{formatLKR(item.selling_price)}</Text>
            <View style={[styles.stockTag, { backgroundColor: item.stock <= item.reorder_level ? theme.colors.error + '1a' : theme.colors.primary[50] }]}>
              <Text style={[styles.stockTagText, { color: item.stock <= item.reorder_level ? theme.colors.error : theme.colors.primary[700] }]}>{item.stock}</Text>
            </View>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={<Empty title="No products found" subtitle="Try a different search." />}
    />
  );

  const searchBox = (
    <View style={styles.searchWrap}>
      <Search size={18} color={theme.colors.textMuted} />
      <TextInput
        style={styles.search}
        placeholder="Search product, SKU or barcode…"
        value={query}
        onChangeText={setQuery}
        placeholderTextColor={theme.colors.textMuted}
      />
    </View>
  );

  const cartPanel = (
    <View style={isWide ? styles.rightWide : styles.rightNarrow}>
      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>Cart ({cart.length})</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {cart.length > 0 && (
            <Pressable onPress={() => setCart([])}>
              <Text style={styles.clearBtn}>Clear</Text>
            </Pressable>
          )}
          {!isWide && (
            <Pressable onPress={() => setShowCart(false)}>
              <X size={20} color={theme.colors.text} />
            </Pressable>
          )}
        </View>
      </View>

      <Pressable onPress={() => setShowCustomer(true)} style={styles.customerPicker}>
        <UserPlus size={16} color={theme.colors.primary[700]} />
        <Text style={styles.customerText} numberOfLines={1}>
          {selectedCustomer ? selectedCustomer.name : 'Walk-in customer'}
        </Text>
      </Pressable>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 12, padding: 12 }}>
        {cart.length === 0 ? (
          <Empty title="Cart is empty" subtitle="Tap a product to add it." />
        ) : (
          cart.map((l) => (
            <View key={l.product.id} style={styles.cartLine}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName} numberOfLines={1}>{l.product.name}</Text>
                <Text style={styles.linePrice}>{formatLKR(l.product.selling_price)}</Text>
              </View>
              <View style={styles.qtyRow}>
                <Pressable onPress={() => changeQty(l.product.id, -1)} style={styles.qtyBtn}>
                  <Minus size={14} color={theme.colors.text} />
                </Pressable>
                <Text style={styles.qtyText}>{l.qty}</Text>
                <Pressable onPress={() => changeQty(l.product.id, 1)} style={styles.qtyBtn}>
                  <Plus size={14} color={theme.colors.text} />
                </Pressable>
                <Pressable onPress={() => removeLine(l.product.id)} style={styles.trashBtn}>
                  <Trash2 size={14} color={theme.colors.error} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.totalsBox}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatLKR(subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Discount %</Text>
          <TextInput
            style={styles.discInput}
            value={discountPct}
            onChangeText={setDiscountPct}
            keyboardType="numeric"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax ({settings?.tax_percentage ?? 0}%)</Text>
          <Text style={styles.totalValue}>{formatLKR(tax)}</Text>
        </View>
        <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 6, paddingTop: 8 }]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{formatLKR(total)}</Text>
        </View>
        <Button title={processing ? 'Saving sale…' : 'Charge'} onPress={() => setShowPay(true)} fullWidth disabled={cart.length === 0 || processing} style={{ marginTop: 12 }} />
      </View>
    </View>
  );

  return (
    <Screen>
      <BrandHeader subtitle="Point of Sale" />
      {success && (
        <View style={styles.successBanner}>
          <Check size={18} color={theme.colors.white} />
          <Text style={styles.successText}>{success}</Text>
          <Pressable onPress={() => setSuccess(null)} hitSlop={8}>
            <X size={18} color={theme.colors.white} />
          </Pressable>
        </View>
      )}

      {isWide ? (
        // Tablet / desktop: side-by-side
        <View style={styles.body}>
          <View style={styles.left}>
            {searchBox}
            {error && <View style={{ marginHorizontal: 12, marginBottom: 8 }}><ErrorBox message={error} /></View>}
            {productList}
          </View>
          {cartPanel}
        </View>
      ) : (
        // Phone: full-width products, cart opens as a bottom sheet
        <View style={{ flex: 1 }}>
          {searchBox}
          {error && <View style={{ marginHorizontal: 12, marginBottom: 8 }}><ErrorBox message={error} /></View>}
          {productList}
          {cart.length > 0 && (
            <Pressable style={styles.fab} onPress={() => setShowCart(true)}>
              <ShoppingCart size={20} color={theme.colors.white} />
              <Text style={styles.fabText}>{cart.length} · {formatLKR(total)}</Text>
              <Text style={styles.fabView}>View</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Phone cart bottom sheet */}
      <Modal visible={showCart && !isWide} animationType="slide" transparent onRequestClose={() => setShowCart(false)}>
        <View style={styles.cartSheetOverlay}>
          {cartPanel}
        </View>
      </Modal>

      <Modal visible={showPay} animationType="slide" transparent onRequestClose={() => setShowPay(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.payCard}>
            <View style={styles.payHeader}>
              <Text style={styles.payTitle}>Payment</Text>
              <Pressable onPress={() => setShowPay(false)}><X size={22} color={theme.colors.text} /></Pressable>
            </View>
            <Text style={styles.payAmount}>{formatLKR(total)}</Text>
            <Text style={styles.payCaption}>Select payment method</Text>
            <View style={styles.payGrid}>
              {(settings?.payment_methods ?? ['Cash', 'Card', 'Bank Transfer', 'Credit']).map((m) => (
                <Pressable key={m} style={[styles.payOption, processing && { opacity: 0.55 }]} disabled={processing} onPress={() => completeSale(m as PaymentMethod)}>
                  <CreditCard size={22} color={theme.colors.primary[700]} />
                  <Text style={styles.payOptionText}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>
      </Modal>

      <Modal visible={!!completedInvoice} animationType="slide" transparent onRequestClose={() => setCompletedInvoice(null)}>
        {completedInvoice && <View style={styles.modalOverlay}>
          <Card style={styles.payCard}>
            <View style={styles.payHeader}>
              <Text style={styles.payTitle}>Payment Complete</Text>
              <Pressable onPress={() => setCompletedInvoice(null)}><X size={22} color={theme.colors.text} /></Pressable>
            </View>
            <View style={styles.receiptIcon}><Check size={28} color={theme.colors.white} /></View>
            <Text style={styles.receiptInvoice}>{completedInvoice.invoice_number}</Text>
            <Text style={styles.receiptTotal}>{formatLKR(completedInvoice.total)}</Text>
            <Text style={styles.receiptCaption}>Your invoice is ready to print.</Text>
            <Button title="Print Invoice" onPress={printCompletedInvoice} fullWidth style={{ marginTop: 18 }} />
            <Button title="View Invoices" variant="outline" onPress={() => { setCompletedInvoice(null); router.push('/invoices'); }} fullWidth style={{ marginTop: 10 }} />
            {printerMessage && <Text style={styles.printerMessage}>{printerMessage}</Text>}
          </Card>
        </View>}
      </Modal>

      <Modal visible={showCustomer} animationType="slide" transparent onRequestClose={() => setShowCustomer(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.custCard}>
            <View style={styles.payHeader}>
              <Text style={styles.payTitle}>Select Customer</Text>
              <Pressable onPress={() => setShowCustomer(false)}><X size={22} color={theme.colors.text} /></Pressable>
            </View>
            <View style={styles.searchWrap}>
              <Search size={18} color={theme.colors.textMuted} />
              <TextInput style={styles.search} placeholder="Search customer…" value={customerQuery} onChangeText={setCustomerQuery} placeholderTextColor={theme.colors.textMuted} />
            </View>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
              <Pressable
                style={[styles.custRow, !selectedCustomer && styles.custRowActive]}
                onPress={() => { setSelectedCustomer(null); setShowCustomer(false); }}
              >
                <ShoppingCart size={18} color={theme.colors.textMuted} />
                <Text style={styles.custRowText}>Walk-in customer</Text>
              </Pressable>
              {filteredCustomers.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.custRow, selectedCustomer?.id === c.id && styles.custRowActive]}
                  onPress={() => { setSelectedCustomer(c); setShowCustomer(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custRowText}>{c.name}</Text>
                    <Text style={styles.custRowSub}>{c.phone ?? c.company ?? '—'}</Text>
                  </View>
                  {selectedCustomer?.id === c.id && <Check size={18} color={theme.colors.primary[700]} />}
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primary[700], paddingHorizontal: 16, paddingVertical: 10 },
  successText: { color: theme.colors.white, fontSize: 14, fontWeight: '600', flex: 1 },
  body: { flex: 1, flexDirection: 'row' },
  left: { flex: 1.4 },
  rightWide: { flex: 1, backgroundColor: theme.colors.card, borderLeftWidth: 1, borderLeftColor: theme.colors.border },
  rightNarrow: { flex: 1, backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  cartSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  fab: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.primary[700], borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 16, ...theme.shadows.lg,
  },
  fabText: { color: theme.colors.white, fontSize: 15, fontWeight: '700', flex: 1 },
  fabView: { color: theme.colors.white, fontSize: 13, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, margin: 12, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  productCard: { flex: 1, backgroundColor: theme.colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.colors.border, margin: 4, ...theme.shadows.sm },
  prodName: { fontSize: 14, fontWeight: '600', color: theme.colors.text, minHeight: 36 },
  prodSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  prodFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  prodPrice: { fontSize: 14, fontWeight: '700', color: theme.colors.primary[700] },
  stockTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  stockTagText: { fontSize: 11, fontWeight: '700' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  cartTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  clearBtn: { fontSize: 13, color: theme.colors.error, fontWeight: '600' },
  customerPicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: theme.colors.primary[50], borderWidth: 1, borderColor: theme.colors.primary[200] },
  customerText: { fontSize: 14, color: theme.colors.primary[800], fontWeight: '600' },
  cartLine: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: theme.colors.neutral[50], borderWidth: 1, borderColor: theme.colors.border },
  lineName: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  linePrice: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  trashBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  qtyText: { fontSize: 14, fontWeight: '700', color: theme.colors.text, minWidth: 20, textAlign: 'center' },
  totalsBox: { padding: 14, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.neutral[50] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalLabel: { fontSize: 14, color: theme.colors.textMuted },
  totalValue: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  discInput: { width: 70, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, color: theme.colors.text, textAlign: 'right' },
  grandLabel: { fontSize: 17, fontWeight: '700', color: theme.colors.text },
  grandValue: { fontSize: 17, fontWeight: '800', color: theme.colors.primary[700] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  payCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30 },
  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  payAmount: { fontSize: 30, fontWeight: '800', color: theme.colors.primary[700], textAlign: 'center', marginVertical: 12 },
  payCaption: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 16 },
  payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  payOption: { flexBasis: '45%', flexGrow: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.neutral[50] },
  payOptionText: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  receiptIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary[700], alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  receiptInvoice: { color: theme.colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  receiptTotal: { color: theme.colors.primary[700], fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  receiptCaption: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 6 },
  printerMessage: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: theme.colors.primary[50], color: theme.colors.primary[800], fontSize: 12, lineHeight: 17, textAlign: 'center' },
  custCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '80%' },
  custRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.neutral[50] },
  custRowActive: { borderColor: theme.colors.primary[700], backgroundColor: theme.colors.primary[50] },
  custRowText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  custRowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
