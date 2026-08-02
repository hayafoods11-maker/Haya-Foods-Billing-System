import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import { Search, Plus, X, Pencil, Building2, Receipt, Users } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { roleLabel } from '@/lib/format';
import type { Staff, CompanySettings, Role } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Button, Empty, ErrorBox, Badge } from '@/components/ui';

export default function SettingsScreen() {
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin';
  const [tab, setTab] = useState<'company' | 'staff'>('company');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [sRes, stRes] = await Promise.all([
      supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('staff').select('*').order('created_at', { ascending: false }),
    ]);
    if (sRes.error) { setError('Could not load settings.'); setRefreshing(false); return; }
    setSettings(sRes.data as CompanySettings | null);
    setStaffList((stRes.data as Staff[]) ?? []);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen>
      <BrandHeader subtitle="Settings" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8, paddingTop: 8 }}>
        <TabChip label="Company" icon={<Building2 size={15} color={tab === 'company' ? theme.colors.white : theme.colors.textMuted} />} active={tab === 'company'} onPress={() => setTab('company')} />
        {isAdmin && (
          <TabChip label="Staff & Roles" icon={<Users size={15} color={tab === 'staff' ? theme.colors.white : theme.colors.textMuted} />} active={tab === 'staff'} onPress={() => setTab('staff')} />
        )}
      </ScrollView>

      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} contentContainerStyle={{ paddingTop: 4 }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}
        {tab === 'company' ? (
          <CompanySettingsForm settings={settings} canEdit={isAdmin} onSaved={load} />
        ) : (
          <View style={{ gap: 8 }}>
            <Button title="Add Staff Member" onPress={() => setShowStaffForm(true)} fullWidth style={{ marginBottom: 8 }} />
            {staffList.length === 0 ? (
              <Empty title="No staff yet" />
            ) : (
              staffList.map((s) => (
                <Card key={s.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sName}>{s.full_name}</Text>
                      <Text style={styles.sSub}>{s.email}</Text>
                      <Text style={styles.sSub}>{s.phone ?? 'No phone'}</Text>
                    </View>
                    <Badge label={roleLabel[s.role]} color={s.role === 'admin' ? '#7c3aed' : s.role === 'manager' ? '#2563eb' : s.role === 'cashier' ? '#059669' : s.role === 'sales_rep' ? '#d97706' : '#dc2626'} />
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScreenScroll>

      <StaffInviteModal visible={showStaffForm} onClose={() => setShowStaffForm(false)} onSaved={() => { setShowStaffForm(false); load(); }} />
    </Screen>
  );
}

function TabChip({ label, icon, active, onPress }: { label: string; icon: React.ReactNode; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CompanySettingsForm({ settings, canEdit, onSaved }: { settings: CompanySettings | null; canEdit: boolean; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tax, setTax] = useState('');
  const [prefix, setPrefix] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setName(settings.company_name);
      setAddress(settings.address ?? '');
      setPhone(settings.telephone ?? '');
      setEmail(settings.email ?? '');
      setTax(String(settings.tax_percentage));
      setPrefix(settings.invoice_prefix);
      setCurrency(settings.currency);
    }
  }, [settings]);

  const save = async () => {
    setErr(null);
    setSaving(true);
    const payload = {
      company_name: name.trim(),
      address: address.trim(),
      telephone: phone.trim(),
      email: email.trim(),
      tax_percentage: Number(tax) || 0,
      invoice_prefix: prefix.trim() || 'INV',
      currency: currency.trim() || 'LKR',
    };
    const { error } = await supabase.from('company_settings').update(payload).eq('id', 1);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  };

  if (!settings) return <Empty title="Loading settings…" />;
  return (
    <Card>
      {err && <View style={{ marginBottom: 10 }}><ErrorBox message={err} /></View>}
      {saved && <View style={styles.savedBox}><Text style={styles.savedText}>Saved successfully</Text></View>}
      <Field label="Company Name" value={name} onChangeText={setName} editable={canEdit} />
      <Field label="Address" value={address} onChangeText={setAddress} editable={canEdit} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Telephone" value={phone} onChangeText={setPhone} editable={canEdit} flex />
        <Field label="Email" value={email} onChangeText={setEmail} editable={canEdit} flex />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Tax %" value={tax} onChangeText={setTax} keyboardType="numeric" editable={canEdit} flex />
        <Field label="Invoice Prefix" value={prefix} onChangeText={setPrefix} editable={canEdit} flex />
      </View>
      <Field label="Currency" value={currency} onChangeText={setCurrency} editable={canEdit} />
      {canEdit && <Button title="Save Settings" onPress={save} loading={saving} fullWidth style={{ marginTop: 12 }} />}
      {!canEdit && <Text style={styles.readOnlyNote}>Only admins can edit company settings.</Text>}
    </Card>
  );
}

function StaffInviteModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { staff } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setName(''); setEmail(''); setPassword(''); setRole('cashier'); setPhone(''); setErr(null); }
  }, [visible]);

  const create = async () => {
    setErr(null);
    if (!name.trim() || !email.trim() || !password) { setErr('Name, email and password are required.'); return; }
    setSaving(true);
    // sign up a new user; the trigger creates the staff row.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), phone: phone.trim(), role } },
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    if (data.user) {
      // update role in case the first-user logic overrode it
      await supabase.from('staff').update({ role }).eq('id', data.user.id);
    }
    onSaved();
  };

  const roles: Role[] = ['admin', 'manager', 'cashier', 'sales_rep', 'delivery'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Add Staff Member</Text>
            <Pressable onPress={onClose}><X size={22} color={theme.colors.text} /></Pressable>
          </View>
          {err && <View style={{ marginBottom: 10 }}><ErrorBox message={err} /></View>}
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10 }}>
            <Field label="Full Name" value={name} onChangeText={setName} editable />
            <Field label="Email" value={email} onChangeText={setEmail} editable />
            <Field label="Password" value={password} onChangeText={setPassword} editable />
            <Field label="Phone" value={phone} onChangeText={setPhone} editable />
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {roles.map((r) => (
                <Pressable key={r} onPress={() => setRole(r)} style={[styles.chip, role === r && styles.chipActive]}>
                  <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{roleLabel[r]}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Button title="Create Account" onPress={create} loading={saving} fullWidth style={{ marginTop: 14 }} />
        </Card>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChangeText, keyboardType, editable, flex }: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric'; editable?: boolean; flex?: boolean }) {
  return (
    <View style={{ flex: flex ? 1 : undefined, marginBottom: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && { backgroundColor: theme.colors.neutral[100], color: theme.colors.textMuted }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={editable}
        placeholderTextColor={theme.colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary[700], borderColor: theme.colors.primary[700] },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextActive: { color: theme.colors.white },
  sName: { fontSize: 15, fontWeight: '600', color: theme.colors.text },
  sSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.neutral[50] },
  savedBox: { backgroundColor: theme.colors.primary[50], borderRadius: 10, padding: 10, marginBottom: 12 },
  savedText: { color: theme.colors.primary[700], fontSize: 14, fontWeight: '600' },
  readOnlyNote: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  formCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, maxHeight: '92%' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
});
