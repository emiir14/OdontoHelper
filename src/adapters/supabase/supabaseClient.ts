import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

function readEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return (env?.[key] || '').trim();
  } catch {
    return '';
  }
}

export function isSupabaseConfigured(): boolean {
  const url = readEnv('VITE_SUPABASE_URL');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) return false;
  if (url.includes('tu-proyecto.supabase.co') || anonKey.includes('tu_supabase_anon_key')) {
    return false;
  }
  return url.startsWith('https://') || url.startsWith('http://');
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(
      readEnv('VITE_SUPABASE_URL'),
      readEnv('VITE_SUPABASE_ANON_KEY'),
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return cachedClient;
}
