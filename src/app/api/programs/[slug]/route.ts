// src/app/api/programs/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loadProgramJson } from '@/lib/programJson';

export const dynamic = 'force-dynamic'; // opcional según tu cacheo
export const revalidate = 0;            // opcional

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params; // 👈 importante
  try {
    const json = await loadProgramJson(slug);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? e ?? 'Failed to load program') },
      { status: 500 }
    );
  }
}
