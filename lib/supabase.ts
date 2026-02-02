import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Get Supabase client with anon key (respects RLS)
 */
export function getSupabaseClient() {
  if (!supabaseUrl) throw new Error('Missing Supabase URL');
  if (!supabaseAnonKey) throw new Error('Missing Supabase anon key');
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get Supabase client with service role key (bypasses RLS)
 * Use ONLY for admin operations
 */
export function getSupabaseServiceClient() {
  if (!supabaseUrl) throw new Error('Missing Supabase URL');
  if (!supabaseServiceKey) throw new Error('Missing Supabase service role key');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function hasSupabaseServiceRoleKey() {
  return !!supabaseUrl && !!supabaseServiceKey;
}

export function getSupabaseAuthedClient(accessToken: string) {
  if (!supabaseUrl) throw new Error('Missing Supabase URL');
  if (!supabaseAnonKey) throw new Error('Missing Supabase anon key');
  if (!accessToken) throw new Error('Missing access token');

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Export singleton for auth operations
export const supabase = getSupabaseClient();
