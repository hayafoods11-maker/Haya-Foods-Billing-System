import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Archive, BarChart3, ChevronRight, Settings, Truck, Users } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { BrandHeader } from '@/components/BrandHeader';
import { Card, Screen, ScreenScroll } from '@/components/ui';

export default function MoreScreen() {
  const { staff } = useAuth();
  const isAdmin = staff?.role === 'admin';
  const items = [
    { label: 'Inventory', subtitle: 'Stock, batches and adjustments', icon: Archive, route: '/inventory', show: true },
    { label: 'Customers', subtitle: 'Customer accounts and balances', icon: Users, route: '/customers', show: true },
    { label: 'Deliveries', subtitle: 'Delivery assignments and status', icon: Truck, route: '/deliveries', show: true },
    { label: 'Reports', subtitle: 'Sales and business reports', icon: BarChart3, route: '/reports', show: true },
    { label: 'Settings', subtitle: 'Company settings and staff', icon: Settings, route: '/settings', show: isAdmin },
  ];

  return (
    <Screen>
      <BrandHeader subtitle="More" />
      <ScreenScroll>
        <Text style={styles.intro}>Manage the rest of your business tools.</Text>
        <View style={{ gap: 10 }}>
          {items.filter((item) => item.show).map((item) => {
            const Icon = item.icon;
            return <Card key={item.label} onPress={() => router.push(item.route as never)} style={styles.item}>
              <View style={styles.icon}><Icon size={21} color={theme.colors.primary[700]} /></View>
              <View style={{ flex: 1 }}><Text style={styles.title}>{item.label}</Text><Text style={styles.subtitle}>{item.subtitle}</Text></View>
              <ChevronRight size={20} color={theme.colors.textMuted} />
            </Card>;
          })}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: theme.colors.textMuted, fontSize: 14, marginBottom: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
});
