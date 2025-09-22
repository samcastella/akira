// src/lib/supabaseClient.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

/** ¿Existen las env públicas de Supabase en esta build/preview? */
export function isSupabaseEnvReady(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getEnvOrThrow() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Supabase no configurado (faltan env NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }
  return { url, anon };
}

/** Storage seguro: evita crash si localStorage no está disponible (Safari/privado) */
function getSafeStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const k = '__supa_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    // Fallback en memoria (no persistente, pero no rompe)
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => void mem.clear(),
      key: (i: number) => Array.from(mem.keys())[i] ?? null,
      get length() {
        return mem.size;
      },
    } as unknown as Storage;
  }
}

function makeBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('makeBrowserClient() sólo puede usarse en el navegador.');
  }
  const { url, anon } = getEnvOrThrow();

  const options: SupabaseClientOptions<'public'> = {
    auth: {
      // Mantiene sesión y refresh en el cliente; con @supabase/ssr los
      // cambios de sesión se reflejan en cookies (vía helpers/middleware).
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // útil para /auth/recovery (hash)
      flowType: 'pkce',
      storageKey: 'akira.auth',
      storage: getSafeStorage(),
    },
  };

  return createBrowserClient(url, anon, options);
}

/** Singleton en navegador */
export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getSupabase() sólo puede usarse en Client Components.');
  }
  const g = globalThis as any;
  if (!g.__akira_supabase__) {
    g.__akira_supabase__ = makeBrowserClient();
  }
  return g.__akira_supabase__ as SupabaseClient;
}

/**
 * Proxy para poder importar `supabase` directamente sin instanciar dos veces:
 * Delegamos dinámicamente al singleton.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    // @ts-expect-error delegación dinámica de propiedades/métodos
    return c[prop];
  },
});
