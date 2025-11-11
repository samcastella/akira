// src/app/api/programs/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';         // necesitamos Node (fs/require)
export const dynamic = 'force-dynamic';  // sin caché en el edge/CDN
export const revalidate = 0;             // no ISR

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> } // 👈 en Next 15 es Promise
) {
  try {
    const { slug } = await context.params; // 👈 hay que hacer await

    // 1) Intento de require desde src (bundle del servidor)
    try {
      // @ts-ignore
      const mod = require(`@/data/programs/${slug}.json`);
      const json = mod?.default ?? mod;
      return NextResponse.json(json, {
        headers: { 'Cache-Control': 'no-store, no-transform' },
      });
    } catch {
      // 2) Fallback a /public (por si mueves los JSON ahí)
      //    Nota: en runtime node podemos leer con fetch absoluto a la propia app
      const url = new URL(`/data/programs/${slug}.json`, _req.url);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Program "${slug}" not found` },
          { status: 404 }
        );
      }
      const json = await res.json();
      return NextResponse.json(json, {
        headers: { 'Cache-Control': 'no-store, no-transform' },
      });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    );
  }
}
