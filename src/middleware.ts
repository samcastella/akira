// src/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Ejecuta en (casi) todo excepto estáticos e imágenes */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)',
  ],
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(url, anon, {
    cookies: {
      // En middleware debemos implementar getAll/setAll
      getAll() {
        // Next 13/14: devuelve { name, value }[]
        return req.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookies) {
        // Escribimos todas las cookies en la respuesta
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // Esta llamada refresca/valida cookies si hace falta
  await supabase.auth.getUser();

  return res;
}
