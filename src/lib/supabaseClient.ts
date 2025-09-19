// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** ¿Hay env públicas de Supabase en esta build? */
export function isSupabaseEnvReady(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** Cliente real de Supabase (sólo navegador) */
function makeRealClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });
}

/** Cliente deshabilitado: no lanza al importar; rechaza llamadas cuando se usan */
function makeDisabledClient(): SupabaseClient {
  const msg = 'Supabase no configurado (faltan env públicas NEXT_PUBLIC_SUPABASE_*)';
  const handler: ProxyHandler<any> = {
    get(_t, prop) {
      // Para inspecciones
      if (prop === '__disabled__') return true;
      // Cualquier método devuelve una función async que rechaza
      return (_: any) => {
        if (typeof console !== 'undefined') {
          console.warn('[supabase] cliente deshabilitado:', String(prop), '→', msg);
        }
        const err = new Error(msg);
        // Simula API async
        return Promise.reject(err);
      };
    },
  };
  return new Proxy({} as SupabaseClient, handler);
}

let _client: SupabaseClient | null = null;

/** Singleton seguro: nunca lanza. Si no hay ENV, devuelve cliente deshabilitado. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (isSupabaseEnvReady()) {
    _client = makeRealClient();
  } else {
    console.warn('[supabase] Faltan NEXT_PUBLIC_SUPABASE_URL/ANON_KEY en esta build/preview');
    _client = makeDisabledClient();
  }
  return _client;
}

/** Compat: `import { supabase } from '@/lib/supabaseClient'` */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    // @ts-expect-error — delegación dinámica
    return c[prop];
  },
});
