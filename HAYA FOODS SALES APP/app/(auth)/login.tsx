import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Leaf, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Button, ErrorBox } from '@/components/ui';

export default function LoginScreen() {
  const { signIn, signUp, configError, session, staff } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowSignup, setAllowSignup] = useState(false);

  useEffect(() => {
    supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (!error) {
          setAllowSignup((count ?? 0) === 0);
        }
      });
  }, []);

  // Authentication and the staff profile are loaded separately. Navigate only
  // after both are ready so the tabs do not briefly redirect back to login.
  useEffect(() => {
    if (session && staff) {
      router.replace('/(tabs)');
    }
  }, [router, session, staff]);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    if (mode === 'signup' && !allowSignup) {
      setError('Sign up is only available for the first admin account.');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error);
      } else {
        const { error } = await signUp(email.trim(), password, fullName.trim(), phone.trim());
        if (error) setError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Leaf size={32} color={theme.colors.white} strokeWidth={2.4} />
          </View>
          <Text style={styles.brand}>Haya Foods</Text>
          <Text style={styles.tagline}>Sales, Billing, Inventory & Delivery</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Use your staff account to continue.'
              : 'The first account becomes the admin.'}
          </Text>

          {configError && <View style={{ marginBottom: 12 }}><ErrorBox message={configError} /></View>}
          {error && <View style={{ marginBottom: 12 }}><ErrorBox message={error} /></View>}

          {mode === 'signup' && (
            <Field
              icon={<User size={18} color={theme.colors.textMuted} />}
              placeholder="Full name"
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <Field
            icon={<Mail size={18} color={theme.colors.textMuted} />}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Field
            icon={<Lock size={18} color={theme.colors.textMuted} />}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            trailing={
              <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={8}>
                {showPwd ? <EyeOff size={18} color={theme.colors.textMuted} /> : <Eye size={18} color={theme.colors.textMuted} />}
              </Pressable>
            }
          />

          {mode === 'signup' && (
            <Field
              icon={<Phone size={18} color={theme.colors.textMuted} />}
              placeholder="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          )}

          <View style={{ height: 20 }} />
          <Button title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={loading} fullWidth />

          {allowSignup ? (
            <Pressable
              onPress={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              style={{ alignSelf: 'center', marginTop: 16 }}
            >
              <Text style={styles.switch}>
                {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.switch, { color: theme.colors.textMuted, marginTop: 16, textAlign: 'center' }]}>Sign up is disabled after the first admin account is created.</Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  trailing,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.field}>
        {icon}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor={theme.colors.textMuted}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 40, marginBottom: 28 },
  logoWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: theme.colors.primary[700],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  brand: { fontSize: 26, fontWeight: '800', color: theme.colors.primary[800] },
  tagline: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: theme.colors.card, borderRadius: 20, padding: 22,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.md,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4, marginBottom: 18 },
  fieldWrap: { marginBottom: 12 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.neutral[50], borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: theme.colors.border,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: theme.colors.text },
  switch: { fontSize: 14, color: theme.colors.primary[700], fontWeight: '600' },
});
