import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigError } from './supabase';
import type { Staff, Role } from './types';

interface AuthContextValue {
  session: Session | null;
  staff: Staff | null;
  loading: boolean;
  role: Role | null;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  // If Supabase env vars are missing, never leave loading=true forever.
  useEffect(() => {
    if (supabaseConfigError) {
      setLoading(false);
    }
  }, []);

  const loadStaff = async (uid: string): Promise<Staff | null> => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      setStaff(null);
      return null;
    }
    const profile = data as Staff | null;
    setStaff(profile);
    return profile;
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadStaff(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => {
          await loadStaff(newSession.user.id);
          setLoading(false);
        })();
      } else {
        setStaff(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Could not complete sign-in. Please try again.' };
    const profile = await loadStaff(data.user.id);
    if (!profile) {
      return { error: 'Your account signed in, but no active staff profile was found. Ask an administrator to create or activate it.' };
    }
    if (!profile.active) return { error: 'This staff account is inactive. Ask an administrator to activate it.' };
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role: 'admin' } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await loadStaff(data.user.id);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStaff(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        staff,
        loading,
        role: staff?.role ?? null,
        configError: supabaseConfigError,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
