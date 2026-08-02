import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { MapPin, Phone, Navigation, Check, X, Package, Clock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { formatLKR, formatDateTime, deliveryStatusLabel, deliveryStatusColor } from '@/lib/format';
import type { DeliveryWithOrder, Delivery, DeliveryStatus } from '@/lib/types';
import { BrandHeader } from '@/components/BrandHeader';
import { Screen, ScreenScroll, Card, Button, Empty, ErrorBox, Badge } from '@/components/ui';

export default function DeliveriesScreen() {
  const { staff } = useAuth();
  const [deliveries, setDeliveries] = useState<(DeliveryWithOrder & { order?: { order_number: string; total: number; payment_method: string | null } })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<typeof deliveries[number] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    let q = supabase
      .from('deliveries')
      .select('*, order:orders(order_number, total, payment_method)')
      .order('created_at', { ascending: false });
    if (staff?.role === 'delivery') {
      q = q.eq('driver_id', staff.id);
    }
    const { data, error } = await q.limit(40);
    if (error) { setError('Could not load deliveries.'); setRefreshing(false); return; }
    setDeliveries((data as unknown as typeof deliveries) ?? []);
    setRefreshing(false);
  }, [staff?.id, staff?.role]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: DeliveryStatus, notes?: string) => {
    const payload: Partial<Delivery> = { status };
    if (status === 'delivered') payload.delivered_at = new Date().toISOString();
    if (notes) payload.notes = notes;
    const { error } = await supabase.from('deliveries').update(payload).eq('id', id);
    if (error) { setError('Could not update delivery.'); return; }
    if (status === 'delivered') {
      const d = deliveries.find((x) => x.id === id);
      if (d?.order_id) {
        await supabase.from('orders').update({ status: 'delivered' }).eq('id', d.order_id);
      }
    } else if (status === 'out_for_delivery') {
      const d = deliveries.find((x) => x.id === id);
      if (d?.order_id) {
        await supabase.from('orders').update({ status: 'out_for_delivery' }).eq('id', d.order_id);
      }
    }
    setSelected(null);
    load();
  };

  return (
    <Screen>
      <BrandHeader subtitle="Deliveries" />
      <ScreenScroll refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}>
        {error && <View style={{ marginBottom: 8 }}><ErrorBox message={error} /></View>}
        {deliveries.length === 0 ? (
          <Empty title="No deliveries" subtitle="Assigned deliveries will appear here." />
        ) : (
          <View style={{ gap: 8 }}>
            {deliveries.map((d) => (
              <Card key={d.id} onPress={() => setSelected(d)}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{d.customer_name ?? '—'}</Text>
                    <Text style={styles.ordNo}>{d.order?.order_number ?? '—'}</Text>
                    <View style={styles.infoRow}>
                      <MapPin size={14} color={theme.colors.textMuted} />
                      <Text style={styles.infoText} numberOfLines={2}>{d.address ?? 'No address'}</Text>
                    </View>
                    {d.phone && (
                      <View style={styles.infoRow}>
                        <Phone size={14} color={theme.colors.textMuted} />
                        <Text style={styles.infoText}>{d.phone}</Text>
                      </View>
                    )}
                    <View style={styles.footerRow}>
                      <Badge label={deliveryStatusLabel[d.status]} color={deliveryStatusColor[d.status]} />
                      <Text style={styles.amount}>{d.order ? formatLKR(d.order.total) : ''}</Text>
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
                <Text style={styles.detailTitle}>{selected.customer_name ?? 'Delivery'}</Text>
                <Pressable onPress={() => setSelected(null)}><X size={22} color={theme.colors.text} /></Pressable>
              </View>
              <Badge label={deliveryStatusLabel[selected.status]} color={deliveryStatusColor[selected.status]} />

              <View style={styles.detailBlock}>
                <View style={styles.infoRow}><MapPin size={16} color={theme.colors.textMuted} /><Text style={styles.detailText}>{selected.address ?? 'No address'}</Text></View>
                {selected.phone && <View style={styles.infoRow}><Phone size={16} color={theme.colors.textMuted} /><Text style={styles.detailText}>{selected.phone}</Text></View>}
                {selected.notes && <View style={styles.infoRow}><Clock size={16} color={theme.colors.textMuted} /><Text style={styles.detailText}>{selected.notes}</Text></View>}
                <View style={styles.infoRow}><Package size={16} color={theme.colors.textMuted} /><Text style={styles.detailText}>{selected.order?.order_number ?? '—'} · {selected.order ? formatLKR(selected.order.total) : ''}</Text></View>
                <Text style={styles.createdText}>Created {formatDateTime(selected.created_at)}</Text>
              </View>

              {selected.status === 'pending' && (
                <Button title="Start Delivery" onPress={() => updateStatus(selected.id, 'out_for_delivery')} fullWidth />
              )}
              {selected.status === 'out_for_delivery' && (
                <View style={{ gap: 10 }}>
                  <Button title="Mark Delivered" variant="primary" onPress={() => updateStatus(selected.id, 'delivered')} fullWidth />
                  <Button title="Mark Failed" variant="danger" onPress={() => updateStatus(selected.id, 'failed')} fullWidth />
                </View>
              )}
              {(selected.status === 'delivered' || selected.status === 'failed') && (
                <View style={styles.doneBox}>
                  <Check size={18} color={selected.status === 'delivered' ? theme.colors.primary[700] : theme.colors.error} />
                  <Text style={styles.doneText}>This delivery is {deliveryStatusLabel[selected.status].toLowerCase()}.</Text>
                </View>
              )}
            </Card>
          </View>
        )}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  custName: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  ordNo: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  infoText: { fontSize: 13, color: theme.colors.text, flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  amount: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
  detailBlock: { marginTop: 16, marginBottom: 16, gap: 4 },
  detailText: { fontSize: 15, color: theme.colors.text, flex: 1 },
  createdText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },
  doneBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12, backgroundColor: theme.colors.neutral[50], borderRadius: 12 },
  doneText: { fontSize: 14, color: theme.colors.textMuted, fontWeight: '500' },
});
