// src/lib/supabaseClient.ts
'use client';

import { createBrowserClient, type SupabaseClient } from '@supabase/ssr';

/** ¿Existen las env públicas de Supabase en esta build/preview? */
export function isSupabaseEnvReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function getEnvOrThrow() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Supabase no configurado (faltan env públicas NEXT_PUBLIC_SUPABASE_*)');
  }
  return { url, anon };
}

/** Cliente de navegador que **sincroniza tokens a cookies** (sb-access-token / sb-refresh-token). */
function makeBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('makeBrowserClient() sólo en navegador');
  }
  const { url, anon } = getEnvOrThrow();

  // `createBrowserClient` maneja persistencia, refresh y *cookies* para SSR/middleware.
  const client = createBrowserClient(url, anon);

  // (Opcional) Debug en dev: poder llamar `supabase.*` desde la consola del navegador.
  if (process.env.NODE_ENV !== 'production') {
    // @ts-expect-error debug helper
    window.supabase = client;
  }

  return client;
}

/** Singleton en navegador; crea el cliente al primer uso */
export function getSupabase(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getSupabase() sólo puede usarse en Client Components');
  }
  const g = globalThis as any;
  if (!g.__akira_supabase__) {
    g.__akira_supabase__ = makeBrowserClient();
  }
  return g.__akira_supabase__ as SupabaseClient;
}

/** Proxy de conveniencia para usar `supabase.*` directamente */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getSupabase();
    // @ts-expect-error delegación dinámica
    return c[prop];
  },
});
