import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, Modal, ScrollView } from 'react-native';
import { Search, Plus, X, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR } from '@/lib/format';
import type { ProductWithCategory, Category } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Button, Empty, ErrorBox, Badge } from '@/components/ui';

export default function ProductsScreen() {
  const { staff } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<ProductWithCategory | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canManage = staff?.role === 'admin' || staff?.role === 'manager';

  const load = useCallback(async () => {
    setError(null);
    const [pRes, cRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(id,name)').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);
    if (pRes.error || cRes.error) { setError('Could not load products.'); setLoading(false); setRefreshing(false); return; }
    setProducts((pRes.data as ProductWithCategory[]) ?? []);
    setCategories((cRes.data as Category[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter !== 'all' && p.category_id !== catFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q);
    });
  }, [products, query, catFilter]);

  const onDelete = async (p: ProductWithCategory) => {
    if (staff?.role !== 'admin') return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { setError('Could not delete product.'); return; }
    load();
  };

  return (
    <Screen>
      <BrandHeader subtitle="Product Catalogue" />
      <View style={styles.searchWrap}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput style={styles.search} placeholder="Search name, SKU, barcode…" value={query} onChangeText={setQuery} placeholderTextColor={theme.colors.textMuted} />
        {canManage && (
          <Pressable onPress={() => { setEditing(null); setShowForm(true); }} style={styles.addBtn}>
            <Plus size={20} color={theme.colors.white} />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
        <FilterChip label="All" active={catFilter === 'all'} onPress={() => setCatFilter('all')} />
        {categories.map((c) => (
          <FilterChip key={c.id} label={c.name} active={catFilter === c.id} onPress={() => setCatFilter(c.id)} />
        ))}
      </ScrollView>
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentContainerStyle={{ paddingTop: 4 }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}
        {filtered.length === 0 ? (
          <Empty title="No products" subtitle="Add your first product to get started." />
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map((p) => (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pName}>{p.name}</Text>
                    <Text style={styles.pSub}>{p.category?.name ?? 'Uncategorised'} · {p.sku ?? '—'}</Text>
                    <View style={styles.pFooter}>
                      <Text style={styles.pPrice}>{formatLKR(p.selling_price)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {p.stock <= p.reorder_level ? (
                          <View style={[styles.stockChip, { backgroundColor: theme.colors.error + '1a' }]}>
                            <AlertTriangle size={12} color={theme.colors.error} />
                            <Text style={[styles.stockChipText, { color: theme.colors.error }]}>{p.stock} left</Text>
                          </View>
                        ) : (
                          <Text style={styles.stockOk}>{p.stock} in stock</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  {canManage && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable onPress={() => { setEditing(p); setShowForm(true); }} style={styles.iconBtn}>
                        <Pencil size={15} color={theme.colors.primary[700]} />
                      </Pressable>
                      {staff?.role === 'admin' && (
                        <Pressable onPress={() => onDelete(p)} style={[styles.iconBtn, { backgroundColor: '#fef2f2' }]}>
                          <Trash2 size={15} color={theme.colors.error} />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScreenScroll>

      <ProductForm
        visible={showForm}
        product={editing}
        categories={categories}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); load(); }}
      />
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ProductForm({ visible, product, categories, onClose, onSaved }: {
  visible: boolean;
  product: ProductWithCategory | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [sellingPrice, setSellingPrice] = useState('');
  const [caseSize, setCaseSize] = useState('1');
  const [casePrice, setCasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(product?.name ?? '');
      setSku(product?.sku ?? '');
      setBarcode(product?.barcode ?? '');
      setCategoryId(product?.category_id ?? categories[0]?.id ?? '');
      setUnit(product?.unit ?? 'pcs');
      setSellingPrice(String(product?.selling_price ?? ''));
      setCaseSize(String(product?.case_size ?? '1'));
      setCasePrice(String(product?.case_price ?? ''));
      setCostPrice(String(product?.cost_price ?? ''));
      setStock(String(product?.stock ?? '0'));
      setReorderLevel(String(product?.reorder_level ?? '0'));
      setErr(null);
    }
  }, [visible, product, categories]);

  const save = async () => {
    setErr(null);
    if (!name.trim()) { setErr('Name is required.'); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      category_id: categoryId || null,
      unit,
      selling_price: Number(sellingPrice) || 0,
      case_size: Math.max(1, Number(caseSize) || 1),
      case_price: Number(casePrice) || 0,
      cost_price: Number(costPrice) || 0,
      stock: Number(stock) || 0,
      reorder_level: Number(reorderLevel) || 0,
      active: true,
    };
    const { error } = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{product ? 'Edit Product' : 'New Product'}</Text>
            <Pressable onPress={onClose}><X size={22} color={theme.colors.text} /></Pressable>
          </View>
          {err && <View style={{ marginBottom: 10 }}><ErrorBox message={err} /></View>}
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 10 }}>
            <Input label="Name" value={name} onChangeText={setName} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Input label="SKU" value={sku} onChangeText={setSku} flex />
              <Input label="Barcode" value={barcode} onChangeText={setBarcode} flex />
            </View>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {categories.map((c) => (
                <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[styles.chip, categoryId === c.id && styles.chipActive]}>
                  <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Input label="Unit" value={unit} onChangeText={setUnit} flex />
              <Input label="Selling Price" value={sellingPrice} onChangeText={setSellingPrice} keyboardType="numeric" flex />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Input label="Items per Case" value={caseSize} onChangeText={setCaseSize} keyboardType="numeric" flex />
              <Input label="Case Price" value={casePrice} onChangeText={setCasePrice} keyboardType="numeric" flex />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Input label="Cost Price" value={costPrice} onChangeText={setCostPrice} keyboardType="numeric" flex />
              <Input label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" flex />
            </View>
            <Input label="Reorder Level" value={reorderLevel} onChangeText={setReorderLevel} keyboardType="numeric" />
          </ScrollView>
          <Button title={product ? 'Save Changes' : 'Create Product'} onPress={save} loading={saving} fullWidth style={{ marginTop: 14 }} />
        </Card>
      </View>
    </Modal>
  );
}

function Input({ label, value, onChangeText, keyboardType, flex }: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric'; flex?: boolean }) {
  return (
    <View style={{ flex: flex ? 1 : undefined }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholderTextColor={theme.colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, margin: 12, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
  addBtn: { backgroundColor: theme.colors.primary[700], borderRadius: 10, padding: 8 },
  pName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  pSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  pFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pPrice: { fontSize: 16, fontWeight: '700', color: theme.colors.primary[700] },
  stockChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stockChipText: { fontSize: 11, fontWeight: '700' },
  stockOk: { fontSize: 12, color: theme.colors.primary[700], fontWeight: '600' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: theme.colors.white },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  formCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '92%' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.neutral[50] },
});
