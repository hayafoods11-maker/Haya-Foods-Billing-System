import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import * as Lucide from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { ROLE_TABS } from '@/lib/nav';
import { theme } from '@/lib/theme';
import { LoadingScreen } from '@/components/ui';

type IconName = keyof typeof Lucide;

export default function TabsLayout() {
  const { staff, loading } = useAuth();

  useEffect(() => {
    if (!loading && !staff) router.replace('/(auth)/login');
  }, [loading, staff]);

  if (loading || !staff) return <LoadingScreen />;

  const tabs = ROLE_TABS[staff.role] ?? ROLE_TABS.cashier;
  const visibleNames = new Set(tabs.map((t) => t.name));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary[700],
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 66,
          paddingBottom: 8,
          paddingTop: 8,
          ...theme.shadows.md,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIconStyle: { marginBottom: 2 },
      }}
    >
      {tabs.map((t) => {
        const Icon = (Lucide[t.icon as IconName] ?? Lucide.LayoutDashboard) as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
        return (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.label,
              tabBarIcon: ({ color, size }) => <Icon size={size ?? 22} color={color} strokeWidth={2} />,
              headerShown: false,
            }}
          />
        );
      })}

      {/* Hide tab bar entries for screens not in this role's list */}
      <Tabs.Screen name="invoices" options={{ href: visibleNames.has('invoices') ? undefined : null, headerShown: false }} />
      <Tabs.Screen name="inventory" options={{ href: visibleNames.has('inventory') ? undefined : null, headerShown: false }} />
      <Tabs.Screen name="reports" options={{ href: visibleNames.has('reports') ? undefined : null, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ href: visibleNames.has('settings') ? undefined : null, headerShown: false }} />
    </Tabs>
  );
}
