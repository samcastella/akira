// lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    'Supabase no configurado: faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

function makeBrowserClient(): SupabaseClient {
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Importante: solo navegador (WhoAmI, login, etc.)
      storage: window.localStorage,
    },
  });
}

/** 
 * Singleton en el navegador. Evita múltiples instancias con HMR
 * que “pierden” la sesión.
 */
export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    // No intentes leer sesión en el server; usa APIs server-side explícitas si hace falta.
    throw new Error(
      'getSupabase() solo puede usarse en el navegador. Importa este módulo solo en Client Components.'
    );
  }
  const g = globalThis as any;
  if (!g.__akira_supabase__) {
    g.__akira_supabase__ = makeBrowserClient();
    // Debug opcional:
    // console.log('[supabase] browser client initialized');
  }
  return g.__akira_supabase__ as SupabaseClient;
}

/**
 * Compat: permite `import { supabase } from "@/lib/supabaseClient"`
 * Delegamos dinámicamente al singleton de navegador.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    // @ts-expect-error delegación dinámica
    return c[prop];
  },
});
