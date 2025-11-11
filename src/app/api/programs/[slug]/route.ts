import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> } // Next 15 tipa params como Promise
) {
  try {
    const { slug } = await context.params;

    // Carga el JSON directamente desde el bundle (dinámico) para que recoja lo último
    const mod = await import(`@/data/programs/${slug}.json`).catch(() => null);
    if (!mod) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const data = (mod as any).default ?? mod;

    return NextResponse.json(data, {
      headers: {
        // Evita cualquier caché (navegador, CDN y edge)
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}
