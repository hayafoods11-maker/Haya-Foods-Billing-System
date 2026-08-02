import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing Supabase configuration. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
    : null;

export const supabase = createClient(
  (supabaseUrl as string) ?? 'https://placeholder.supabase.co',
  (supabaseAnonKey as string) ?? 'placeholder-anon-key',
  {
    auth: {
      // Billing access is deliberately limited to the current browser session.
      // Refreshing or reopening the app requires the staff member to sign in again.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
