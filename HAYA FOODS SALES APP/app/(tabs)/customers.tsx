import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Modal, ScrollView } from 'react-native';
import { Search, Plus, X, Pencil, Phone, Mail, Wallet, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR, formatDate } from '@/lib/format';
import type { Customer, Invoice, Payment, PaymentMethod } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Button, Empty, ErrorBox, Badge } from '@/components/ui';

export default function CustomersScreen() {
  const { staff } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canManage = staff?.role === 'admin' || staff?.role === 'manager';
  const canCreate = canManage || staff?.role === 'cashier' || staff?.role === 'sales_rep';

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase.from('customers').select('*').order('name');
    if (error) { setError('Could not load customers.'); setRefreshing(false); return; }
    setCustomers((data as Customer[]) ?? []);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.company ?? '').toLowerCase().includes(q));
  }, [customers, query]);

  return (
    <Screen>
      <BrandHeader subtitle="Customers" />
      <View style={styles.searchWrap}>
        <Search size={18} color={theme.colors.textMuted} />
        <TextInput style={styles.search} placeholder="Search name, phone, company…" value={query} onChangeText={setQuery} placeholderTextColor={theme.colors.textMuted} />
        {canCreate && (
          <Pressable onPress={() => { setEditing(null); setShowForm(true); }} style={styles.addBtn}>
            <Plus size={20} color={theme.colors.white} />
          </Pressable>
        )}
      </View>
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentContainerStyle={{ paddingTop: 4 }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}
        {filtered.length === 0 ? (
          <Empty title="No customers" subtitle="Add your first customer to get started." />
        ) : (
          <View style={{ gap: 8 }}>
            {filtered.map((c) => (
              <Card key={c.id} onPress={() => setSelected(c)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cName}>{c.name}</Text>
                    <Text style={styles.cSub}>{c.company ?? c.phone ?? '—'}</Text>
                    <View style={styles.cFooter}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View>
                          <Text style={styles.cLabel}>Credit Limit</Text>
                          <Text style={styles.cValue}>{formatLKR(c.credit_limit)}</Text>
                        </View>
                        <View>
                          <Text style={styles.cLabel}>Outstanding</Text>
                          <Text style={[styles.cValue, { color: c.outstanding_balance > 0 ? theme.colors.error : theme.colors.text }]}>{formatLKR(c.outstanding_balance)}</Text>
                        </View>
                      </View>
                      <ChevronRight size={18} color={theme.colors.textMuted} />
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScreenScroll>

      <CustomerDetail customer={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); setShowForm(true); }} canManage={canManage} onRefresh={load} />
      <CustomerForm visible={showForm} customer={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
    </Screen>
  );
}

function CustomerDetail({ customer, onClose, onEdit, canManage, onRefresh }: {
  customer: Customer | null;
  onClose: () => void;
  onEdit: () => void;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [invoices, setInvoices] = useState<(Invoice & { payments?: Payment[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    supabase
      .from('invoices')
      .select('*, payments(*)')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setInvoices((data as (Invoice & { payments?: Payment[] })[]) ?? []);
        setLoading(false);
      });
  }, [customer]);

  if (!customer) return null;
  const totalOutstanding = invoices.filter((i) => i.payment_status !== 'paid').reduce((s, i) => s + Number(i.balance), 0);

  const recordPayment = async () => {
    setErr(null);
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { setErr('Enter a valid amount.'); return; }
    // pay oldest unpaid invoices first
    let remaining = amt;
    for (const inv of invoices.filter((i) => i.payment_status !== 'paid')) {
      if (remaining <= 0) break;
      const pay = Math.min(remaining, Number(inv.balance));
      remaining -= pay;
      const newPaid = Number(inv.paid_amount) + pay;
      const newBal = Number(inv.balance) - pay;
      const status = newBal <= 0.01 ? 'paid' : 'partial';
      await supabase.from('invoices').update({ paid_amount: newPaid, balance: newBal, payment_status: status }).eq('id', inv.id);
      await supabase.from('payments').insert({ invoice_id: inv.id, customer_id: customer.id, amount: pay, method: payMethod });
    }
    await supabase.from('customers').update({ outstanding_balance: Math.max(0, customer.outstanding_balance - amt) }).eq('id', customer.id);
    setShowPay(false);
    setPayAmount('');
    onRefresh();
    onClose();
  };

  return (
    <Modal visible={!!customer} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{customer.name}</Text>
              <Text style={styles.detailSub}>{customer.company ?? 'Individual'}</Text>
            </View>
            <Pressable onPress={onClose}><X size={22} color={theme.colors.text} /></Pressable>
          </View>

          <View style={styles.contactRow}>
            {customer.phone && <View style={styles.contactItem}><Phone size={15} color={theme.colors.textMuted} /><Text style={styles.contactText}>{customer.phone}</Text></View>}
            {customer.email && <View style={styles.contactItem}><Mail size={15} color={theme.colors.textMuted} /><Text style={styles.contactText}>{customer.email}</Text></View>}
          </View>

          <View style={styles.balanceRow}>
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Outstanding</Text>
              <Text style={[styles.balanceValue, { color: totalOutstanding > 0 ? theme.colors.error : theme.colors.primary[700] }]}>{formatLKR(totalOutstanding)}</Text>
            </View>
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Credit Limit</Text>
              <Text style={styles.balanceValue}>{formatLKR(customer.credit_limit)}</Text>
            </View>
          </View>

          {totalOutstanding > 0 && (
            <Button title="Record Payment" variant="gold" onPress={() => setShowPay(true)} fullWidth style={{ marginTop: 12 }} />
          )}
          {canManage && <Button title="Edit Customer" variant="outline" onPress={onEdit} fullWidth style={{ marginTop: 8 }} />}

          <Text style={styles.itemsTitle}>Recent Invoices</Text>
          {loading ? (
            <Text style={styles.loadingText}>Loading…</Text>
          ) : invoices.length === 0 ? (
            <Text style={styles.emptyText}>No invoices yet.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ gap: 6 }}>
              {invoices.map((inv) => (
                <View key={inv.id} style={styles.invRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invNo}>{inv.invoice_number}</Text>
                    <Text style={styles.invDate}>{formatDate(inv.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.invTotal}>{formatLKR(inv.total)}</Text>
                    <Badge label={inv.payment_status} color={inv.payment_status === 'paid' ? '#059669' : inv.payment_status === 'partial' ? '#f59e0b' : '#dc2626'} />
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>

      <Modal visible={showPay} animationType="fade" transparent onRequestClose={() => setShowPay(false)}>
        <View style={styles.modalOverlay}>
          <Card style={styles.payCard}>
            <Text style={styles.payTitle}>Record Payment</Text>
            <Text style={styles.payCaption}>{customer.name} — {formatLKR(totalOutstanding)} outstanding</Text>
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
            {err && <View style={{ marginTop: 8 }}><ErrorBox message={err} /></View>}
            <Button title="Save Payment" onPress={recordPayment} fullWidth style={{ marginTop: 14 }} />
          </Card>
        </View>
      </Modal>
    </Modal>
  );
}

function CustomerForm({ visible, customer, onClose, onSaved }: { visible: boolean; customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(customer?.name ?? '');
      setPhone(customer?.phone ?? '');
      setEmail(customer?.email ?? '');
      setCompany(customer?.company ?? '');
      setCreditLimit(String(customer?.credit_limit ?? '0'));
      setNotes(customer?.notes ?? '');
      setErr(null);
    }
  }, [visible, customer]);

  const save = async () => {
    setErr(null);
    if (!name.trim()) { setErr('Name is required.'); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      company: company.trim() || null,
      credit_limit: Number(creditLimit) || 0,
      notes: notes.trim() || null,
      active: true,
    };
    const { error } = customer
      ? await supabase.from('customers').update(payload).eq('id', customer.id)
      : await supabase.from('customers').insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Card style={styles.formCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.formTitle}>{customer ? 'Edit Customer' : 'New Customer'}</Text>
            <Pressable onPress={onClose}><X size={22} color={theme.colors.text} /></Pressable>
          </View>
          {err && <View style={{ marginBottom: 10 }}><ErrorBox message={err} /></View>}
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }}>
            <Field label="Name" value={name} onChangeText={setName} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field label="Phone" value={phone} onChangeText={setPhone} flex />
              <Field label="Company" value={company} onChangeText={setCompany} flex />
            </View>
            <Field label="Email" value={email} onChangeText={setEmail} />
            <Field label="Credit Limit (LKR)" value={creditLimit} onChangeText={setCreditLimit} keyboardType="numeric" />
          </ScrollView>
          <Button title={customer ? 'Save Changes' : 'Create Customer'} onPress={save} loading={saving} fullWidth style={{ marginTop: 14 }} />
        </Card>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChangeText, keyboardType, flex }: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric'; flex?: boolean }) {
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
  cName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  cSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  cFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cLabel: { fontSize: 11, color: theme.colors.textMuted },
  cValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '92%' },
  formCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '92%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailName: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
  detailSub: { fontSize: 14, color: theme.colors.textMuted, marginTop: 2 },
  contactRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 14, color: theme.colors.text },
  balanceRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  balanceBox: { flex: 1, backgroundColor: theme.colors.neutral[50], borderRadius: 12, padding: 12 },
  balanceLabel: { fontSize: 12, color: theme.colors.textMuted },
  balanceValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  itemsTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  loadingText: { fontSize: 14, color: theme.colors.textMuted },
  emptyText: { fontSize: 14, color: theme.colors.textMuted },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  invNo: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  invDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  invTotal: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  formTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.neutral[50] },
  payCard: { borderRadius: 20, padding: 20, paddingBottom: 28 },
  payTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  payCaption: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, marginBottom: 14 },
  methodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  methodChipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  methodText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  methodTextActive: { color: theme.colors.white },
});
