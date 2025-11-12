// src/data/programs.ts

/* ===========================
   Tipados
   =========================== */
export type ProgramType = 'good' | 'bad';
export type ThematicCategory =
  | 'salud'
  | 'bienestar'
  | 'productividad'
  | 'malos-habitos';

export type ProgramMeta = {
  /** Nombre de fichero legacy en /public/data (con -30/-60 si aplica) */
  slugData: string;
  /** Slug canónico de ruta (sin sufijos, salvo excepciones como -60) */
  slugRoute: string;
  route: string;
  titleShort: string;
  cardSubtitle: string;
  days: number;
  type: ProgramType;
  categories: ThematicCategory[];
  imageSrc: string;
  available: boolean;
  themeColor?: string;
  community?: boolean;
  keywords?: string[];
  meta?: { createdAt?: string; version?: string; language?: string };
};

/** Meta-def ligero para UI (sin days/tasks). Para contenido diario usa lib/programLoader. */
export type ProgramDefMetaOnly = {
  slug: string; // canónico (slugRoute)
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  themeColor?: string;
  accordions?: {
    whatYouWillDo?: string[];
    whatYouWillGet?: string[];
    howToUse?: string[];
  };
};

/* ===== Registro de programas (metadatos) ===== */
export const PROGRAMS: ProgramMeta[] = [
  {
    slugData: 'lectura-30',
    slugRoute: 'lectura',
    route: '/programas/lectura',
    titleShort: 'Conviértete en lector',
    cardSubtitle:
      'Programa basado en neurociencia con tareas diarias para que disfrutes del proceso de convertirte en lector',
    days: 30,
    type: 'good',
    categories: ['productividad', 'bienestar'],
    imageSrc: '/images/programs/lectura-hero.jpg',
    available: true,
    themeColor: '#E0E7FF',
    keywords: ['leer', 'lectura', 'libros'],
    meta: { language: 'es', version: '1.0' },
    community: false,
  },
  {
    slugData: 'detox-tecnologico-30',
    slugRoute: 'detox-tecnologico',
    route: '/programas/detox-tecnologico',
    titleShort: 'Détox Tecnológico',
    cardSubtitle:
      '¿Te gustaría recuperar tu atención? Haz un détox amable y usa el móvil a tu favor para reconectar con tu entorno.',
    days: 30,
    type: 'bad',
    categories: ['bienestar', 'productividad', 'malos-habitos'],
    imageSrc: '/images/programs/detox-hero.jpg',
    available: true,
    themeColor: '#FCD34D',
    keywords: ['detox', 'móvil', 'pantallas', 'atención', 'foco', 'scroll'],
    meta: { language: 'es', version: '1.0' },
    community: false,
  },
  {
    slugData: 'san-silvestre-60',
    slugRoute: 'san-silvestre-60',
    route: '/programas/san-silvestre-60',
    titleShort: 'San Silvestre: 0 → 10 km',
    cardSubtitle:
      '60 días para preparar la San Silvestre con progresión amable: caminata, trote, fuerza básica y descanso.',
    days: 60,
    type: 'good',
    categories: ['salud', 'bienestar'],
    imageSrc: '/images/programs/san-silvestre-hero.jpg',
    available: true,
    themeColor: '#FCA5A5',
    keywords: ['running', 'correr', '10k', 'san silvestre'],
    meta: { language: 'es', version: '1.0' },
    community: true,
  },
];

/* ===== Aliases legacy → canónico ===== */
export const PROGRAM_SLUG_ALIASES: Record<string, string> = {
  'lectura-30': 'lectura',
  'detox-tecnologico-30': 'detox-tecnologico',
  // San Silvestre conserva “-60”
};

/* ===== Utilidades de metadatos ===== */
const CATEGORY_THEME: Partial<Record<ThematicCategory, string>> = {
  'malos-habitos': '#FDE68A',
  bienestar: '#D1FAE5',
  productividad: '#DBEAFE',
  salud: '#FCE7F3',
};

function pickThemeColor(meta: ProgramMeta): string | undefined {
  if (meta.themeColor) return meta.themeColor;
  for (const c of meta.categories) {
    const color = CATEGORY_THEME[c];
    if (color) return color;
  }
  return undefined;
}

export const AVAILABLE_PROGRAM_SLUGS = new Set(
  PROGRAMS.filter((p) => p.available).map((p) => p.slugRoute)
);

export const COMMUNITY_PROGRAM_SLUGS = new Set(
  PROGRAMS.filter((p) => p.community).map((p) => p.slugRoute)
);

export function isCommunityProgram(slug: string) {
  const meta =
    PROGRAMS.find((p) => p.slugRoute === slug) ||
    PROGRAMS.find((p) => p.slugData === slug);
  return Boolean(meta?.community);
}

export function getProgramMeta(slug: string) {
  return (
    PROGRAMS.find((p) => p.slugRoute === slug) ||
    PROGRAMS.find((p) => p.slugData === slug)
  );
}

export function toIndexCard(p: ProgramMeta) {
  return {
    id: p.slugData,
    slug: p.slugRoute,
    title: p.titleShort,
    description: p.cardSubtitle,
    days: p.days,
    type: p.type as 'good' | 'bad',
    categories: p.categories as ThematicCategory[],
    thumbnail: p.imageSrc,
    community: !!p.community,
  };
}

export function listByType(type: ProgramType) {
  return PROGRAMS.filter((p) => p.type === type && p.available);
}

export function listByThematic(cat: ThematicCategory) {
  return PROGRAMS.filter((p) => p.categories.includes(cat) && p.available);
}

export function searchPrograms(q: string) {
  const n = q.trim().toLowerCase();
  if (!n) return PROGRAMS.filter((p) => p.available);
  return PROGRAMS.filter((p) => {
    const inText =
      p.titleShort.toLowerCase().includes(n) ||
      p.cardSubtitle.toLowerCase().includes(n) ||
      (p.keywords ?? []).some((k) => k.toLowerCase().includes(n));
    const inCats = p.categories.some((c) => c.includes(n as any));
    return p.available && (inText || inCats);
  });
}

/* ===== Helpers rápidos de UI (sin tocar JSONs) ===== */

/** Devuelve SOLO el color de tema desde metadatos. */
export function resolveProgramColor(slug: string): string | undefined {
  const canonical = PROGRAM_SLUG_ALIASES[slug] ?? slug;
  const meta = getProgramMeta(canonical);
  return meta ? pickThemeColor(meta) : undefined;
}

/** Devuelve un “meta-def” ligero (sin days). */
export function resolveProgramDefMeta(slug: string): ProgramDefMetaOnly | undefined {
  const canonical = PROGRAM_SLUG_ALIASES[slug] ?? slug;
  const meta = getProgramMeta(canonical);
  if (!meta) return undefined;
  return {
    slug: canonical,
    title: meta.titleShort,
    durationDays: meta.days,
    themeColor: pickThemeColor(meta),
  };
}

/* ===== Compat (nombre histórico): OJO, ahora devuelve meta-def sin days */
export const resolveProgramDef = resolveProgramDefMeta;

/* ===== Alias útil en imports antiguos ===== */
export { getProgramMeta as getBySlug };
