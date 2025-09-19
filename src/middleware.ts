// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  // refresca/sincroniza cookies de sesión si hace falta
  await supabase.auth.getSession();
  return res;
}

// (opcional) limita rutas:
// export const config = { matcher: ['/', '/(debug|mizona|habitos|auth)/:path*'] };
