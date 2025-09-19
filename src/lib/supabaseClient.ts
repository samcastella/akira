// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Lee env y permite que falte (soft-fail). */
function envOrNull(name: string): string | null {
  return process.env[name] ?? null;
}

const SUPABASE_URL  = envOrNull('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON = envOrNull('NEXT_PUBLIC_SUPABASE_ANON_KEY');

/** Útil para checks en debug/whoami o logs. */
export function isSupabaseEnvReady(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON;
}

function makeBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('makeBrowserClient() solo en navegador');
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    // Soft-fail: no tumbar la app al cargar, pero dejar rastro claro en consola.
    console.error('[supabase] Faltan NEXT_PUBLIC_SUPABASE_URL/ANON_KEY en esta build/preview');
    throw new Error('Supabase no configurado (faltan env públicas NEXT_PUBLIC_SUPABASE_*)');
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

/** Singleton en navegador (evita sesiones “fantasma” por HMR). */
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

/** Compat: `import { supabase } from "@/lib/supabaseClient"` */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    // @ts-expect-error delegación dinámica
    return c[prop];
  },
});
