// src/data/programs.ts
import { BUILD_V } from '@/lib/buildVersion';

export type ProgramType = "good" | "bad";
export type ThematicCategory =
  | "salud"
  | "bienestar"
  | "productividad"
  | "malos-habitos";

export type ProgramMeta = {
  slugData: string;
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

/* ===========================
   Tipos de ejecución (ProgramDef)
   =========================== */
export type ProgramTask = {
  id?: string;
  label: string;
  detail?: string;
  tags?: string[];
};
export type ProgramDay = { day: number; tasks: ProgramTask[] };
export type ProgramDef = {
  slug: string;               // canónico (slugRoute)
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  themeColor?: string;        // mantenemos tu shape
  accordions?: {
    whatYouWillDo?: string[];
    whatYouWillGet?: string[];
    howToUse?: string[];
  };
  days: ProgramDay[];
};

/* ===========================
   Registro de programas (metadatos)
   =========================== */
export const PROGRAMS: ProgramMeta[] = [
  {
    slugData: "lectura-30",
    slugRoute: "lectura",
    route: "/programas/lectura",
    titleShort: "Conviértete en lector",
    cardSubtitle:
      "Programa basado en neurociencia con tareas diarias para que disfrutes del proceso de convertirte en lector",
    days: 30,
    type: "good",
    categories: ["productividad", "bienestar"],
    imageSrc: "/images/programs/lectura-hero.jpg",
    available: true,
    themeColor: "#E0E7FF",
    keywords: ["leer", "lectura", "libros"],
    meta: { language: "es", version: "1.0" },
    community: false,
  },
  {
    slugData: "detox-tecnologico-30",
    slugRoute: "detox-tecnologico",
    route: "/programas/detox-tecnologico",
    titleShort: "Détox Tecnológico",
    cardSubtitle:
      "¿Te gustaría recuperar tu atención? Haz un détox amable y usa el móvil a tu favor para reconectar con tu entorno.",
    days: 30,
    type: "bad",
    categories: ["bienestar", "productividad", "malos-habitos"],
    imageSrc: "/images/programs/detox-hero.jpg",
    available: true,
    themeColor: "#FCD34D",
    keywords: ["detox", "móvil", "pantallas", "atención", "foco", "scroll"],
    meta: { language: "es", version: "1.0" },
    community: false,
  },
  {
    slugData: "san-silvestre-60",
    slugRoute: "san-silvestre-60",
    route: "/programas/san-silvestre-60",
    titleShort: "San Silvestre: 0 → 10 km",
    cardSubtitle:
      "60 días para preparar la San Silvestre con progresión amable: caminata, trote, fuerza básica y descanso.",
    days: 60,
    type: "good",
    categories: ["salud", "bienestar"],
    imageSrc: "/images/programs/san-silvestre-hero.jpg",
    available: true,
    themeColor: "#FCA5A5",
    keywords: ["running", "correr", "10k", "san silvestre"],
    meta: { language: "es", version: "1.0" },
    community: true,
  },
];

/* ===========================
   Imports JSON de programas (datos diarios)
   =========================== */
/**
 * Requisitos de tsconfig:
 *  - "resolveJsonModule": true
 *  - "module": "esnext"
 */
import lecturaJson from "./programs/lectura-30.json";
import detoxJson from "./programs/detox-tecnologico-30.json";
import sanSilvestreJson from "./programs/san-silvestre-60.json";

/* ===========================
   Normalización y construcción de índice
   =========================== */

/** Mapa de alias legacy -> canónico (sin “-30”). */
export const PROGRAM_SLUG_ALIASES: Record<string, string> = {
  "lectura-30": "lectura",
  "detox-tecnologico-30": "detox-tecnologico",
  // San Silvestre conserva el “-60” como route slug
};

/** Fallback de color por temática (si falta themeColor). */
const CATEGORY_THEME: Partial<Record<ThematicCategory, string>> = {
  "malos-habitos": "#FDE68A",
  bienestar: "#D1FAE5",
  productividad: "#DBEAFE",
  salud: "#FCE7F3",
};

function canonicalFromMeta(m: ProgramMeta) {
  return m.slugRoute;
}

function pickThemeColor(meta: ProgramMeta): string | undefined {
  if (meta.themeColor) return meta.themeColor;
  for (const c of meta.categories) {
    const color = CATEGORY_THEME[c];
    if (color) return color;
  }
  return undefined;
}

function toProgramDef(meta: ProgramMeta, raw: any): ProgramDef {
  const canonical = canonicalFromMeta(meta);

  // Estructura base tolerante a JSONs antiguos
  const title: string = (raw?.title ?? meta.titleShort ?? canonical) as string;
  const shortDescription: string | undefined = raw?.shortDescription;
  const howItWorks: string | undefined = raw?.howItWorks;
  const durationDays: number | undefined = (raw?.durationDays ?? meta.days) as number | undefined;
  const accordions = raw?.accordions;
  const daysRaw: any[] = Array.isArray(raw?.days) ? raw.days : [];

  // Normalizamos IDs de tareas y orden de días
  const normalizedDays: ProgramDay[] = daysRaw
    .map((d: any) => ({
      day: Number(d?.day),
      tasks: (Array.isArray(d?.tasks) ? d.tasks : []).map((t: any, i: number) => ({
        id: t?.id ?? `${canonical}:${Number(d?.day)}:${i}`,
        label: String(t?.label ?? "").trim(),
        detail: t?.detail ? String(t.detail) : undefined,
        tags: Array.isArray(t?.tags) ? (t.tags as string[]) : undefined,
      })),
    }))
    .sort((a, b) => a.day - b.day);

  if (process.env.NODE_ENV !== "production") {
    const got = normalizedDays.map((d) => d.day);
    const contiguous =
      got.length === 0 || (got[0] === 1 && got.every((v, i) => v === i + 1));
    if (!contiguous) console.warn(`[PROGRAMS] Días no contiguos en '${canonical}':`, got);
    normalizedDays.forEach((d) => {
      d.tasks.forEach((t, i) => {
        if (!t.label) console.warn(`[PROGRAMS] Tarea vacía en ${canonical} día ${d.day} idx ${i}`);
      });
    });
  }

  return {
    slug: canonical,
    title,
    shortDescription,
    howItWorks,
    durationDays,
    themeColor: pickThemeColor(meta),
    accordions,
    days: normalizedDays,
  };
}

/** Índice canónico { slugRoute -> ProgramDef } con duplicado de claves legacy para compat. */
export const PROGRAM_DEFS_BY_SLUG: Record<string, ProgramDef> = (() => {
  const jsonByCanonical: Record<string, any> = {
    lectura: lecturaJson,
    "detox-tecnologico": detoxJson,
    "san-silvestre-60": sanSilvestreJson,
  };

  const out: Record<string, ProgramDef> = {};
  for (const meta of PROGRAMS) {
    if (!meta.available) continue;
    const canonical = canonicalFromMeta(meta);
    const raw = jsonByCanonical[canonical];
    if (!raw) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[PROGRAMS] No hay JSON vinculado para '${canonical}'`);
      }
      continue;
    }
    out[canonical] = toProgramDef(meta, raw);
  }

  for (const [legacy, canonical] of Object.entries(PROGRAM_SLUG_ALIASES)) {
    if (out[canonical]) out[legacy] = out[canonical];
  }

  return out;
})();

/** Resolver ProgramDef por slug canónico o legacy (índice estático). */
export function resolveProgramDef(slug: string): ProgramDef | undefined {
  if (!slug) return undefined;
  const canonical = PROGRAM_SLUG_ALIASES[slug] ?? slug;
  return PROGRAM_DEFS_BY_SLUG[canonical] ?? PROGRAM_DEFS_BY_SLUG[slug];
}

/* ===========================
   Loader fresh-first (memo + LS + fallback estático)
   =========================== */
const DEF_MEMO = new Map<string, ProgramDef>();
const LS_DEF_CACHE_KEY = 'akira_program_defs_cache_v1';

function readDefCache(): Record<string, ProgramDef> {
  try { return JSON.parse(localStorage.getItem(LS_DEF_CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeDefCache(x: Record<string, ProgramDef>) {
  try { localStorage.setItem(LS_DEF_CACHE_KEY, JSON.stringify(x)); } catch {}
}
function canonicalize(slug: string): string {
  return PROGRAM_SLUG_ALIASES[slug] ?? slug;
}

async function fetchProgramRawFresh(canonical: string): Promise<any> {
  const url = `/data/programs/${canonical}.json?v=${encodeURIComponent(BUILD_V)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Program JSON fetch failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

/**
 * Devuelve ProgramDef con estrategia:
 * 1) memo → 2) fetch fresh (+normalize) → 3) LS cache → 4) índice estático
 */
export async function getProgramDef(slug: string): Promise<ProgramDef> {
  const canonical = canonicalize(slug);

  // 1) memo
  const memo = DEF_MEMO.get(canonical);
  if (memo) return memo;

  // 2) fresh
  try {
    const meta =
      getProgramMeta(canonical) ||
      getProgramMeta(PROGRAM_SLUG_ALIASES[canonical] ?? canonical);
    if (!meta) throw new Error(`No meta for ${canonical}`);

    const raw = await fetchProgramRawFresh(canonical);
    const def = toProgramDef(meta, raw);

    DEF_MEMO.set(canonical, def);
    const cache = readDefCache(); cache[canonical] = def; writeDefCache(cache);
    return def;
  } catch (e) {
    // 3) LS
    const cache = readDefCache();
    if (cache[canonical]) {
      DEF_MEMO.set(canonical, cache[canonical]);
      return cache[canonical];
    }
    // 4) estático
    const staticDef = resolveProgramDef(canonical);
    if (staticDef) {
      DEF_MEMO.set(canonical, staticDef);
      return staticDef;
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** Alias por compatibilidad con consumidores antiguos */
export const loadProgramJson = getProgramDef;

/* ===========================
   Utilidades (metadatos)
   =========================== */
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
    type: p.type as "good" | "bad",
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

export { getProgramMeta as getBySlug };
