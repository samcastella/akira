// app/ProgramsBootstrap.tsx
'use client';

import { useEffect } from 'react';
import {
  PROGRAM_DEFS_BY_SLUG,
  PROGRAM_SLUG_ALIASES,
  type ProgramDef,
} from '@/data/programs';

declare global {
  interface Window {
    __PROGRAMS?: Record<string, ProgramDef>;
    __PROGRAMS_ALIASES?: Record<string, string>;
  }
}

export default function ProgramsBootstrap() {
  useEffect(() => {
    // Exponemos los programas normalizados (canónicos y legacy)
    window.__PROGRAMS = PROGRAM_DEFS_BY_SLUG;
    window.__PROGRAMS_ALIASES = PROGRAM_SLUG_ALIASES;

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        '[ProgramsBootstrap] programas cargados:',
        Object.keys(PROGRAM_DEFS_BY_SLUG)
      );
    }

    window.dispatchEvent(new Event('akira:programs-updated'));
  }, []);

  return null;
}
