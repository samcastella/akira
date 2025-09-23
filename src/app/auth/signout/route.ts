// Server sign-out: limpia la cookie httpOnly sb-*-auth-token
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function POST() {
  // Usamos la API moderna de @supabase/ssr (getAll/setAll)
  const reqCookies = await cookies();
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return reqCookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  // Esto elimina la sesión y, MUY IMPORTANTE, instruye a setAll() a borrar la cookie httpOnly
  await supabase.auth.signOut();

  return res;
}
