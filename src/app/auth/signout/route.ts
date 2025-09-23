// src/app/auth/signout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// https://<ref>.supabase.co  ->  sb-<ref>-auth-token
function cookieNameFromUrl(u: string) {
  const m = u.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  const ref = m?.[1] ?? '';
  return ref ? `sb-${ref}-auth-token` : null;
}

export async function POST(): Promise<Response> {
  const reqCookies = await cookies();

  // Respuesta base donde @supabase/ssr irá añadiendo Set-Cookie
  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return reqCookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // 1) Sign out vía Supabase (emite Set-Cookie con borrado)
    await supabase.auth.signOut();

    // 2) Defensa extra: borra explícitamente la cookie httpOnly por nombre y path=/
    const cname = cookieNameFromUrl(url);
    if (cname) {
      res.cookies.delete(cname); // path=/ por defecto
      res.cookies.set({
        name: cname,
        value: '',
        path: '/',
        maxAge: 0,
      });
    }

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'signout-failed' },
      { status: 400 }
    );
  }
}
