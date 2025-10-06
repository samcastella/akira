// src/data/programs.ts

export type ProgramType = "good" | "bad";
export type ThematicCategory =
  | "salud"
  | "bienestar"
  | "productividad"
  | "malos-habitos";

export type ProgramMeta = {
  /** Slug del JSON de datos que usa ProgramDetail */
  slugData: string; // ej: "lectura-30" | "detox-tecnologico-30"
  /** Slug de la ruta pública (canónico, sin “-30”) */
  slugRoute: string; // ej: "lectura" | "detox-tecnologico"
  /** Ruta completa a la página del programa */
  route: string; // ej: "/programas/lectura"
  /** Título corto para tarjetas/listas */
  titleShort: string; // ej: "Conviértete en lector"
  /** Micro-descripción para tarjetas/listas */
  cardSubtitle: string;
  /** Días de duración */
  days: number; // ej: 30
  /** Bloque principal al que pertenece */
  type: ProgramType; // "good" | "bad"
  /** Temáticas (pueden ser varias) */
  categories: ThematicCategory[];
  /** Imagen (hero / thumbnail) */
  imageSrc: string; // en /public/images/...
  /** ¿Tiene page.tsx ya operativa? controla visibilidad en índices */
  available: boolean;
  /** Color de tema para la UI (hex o css var) */
  themeColor?: string;
  /** Opcional: keywords para buscador */
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
  /** Slug canónico sin “-30” (coincide con slugRoute) */
  slug: string;
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  /** Color de tema para pintar las barras de tareas */
  themeColor?: string;
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
    themeColor: "#E0E7FF", // indigo-100 suave (puedes cambiarlo)
    keywords: ["leer", "lectura", "libros"],
    meta: { language: "es", version: "1.0" },
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
    themeColor: "#FCD34D", // amber-300 (amarillo)
    keywords: ["detox", "móvil", "pantallas", "atención", "foco", "scroll"],
    meta: { language: "es", version: "1.0" },
  },
];

/* ===========================
   Imports JSON de programas (datos diarios)
   =========================== */
/**
 * Requisitos de tsconfig:
 *  - "resolveJsonModule": true
 *  - "module": "esnext" (o compatible con imports ESM)
 */
import lecturaJson from "./programs/lectura-30.json";
import detoxJson from "./programs/detox-tecnologico-30.json";

/* ===========================
   Normalización y construcción de índice
   =========================== */

/** Mapa de alias legacy -> canónico (sin “-30”). */
export const PROGRAM_SLUG_ALIASES: Record<string, string> = {
  "lectura-30": "lectura",
  "detox-tecnologico-30": "detox-tecnologico",
};

/** Fallback de color por temática (si algún meta no trae themeColor). */
const CATEGORY_THEME: Partial<Record<ThematicCategory, string>> = {
  "malos-habitos": "#FDE68A", // amber-200
  bienestar: "#D1FAE5", // emerald-100
  productividad: "#DBEAFE", // blue-100
  salud: "#FCE7F3", // pink-100
};

function canonicalFromMeta(m: ProgramMeta) {
  // canónico = slugRoute (sin sufijos “-30”)
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
  const durationDays: number | undefined = (raw?.durationDays ?? meta.days) as
    | number
    | undefined;
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

  // Comprobación ligera (no rompe, solo warn en dev)
  if (process.env.NODE_ENV !== "production") {
    const got = normalizedDays.map((d) => d.day);
    const contiguous =
      got.length === 0 || (got[0] === 1 && got.every((v, i) => v === i + 1));
    if (!contiguous) {
      // eslint-disable-next-line no-console
      console.warn(`[PROGRAMS] Días no contiguos en '${canonical}':`, got);
    }
    normalizedDays.forEach((d) => {
      d.tasks.forEach((t, i) => {
        if (!t.label) {
          // eslint-disable-next-line no-console
          console.warn(
            `[PROGRAMS] Tarea vacía en ${canonical} día ${d.day} idx ${i}`
          );
        }
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
  // Vinculamos cada meta con su JSON de datos
  const jsonByCanonical: Record<string, any> = {
    lectura: lecturaJson,
    "detox-tecnologico": detoxJson,
  };

  const out: Record<string, ProgramDef> = {};
  for (const meta of PROGRAMS) {
    if (!meta.available) continue; // solo exponemos programas operativos
    const canonical = canonicalFromMeta(meta);
    const raw = jsonByCanonical[canonical];
    if (!raw) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[PROGRAMS] No hay JSON vinculado para '${canonical}'`);
      }
      continue;
    }
    out[canonical] = toProgramDef(meta, raw);
  }

  // Duplicamos claves legacy -> mismo objeto (compat con datos antiguos)
  for (const [legacy, canonical] of Object.entries(PROGRAM_SLUG_ALIASES)) {
    if (out[canonical]) out[legacy] = out[canonical];
  }

  return out;
})();

/** Resolver ProgramDef por slug canónico o legacy. */
export function resolveProgramDef(slug: string): ProgramDef | undefined {
  if (!slug) return undefined;
  const canonical = PROGRAM_SLUG_ALIASES[slug] ?? slug;
  return PROGRAM_DEFS_BY_SLUG[canonical] ?? PROGRAM_DEFS_BY_SLUG[slug];
}

/* ===========================
   Utilidades (metadatos)
   =========================== */

/** Conjunto de slugs de ruta disponibles (los que ya tienen page.tsx). */
export const AVAILABLE_PROGRAM_SLUGS = new Set(
  PROGRAMS.filter((p) => p.available).map((p) => p.slugRoute)
);

/** Buscar metadatos por cualquier slug (route o data). */
export function getProgramMeta(slug: string) {
  return (
    PROGRAMS.find((p) => p.slugRoute === slug) ||
    PROGRAMS.find((p) => p.slugData === slug)
  );
}

/** Adaptador para la tarjeta del índice (mantiene tu shape local). */
export function toIndexCard(p: ProgramMeta) {
  return {
    id: p.slugData,
    slug: p.slugRoute, // lo que usas en href /programas/{slug}
    title: p.titleShort,
    description: p.cardSubtitle,
    days: p.days,
    type: p.type as "good" | "bad",
    categories: p.categories as ThematicCategory[],
    thumbnail: p.imageSrc,
  };
}

/** Listar por bloque principal (good/bad). */
export function listByType(type: ProgramType) {
  return PROGRAMS.filter((p) => p.type === type && p.available);
}

/** Listar por temática (salud/bienestar/productividad/malos-habitos). */
export function listByThematic(cat: ThematicCategory) {
  return PROGRAMS.filter((p) => p.categories.includes(cat) && p.available);
}

/** Búsqueda simple por texto/keywords/categorías. */
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
