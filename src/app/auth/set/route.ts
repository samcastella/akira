// src/app/auth/set/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest): Promise<Response> {
  const res = NextResponse.json({ ok: true });

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

  try {
    const body = await req.json().catch(() => ({} as any));
    const { access_token, refresh_token } = body || {};

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: 'Missing tokens' }, { status: 400 });
    }

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    // Éxito: la cookie httpOnly queda fijada en la respuesta
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Bad request' }, { status: 400 });
  }
}
