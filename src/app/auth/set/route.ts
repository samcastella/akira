// src/app/auth/set/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Devuelve al cliente access_token/refresh_token leyendo la cookie httpOnly
 * sb-<ref>-auth-token que sólo ve el servidor. Con esto el cliente puede
 * hidratar el SDK (supabase.auth.setSession({...})) y persistir en localStorage.
 */
export async function POST(): Promise<Response> {
  // Respuesta que también usaremos para propagar set-cookies si Supabase las emite
  const res = NextResponse.json({ ok: false }, { status: 401 });

  // En Next 14+, cookies() puede requerir await (edge/runtime modernos)
  const reqCookies = await cookies();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        // Pasamos TODAS las cookies del request al cliente SSR de Supabase
        return reqCookies.getAll();
      },
      setAll(cookiesToSet) {
        // Propaga set-cookie de Supabase a la respuesta (renovaciones, borrados, etc.)
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  // Lee la sesión del servidor (en base a la cookie httpOnly sb-...-auth-token)
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return NextResponse.json({ ok: false, error: 'no-session' }, { status: 401 });
  }

  // Devolvemos tokens para que el cliente haga supabase.auth.setSession(...)
  return NextResponse.json({
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}
