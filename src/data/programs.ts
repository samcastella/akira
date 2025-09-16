// src/data/programs.ts

export type ProgramType = "good" | "bad";
export type ThematicCategory = "salud" | "bienestar" | "productividad" | "malos-habitos";

export type ProgramMeta = {
  /** Slug del JSON de datos que usa ProgramDetail */
  slugData: string;              // ej: "lectura-30" | "detox-tecnologico-30"
  /** Slug de la ruta pública */
  slugRoute: string;             // ej: "lectura" | "detox-tecnologico"
  /** Ruta completa a la página del programa */
  route: string;                 // ej: "/programas/lectura"
  /** Título corto para tarjetas/listas */
  titleShort: string;            // ej: "Conviértete en lector"
  /** Micro-descripción para tarjetas/listas */
  cardSubtitle: string;
  /** Días de duración */
  days: number;                  // ej: 30
  /** Bloque principal al que pertenece */
  type: ProgramType;             // "good" | "bad"
  /** Temáticas (pueden ser varias) */
  categories: ThematicCategory[];
  /** Imagen (hero / thumbnail) */
  imageSrc: string;              // en /public/images/...
  /** ¿Tiene page.tsx ya operativa? controla visibilidad en índices */
  available: boolean;
  /** Opcional: keywords para buscador */
  keywords?: string[];
  meta?: { createdAt?: string; version?: string; language?: string };
};

/* ===========================
   Registro de programas
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
    keywords: ["detox", "móvil", "pantallas", "atención", "foco", "scroll"],
    meta: { language: "es", version: "1.0" },
  },
];

/* ===========================
   Utilidades
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
    slug: p.slugRoute,                // lo que usas en href /programas/{slug}
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