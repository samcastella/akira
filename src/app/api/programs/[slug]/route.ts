import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const runtime = 'nodejs'; // fuerza runtime Node en Vercel

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug?.replace(/[^a-z0-9\-]/gi, '');
    if (!slug) return NextResponse.json({ error: 'slug inválido' }, { status: 400 });

    const file = join(process.cwd(), 'src', 'data', 'programs', `${slug}.json`);
    const buf = await readFile(file, 'utf8');

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store', // siempre fresco en cada request
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'not found' }, { status: 404 });
  }
}
