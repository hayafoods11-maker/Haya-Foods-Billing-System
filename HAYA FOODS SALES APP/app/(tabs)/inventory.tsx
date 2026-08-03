import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { Search, Plus, Archive, DollarSign, X, SlidersHorizontal, TriangleAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR } from '@/lib/format';
import type { ProductWithCategory, PurchaseEntry } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Button, Empty, ErrorBox, Badge } from '@/components/ui';

interface PurchaseListItem extends PurchaseEntry {
  product?: { name: string } | null;
}

export default function InventoryScreen() {
  const { staff } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [movementType, setMovementType] = useState<'receive' | 'adjustment' | 'damage'>('receive');
  const [batchNumber, setBatchNumber] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const [prodRes, purchaseRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(id,name)').order('name'),
      supabase.from('purchase_entries').select('*, product:products(name)').order('created_at', { ascending: false }).limit(40),
    ]);

    if (prodRes.error || purchaseRes.error) {
      setError('Could not load inventory data.');
      setRefreshing(false);
      return;
    }

    setProducts((prodRes.data as ProductWithCategory[]) ?? []);
    setPurchases((purchaseRes.data as PurchaseListItem[]) ?? []);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      product.name.toLowerCase().includes(term) ||
      (product.sku ?? '').toLowerCase().includes(term) ||
      (product.barcode ?? '').toLowerCase().includes(term) ||
      (product.category?.name ?? '').toLowerCase().includes(term),
    );
  }, [products, query]);

  const lowStock = products.filter((product) => product.stock <= product.reorder_level);
  const totalValue = products.reduce((sum, product) => sum + product.stock * product.cost_price, 0);

  const openMovement = (type: 'receive' | 'adjustment' | 'damage' = 'receive') => {
    setMovementType(type);
    setSelectedProduct(null);
    setQty('1');
    setUnitCost('0');
    setReference('');
    setNotes('');
    setBatchNumber('');
    setManufacturingDate('');
    setExpiryDate('');
    setShowReceive(true);
  };

  const receiveStock = async () => {
    if (!selectedProduct) {
      setError('Choose a product to receive.');
      return;
    }
    const quantity = Number(qty);
    const unit = Number(unitCost);
    if (!quantity || (movementType !== 'adjustment' && quantity <= 0)) {
      setError(movementType === 'adjustment' ? 'Enter a non-zero adjustment quantity.' : 'Enter a valid quantity.');
      return;
    }
    if (movementType === 'receive' && (!unit || unit < 0)) {
      setError('Enter a valid unit cost.');
      return;
    }
    setSaving(true);
    setError(null);
    const totalCost = quantity * unit;

    if (movementType === 'receive' && !batchNumber.trim()) {
      setError('Enter a batch number for this stock receipt.');
      return;
    }

    if (movementType !== 'receive') {
      const signedQuantity = movementType === 'damage' ? quantity : Number(qty);
      const { error: txError } = await supabase.from('inventory_transactions').insert({
        product_id: selectedProduct.id,
        type: movementType === 'damage' ? 'wastage' : 'adjustment',
        quantity: signedQuantity,
        reference: reference.trim() || null,
        notes: `${movementType === 'damage' ? 'Damaged stock' : 'Stock adjustment'}${notes.trim() ? `: ${notes.trim()}` : ''}`,
        created_by: staff?.id ?? null,
      });
      if (txError) { setError('Could not record stock movement.'); setSaving(false); return; }
      setShowReceive(false); setSaving(false); load(); return;
    }

    const { error: purchaseError } = await supabase.from('purchase_entries').insert({
      product_id: selectedProduct.id,
      supplier_id: null,
      quantity,
      unit_cost: unit,
      total_cost: totalCost,
      received_by: staff?.id ?? null,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    });
    if (purchaseError) {
      setError('Could not save purchase entry.');
      setSaving(false);
      return;
    }

    const { error: txError } = await supabase.from('inventory_transactions').insert({
      product_id: selectedProduct.id,
      type: 'purchase',
      quantity,
      balance_after: null,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      created_by: staff?.id ?? null,
    });
    if (txError) {
      setError('Could not record inventory transaction.');
      setSaving(false);
      return;
    }

    const { error: batchError } = await supabase.from('inventory_batches').insert({
      product_id: selectedProduct.id,
      batch_number: batchNumber.trim(),
      manufacturing_date: manufacturingDate.trim() || null,
      expiry_date: expiryDate.trim() || null,
      quantity_received: quantity,
      quantity_available: quantity,
      unit_cost: unit,
      reference: reference.trim() || null,
      created_by: staff?.id ?? null,
    });
    if (batchError) {
      setError('Stock received, but the batch record could not be saved. Check the batch number and try again.');
      setSaving(false);
      return;
    }

    setShowReceive(false);
    setSaving(false);
    load();
  };

  return (
    <Screen>
      <BrandHeader subtitle="Inventory Management" />
      <View style={styles.summaryRow}>
        <Stat label="Total Stock Value" value={formatLKR(totalValue)} icon={<DollarSign size={18} color={theme.colors.primary[700]} />} tint={theme.colors.primary[700]} />
        <Stat label="Low Stock" value={`${lowStock.length}`} icon={<Archive size={18} color={theme.colors.error} />} tint={theme.colors.error} />
      </View>
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}

        <View style={styles.searchWrap}>
          <Search size={18} color={theme.colors.textMuted} />
          <TextInput style={styles.search} placeholder="Search products or category…" value={query} onChangeText={setQuery} placeholderTextColor={theme.colors.textMuted} />
          <Pressable onPress={() => openMovement('receive')} style={styles.addBtn}>
            <Plus size={20} color={theme.colors.white} />
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={() => openMovement('receive')} style={styles.actionButton}><Plus size={17} color={theme.colors.primary[700]} /><Text style={styles.actionText}>Receive stock</Text></Pressable>
          <Pressable onPress={() => openMovement('adjustment')} style={styles.actionButton}><SlidersHorizontal size={17} color={theme.colors.info} /><Text style={styles.actionText}>Adjust stock</Text></Pressable>
          <Pressable onPress={() => openMovement('damage')} style={styles.actionButton}><TriangleAlert size={17} color={theme.colors.error} /><Text style={styles.actionText}>Record damage</Text></Pressable>
        </View>

        <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
        {lowStock.length === 0 ? (
          <Empty title="No low stock items" subtitle="Your inventory levels are healthy." />
        ) : (
          <View style={{ gap: 10 }}>
            {lowStock.map((product) => (
              <Card key={product.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{product.name}</Text>
                    <Text style={styles.itemSub}>{product.category?.name ?? 'Uncategorised'}</Text>
                  </View>
                  <Badge label={`${product.stock} left`} color={theme.colors.error} />
                </View>
              </Card>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Recent Stock Receipts</Text>
        {purchases.length === 0 ? (
          <Empty title="No stock receipts yet" subtitle="Receive products to build inventory history." />
        ) : (
          <View style={{ gap: 10 }}>
            {purchases.slice(0, 10).map((entry) => (
              <Card key={entry.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{entry.product?.name ?? 'Product'}</Text>
                    <Text style={styles.itemSub}>{entry.reference ?? 'Purchase'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemMeta}>{entry.quantity} × {formatLKR(entry.unit_cost)}</Text>
                    <Text style={styles.itemTotal}>{formatLKR(entry.total_cost)}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScreenScroll>

      <Modal visible={showReceive} animationType="slide" transparent onRequestClose={() => setShowReceive(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.receiveCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{movementType === 'receive' ? 'Receive Stock' : movementType === 'damage' ? 'Record Damaged Stock' : 'Adjust Stock'}</Text>
              <Pressable onPress={() => setShowReceive(false)}><X size={22} color={theme.colors.text} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
              <Text style={styles.fieldLabel}>Product</Text>
              <View style={styles.productPicker}>
                {filteredProducts.map((product) => (
                  <Pressable
                    key={product.id}
                    style={[styles.productOption, selectedProduct?.id === product.id && styles.productOptionActive]}
                    onPress={() => setSelectedProduct(product)}
                  >
                    <Text style={[styles.productOptionText, selectedProduct?.id === product.id && styles.productOptionTextActive]}>{product.name}</Text>
                    <Text style={styles.productOptionSub}>{product.category?.name ?? 'Uncategorised'}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Field label={movementType === 'adjustment' ? 'Quantity (+ / -)' : 'Quantity'} value={qty} onChangeText={setQty} keyboardType="numeric" flex />
                {movementType === 'receive' && <Field label="Unit Cost" value={unitCost} onChangeText={setUnitCost} keyboardType="numeric" flex />}
              </View>
              {movementType === 'receive' && <>
                <Field label="Batch Number" value={batchNumber} onChangeText={setBatchNumber} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Field label="Manufacturing Date (YYYY-MM-DD)" value={manufacturingDate} onChangeText={setManufacturingDate} flex />
                  <Field label="Expiry Date (YYYY-MM-DD)" value={expiryDate} onChangeText={setExpiryDate} flex />
                </View>
              </>}
              <Field label="Reference" value={reference} onChangeText={setReference} />
              <Field label="Notes" value={notes} onChangeText={setNotes} />
              {movementType === 'receive' && <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Cost</Text>
                <Text style={styles.totalValue}>{formatLKR((Number(qty) || 0) * (Number(unitCost) || 0))}</Text>
              </View>}
            </ScrollView>
            <Button title={movementType === 'receive' ? 'Save Receipt' : movementType === 'damage' ? 'Record Damage' : 'Save Adjustment'} onPress={receiveStock} loading={saving} fullWidth style={{ marginTop: 14 }} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function Field({ label, value, onChangeText, keyboardType, flex }: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric'; flex?: boolean }) {
  return (
    <View style={{ flex: flex ? 1 : undefined, marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={theme.colors.textMuted}
      />
    </View>
  );
}

function Stat({ label, value, icon, tint }: { label: string; value: string; icon: React.ReactNode; tint: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, color: theme.colors.textMuted, fontWeight: '500' }}>{label}</Text>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tint + '1a', alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700', color: tint, marginTop: 8 }}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, margin: 12, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  actionText: { fontSize: 12, color: theme.colors.text, fontWeight: '600' },
  addBtn: { backgroundColor: theme.colors.primary[700], borderRadius: 10, padding: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginHorizontal: 16, marginTop: 8, marginBottom: 6 },
  itemName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  itemSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  itemMeta: { fontSize: 12, color: theme.colors.textMuted },
  itemTotal: { fontSize: 15, fontWeight: '700', color: theme.colors.primary[700], marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  receiveCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.neutral[50] },
  productPicker: { gap: 8 },
  productOption: { padding: 12, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  productOptionActive: { borderColor: theme.colors.primary[700], backgroundColor: theme.colors.primary[50] },
  productOptionText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  productOptionTextActive: { color: theme.colors.primary[700] },
  productOptionSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  totalLabel: { fontSize: 14, color: theme.colors.textMuted },
  totalValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
});
