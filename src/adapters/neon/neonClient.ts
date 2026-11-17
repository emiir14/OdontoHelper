import { getSupabaseClient } from '../supabase/supabaseClient';

const NEON_TOKEN_KEY = 'odontohelper_neon_token';
const NEON_USER_EMAIL_KEY = 'odontohelper_neon_email';

export interface BackendHealth {
  ok: boolean;
  neonConfigured: boolean;
  supabaseConfigured: boolean;
  dbProvider: 'supabase' | 'neon' | 'local';
}

let cachedHealth: BackendHealth | null = null;
let healthPromise: Promise<BackendHealth> | null = null;

export function getNeonToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(NEON_TOKEN_KEY);
}

export function getNeonUserEmail(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(NEON_USER_EMAIL_KEY);
}

export function setNeonSession(token: string, email?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(NEON_TOKEN_KEY, token);
  if (email) {
    localStorage.setItem(NEON_USER_EMAIL_KEY, email);
  }
}

export function clearNeonSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(NEON_TOKEN_KEY);
  localStorage.removeItem(NEON_USER_EMAIL_KEY);
}

export async function probeBackendHealth(force = false): Promise<BackendHealth> {
  if (cachedHealth && !force) return cachedHealth;
  if (healthPromise && !force) return healthPromise;

  healthPromise = (async () => {
    try {
      const resp = await fetch('/api/health', { cache: 'no-store' });
      if (!resp.ok) {
        return {
          ok: false,
          neonConfigured: false,
          supabaseConfigured: false,
          dbProvider: 'local',
        };
      }
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          ok: false,
          neonConfigured: false,
          supabaseConfigured: false,
          dbProvider: 'local',
        };
      }
      const data = (await resp.json()) as Partial<BackendHealth>;
      const resolved: BackendHealth = {
        ok: Boolean(data.ok),
        neonConfigured: Boolean(data.neonConfigured),
        supabaseConfigured: Boolean(data.supabaseConfigured),
        dbProvider: data.dbProvider || 'local',
      };
      cachedHealth = resolved;
      return resolved;
    } catch {
      return {
        ok: false,
        neonConfigured: false,
        supabaseConfigured: false,
        dbProvider: 'local',
      };
    } finally {
      healthPromise = null;
    }
  })();

  return healthPromise;
}

export function getPreferredDbProvider(): 'supabase' | 'neon' | 'local' {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const explicit = (env?.VITE_DB_PROVIDER || '').trim().toLowerCase();
    if (explicit === 'neon') return 'neon';
    if (explicit === 'supabase') return 'supabase';
  } catch {
    // ignore
  }
  if (cachedHealth?.neonConfigured && cachedHealth.dbProvider === 'neon') {
    return 'neon';
  }
  if (getNeonToken() && cachedHealth?.neonConfigured) {
    return 'neon';
  }
  return 'local';
}

export function isNeonDatabaseActive(): boolean {
  if (getPreferredDbProvider() === 'neon' && Boolean(getNeonToken())) {
    return true;
  }
  return false;
}

export async function getActiveApiBearerToken(): Promise<string | null> {
  const neonTok = getNeonToken();
  if (neonTok) return neonTok;

  const supabase = getSupabaseClient();
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
  }
  return null;
}

export async function neonFetch<T = unknown>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getActiveApiBearerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error('Respuesta inválida del servidor Vercel.');
  }
  if (!resp.ok) {
    const errMsg = typeof json.error === 'string' ? json.error : `Error HTTP ${resp.status}`;
    throw new Error(errMsg);
  }
  return json as T;
}
