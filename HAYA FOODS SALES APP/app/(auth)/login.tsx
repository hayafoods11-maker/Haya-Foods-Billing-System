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
  type TextInputProps,
} from 'react-native';
import { Leaf, Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Button, ErrorBox } from '@/components/ui';

const SAVED_EMAIL_KEY = 'haya-foods.saved-login-email';

function getSavedEmail() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SAVED_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveEmail(email: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_EMAIL_KEY, email);
  } catch {
    // The app remains fully usable if browser storage is unavailable.
  }
}

export default function LoginScreen() {
  const { signIn, signUp, configError, session, staff } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState(getSavedEmail);
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

  // Supabase opens the app with this event after a valid recovery-email link.
  // Keeping the reset form on the same /login route also works with Vercel's
  // web deployment and avoids a missing-route error on refresh.
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
        setError(null);
        setPassword('');
      }
    });
    return () => subscription.subscription.unsubscribe();
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
    if (!email.trim() && mode !== 'reset') {
      setError('Please enter your email address.');
      return;
    }
    if ((mode === 'login' || mode === 'signup' || mode === 'reset') && !password) {
      setError('Please enter a password.');
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
      if (mode === 'forgot') {
        const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/login`
          : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) {
          setError(error.message);
        } else {
          setError('Password reset link sent. Open the newest email, then set your new password here.');
        }
      } else if (mode === 'reset') {
        if (password.length < 6) {
          setError('Your new password must be at least 6 characters long.');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setError(error.message);
        } else {
          setPassword('');
          setMode('login');
          setError('Password updated. You can now sign in.');
        }
      } else if (mode === 'login') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setError(error);
        } else {
          // Remember only the email. The password is never stored by the app.
          saveEmail(email.trim());
        }
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
          <Text style={styles.title}>
            {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Choose a new password'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Use your staff account to continue.'
              : mode === 'signup'
                ? 'The first account becomes the admin.'
                : mode === 'forgot'
                  ? 'We will send a secure password-reset link to your email.'
                  : 'Enter a new password for your admin account.'}
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

          {mode !== 'reset' && (
            <Field
              icon={<Mail size={18} color={theme.colors.textMuted} />}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          )}

          {mode !== 'forgot' && (
            <Field
              icon={<Lock size={18} color={theme.colors.textMuted} />}
              placeholder={mode === 'reset' ? 'New password' : 'Password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              trailing={
                <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={8}>
                  {showPwd ? <EyeOff size={18} color={theme.colors.textMuted} /> : <Eye size={18} color={theme.colors.textMuted} />}
                </Pressable>
              }
            />
          )}

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
          <Button
            title={mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Save new password'}
            onPress={submit}
            loading={loading}
            fullWidth
          />

          {mode === 'login' && (
            <Pressable onPress={() => { setMode('forgot'); setError(null); setPassword(''); }} style={{ alignSelf: 'center', marginTop: 16 }}>
              <Text style={styles.switch}>Forgot password?</Text>
            </Pressable>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <Pressable onPress={() => { setMode('login'); setError(null); setPassword(''); }} style={{ alignSelf: 'center', marginTop: 16 }}>
              <Text style={styles.switch}>Back to sign in</Text>
            </Pressable>
          )}

          {mode === 'login' && (
            <View style={styles.securityNote}>
              <ShieldCheck size={16} color={theme.colors.primary[700]} />
              <Text style={styles.securityText}>Your email can be remembered on this device. For security, you must select Sign in every time.</Text>
            </View>
          )}

          {allowSignup && (mode === 'login' || mode === 'signup') ? (
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
  autoComplete,
  textContentType,
  trailing,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
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
          autoComplete={autoComplete}
          textContentType={textContentType}
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
  securityNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: theme.colors.primary[50] },
  securityText: { flex: 1, fontSize: 12, lineHeight: 18, color: theme.colors.primary[800] },
  switch: { fontSize: 14, color: theme.colors.primary[700], fontWeight: '600' },
});
