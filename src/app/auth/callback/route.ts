// src/app/auth/callback/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/mizona';

  // Preparamos respuesta de redirección desde YA; iremos añadiendo cookies sobre ella
  const redirectURL =
    redirect.startsWith('http') ? redirect : `${origin.replace(/\/$/, '')}${redirect.startsWith('/') ? '' : '/'}${redirect}`;
  const res = NextResponse.redirect(redirectURL);

  // ⬇️ @supabase/ssr en Route Handlers ahora usa cookies.getAll/setAll
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        // NextRequest.cookies.getAll() → { name, value }[]
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies) {
        // Escribimos todas las cookies en la respuesta que ya vamos a devolver
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Intercambia el code PKCE por sesión (fijará cookies vía setAll)
  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (e) {
      // Si falla el intercambio, seguimos redirigiendo sin sesión
      // (opcional: podrías añadir un query ?auth=error)
      console.warn('[auth/callback] exchangeCodeForSession error:', e);
    }
  }

  return res;
}
