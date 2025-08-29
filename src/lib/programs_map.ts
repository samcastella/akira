// src/lib/programs_map.ts
export const SLUG_TO_LEGACY: Record<string, string> = {
  'lectura-21d': 'lectura',
  // 'burpees-30d': 'burpees',
  // 'finanzas-30d': 'finanzas',
  // 'meditacion-21d': 'meditacion',
};

export const LEGACY_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_LEGACY).map(([slug, legacy]) => [legacy, slug]),
);
