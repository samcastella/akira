// src/lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Crea un cliente de Supabase para Server Components/Route Handlers (App Router)
 * usando el store de cookies de Next. Se debe llamar por request (no singleton).
 */
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const store = await cookies(); // en tu runtime es async

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return store.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        // Nota: en Server Components, Next permite mutar el cookie store
        store.set(name, value, options);
      },
      remove(name: string, options: any) {
        store.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });
}
