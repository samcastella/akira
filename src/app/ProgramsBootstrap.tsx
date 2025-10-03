'use client';

import { useEffect } from 'react';

// Tipado mínimo para no depender de tipos externos aquí
type ProgramTask = { id?: string; label: string; detail?: string; tags?: string[] };
type ProgramDef = { slug: string; title: string; days?: { day: number; tasks: ProgramTask[] }[] };

function normalizeSlug(slug: string) {
  return String(slug || '').replace(/-30$/, '');
}

export default function ProgramsBootstrap() {
  useEffect(() => {
    // si ya está indexado, no hacemos nada
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.__PROGRAMS && Object.keys(w.__PROGRAMS || {}).length > 0) {
      return;
    }

    // 1) intentamos cargar el módulo de datos
    (async () => {
      try {
        const mod: any = await import('@/data/programs');
        const src =
          mod?.PROGRAMS ??
          mod?.default ??
          mod?.PROGRAMS_MAP ??
          mod?.PROGRAM_LIST ??
          mod?.programs ??
          null;

        if (!src) return;

        // 2) normalizamos a índice { [slugCanon]: ProgramDef }
        const index: Record<string, ProgramDef> = {};

        if (Array.isArray(src)) {
          for (const p of src as ProgramDef[]) {
            if (p?.slug) index[normalizeSlug(p.slug)] = p;
          }
        } else if (typeof src === 'object') {
          // valores
          for (const v of Object.values(src as Record<string, ProgramDef>)) {
            if ((v as any)?.slug) {
              index[normalizeSlug((v as any).slug)] = v as ProgramDef;
            }
          }
          // claves (por si viene como { 'detox-tecnologico': {...} })
          for (const [k, v] of Object.entries(src as Record<string, ProgramDef>)) {
            if (v) index[normalizeSlug(k)] = (v as ProgramDef);
          }
        }

        // 3) volcamos en window y avisamos
        if (Object.keys(index).length > 0) {
          w.__PROGRAMS = index;
          try { window.dispatchEvent(new Event('akira:programs-updated')); } catch {}
        }
      } catch {
        // si falla el import, lo dejamos en paz (no rompemos la app)
      }
    })();
  }, []);

  return null;
}
