// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

// ✅ helper público para saber si hay ENV (sin lanzar error)
export function isSupabaseEnvReady() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

const SUPABASE_URL  = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

function makeBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('makeBrowserClient() solo en navegador');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: window.localStorage,
    },
  });
}

/** Singleton en navegador */
export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getSupabase() solo puede usarse en Client Components');
  }
  const g = globalThis as any;
  if (!g.__akira_supabase__) {
    g.__akira_supabase__ = makeBrowserClient();
  }
  return g.__akira_supabase__ as SupabaseClient;
}

/** Compat por si importan `supabase` directamente */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    // @ts-expect-error delegación dinámica
    return c[prop];
  },
});
