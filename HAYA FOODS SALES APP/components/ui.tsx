import { type ReactNode, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
  type ViewStyle,
} from 'react-native';
import { theme } from '@/lib/theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={{ flex: 1, backgroundColor: theme.colors.background }}>{children}</View>;
}

export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentContainerStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: ViewStyle;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: theme.spacing.md, ...contentContainerStyle }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.sm },
          pressed && { opacity: 0.85 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[{ backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.sm }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm, marginTop: theme.spacing.sm }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text }}>{children}</Text>
      {action}
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'gold' | 'outline' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, fullWidth }: ButtonProps) {
  const bg =
    variant === 'primary' ? theme.colors.primary[700] :
    variant === 'gold' ? theme.colors.gold[500] :
    variant === 'danger' ? theme.colors.error :
    variant === 'ghost' ? 'transparent' : theme.colors.card;
  const fg = variant === 'outline' || variant === 'ghost' ? theme.colors.primary[700] : theme.colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: theme.radius.md,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: theme.colors.primary[700],
        },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
        fullWidth && { width: '100%' },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: `${color}1a`, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Stat({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tint?: string;
}) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, color: theme.colors.textMuted, fontWeight: '500' }}>{label}</Text>
        {icon && <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (tint ?? theme.colors.primary[700]) + '1a', alignItems: 'center', justifyContent: 'center' }}>{icon}</View>}
      </View>
      <Text style={{ fontSize: 22, fontWeight: '700', color: tint ?? theme.colors.text, marginTop: 8 }}>{value}</Text>
    </Card>
  );
}

export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.neutral[100], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 28 }}>—</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text, textAlign: 'center' }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4 }}>{subtitle}</Text>}
    </View>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={{ backgroundColor: '#fef2f2', borderRadius: theme.radius.md, padding: 16, borderWidth: 1, borderColor: '#fecaca' }}>
      <Text style={{ color: theme.colors.error, fontSize: 14, fontWeight: '500' }}>{message}</Text>
    </View>
  );
}

export function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
      <ActivityIndicator size="large" color={theme.colors.primary[700]} />
    </View>
  );
}

export function useRefresh(fetch: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch();
    } finally {
      setRefreshing(false);
    }
  }, [fetch]);
  return { refreshing, onRefresh };
}
