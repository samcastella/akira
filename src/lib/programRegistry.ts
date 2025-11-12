// src/lib/programRegistry.ts
'use client';

import { canonicalizeSlug, loadProgramJson, type ProgramJson } from '@/lib/programLoader';

export type ProgramMeta = {
  slug: string;          // slug de navegación (puede incluir -30 o -60)
  title: string;
  imageSrc?: string;
  themeColor?: string;
  isCommunity?: boolean;
};

/**
 * Catálogo de programas visibles en la app (añade aquí los que tengas en /public/data/programs/*.json)
 * slug = ruta pública (puede llevar -30/-60 si lo usas en URL); el JSON real se resolverá por canonical.
 */
export const PROGRAMS_META: ProgramMeta[] = [
  {
    slug: 'lectura',                   // JSON: /public/data/programs/lectura.json
    title: 'Lectura — 30 días',
    imageSrc: '/images/programs/reading-hero.jpg',
    themeColor: '#111111',
  },
  {
    slug: 'detox-tecnologico',         // JSON: /public/data/programs/detox-tecnologico.json
    title: 'Détox Tecnológico — 30 días',
    imageSrc: '/images/programs/detox-hero.jpg',
    themeColor: '#0a7cff',
  },
  {
    slug: 'san-silvestre-60',          // JSON: /public/data/programs/san-silvestre-60.json  (si existe) 
    title: 'San Silvestre — Plan de 60 días',
    imageSrc: '/images/programs/san-silvestre-hero.jpg',
    themeColor: '#111111',
    isCommunity: true,
  },
];

export function listPrograms(): ProgramMeta[] {
  return PROGRAMS_META;
}

export function getBySlug(slug: string): ProgramMeta | undefined {
  // buscamos por slug exacto y por su forma canónica
  const can = canonicalizeSlug(slug);
  return PROGRAMS_META.find(p => p.slug === slug) ?? PROGRAMS_META.find(p => canonicalizeSlug(p.slug) === can);
}

/** Sustituye a resolveProgramDef del módulo antiguo: carga el JSON desde /public/data/programs */
export async function resolveProgramDef(slug: string): Promise<ProgramJson> {
  return loadProgramJson(slug);
}
