// src/app/ProgramsBootstrap.tsx
'use client';

import { useEffect } from 'react';
import {
  AVAILABLE_PROGRAM_SLUGS,
  PROGRAM_SLUG_ALIASES,
  getProgramMeta,
} from '@/data/programs';
import { loadProgramJson } from '@/lib/programJson';

declare global {
  interface Window {
    __PROGRAMS_SLUGS?: string[];
    __PROGRAMS_ALIASES?: Record<string, string>;
    __PROGRAMS_META?: Record<
      string,
      { title: string; days: number; themeColor?: string }
    >;
    __loadProgramJson?: typeof loadProgramJson;
  }
}

export default function ProgramsBootstrap() {
  useEffect(() => {
    // 1) Slugs disponibles (canónicos)
    window.__PROGRAMS_SLUGS = Array.from(AVAILABLE_PROGRAM_SLUGS);

    // 2) Aliases legacy -> canónico
    window.__PROGRAMS_ALIASES = PROGRAM_SLUG_ALIASES;

    // 3) Metadatos ligeros para UI/inspección (sin days/tasks)
    const meta: Record<string, { title: string; days: number; themeColor?: string }> = {};
    for (const slug of AVAILABLE_PROGRAM_SLUGS) {
      const m = getProgramMeta(slug);
      if (m) meta[slug] = { title: m.titleShort, days: m.days, themeColor: m.themeColor };
    }
    window.__PROGRAMS_META = meta;

    // 4) (Opcional) puntero al loader fresh-first para debug manual en consola:
    //    await window.__loadProgramJson?.('detox-tecnologico')
    window.__loadProgramJson = loadProgramJson;

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[ProgramsBootstrap] slugs cargados:', window.__PROGRAMS_SLUGS);
    }

    window.dispatchEvent(new Event('akira:programs-updated'));
  }, []);

  return null;
}
