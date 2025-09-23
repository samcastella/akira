// src/app/auth/get/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: false }, { status: 401 });
  const reqCookies = await cookies();

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

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return NextResponse.json({ ok: false, error: 'no-session' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}
