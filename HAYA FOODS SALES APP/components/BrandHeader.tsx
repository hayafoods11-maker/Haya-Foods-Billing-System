import { theme } from '@/lib/theme';
import { roleLabel } from '@/lib/format';
import type { Role } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { View, Text, StyleSheet } from 'react-native';
import { Leaf } from 'lucide-react-native';

export function BrandHeader({ subtitle }: { subtitle?: string }) {
  const { staff } = useAuth();
  return (
    <View style={styles.header}>
      <View style={styles.logo}>
        <Leaf size={22} color={theme.colors.white} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>Haya Foods</Text>
        <Text style={styles.sub}>{subtitle ?? 'Sales & Inventory'}</Text>
      </View>
      {staff && <RoleChip role={staff.role} />}
    </View>
  );
}

function RoleChip({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    admin: '#7c3aed',
    manager: '#2563eb',
    cashier: '#059669',
    sales_rep: '#d97706',
    delivery: '#dc2626',
  };
  return (
    <View style={[styles.chip, { backgroundColor: colors[role] + '22' }]}>
      <View style={[styles.dot, { backgroundColor: colors[role] }]} />
      <Text style={[styles.chipText, { color: colors[role] }]}>{roleLabel[role]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 19, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.2 },
  sub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontWeight: '500' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
