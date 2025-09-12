// Catálogo de Programas (fuente de datos para /habitos y /programas)

export type Category =
  | "salud"
  | "bienestar"
  | "productividad"
  | "malos-habitos";

export type ProgramMeta = {
  id: string;               // clave interna estable
  slug: string;             // slug visible en URL (/programas/[slug]) (canónico)
  title: string;            // título visible
  shortDescription: string; // copy corto para listados
  days: number;             // duración total en días
  kind: "good" | "bad";     // buenos hábitos / malos hábitos
  categories: Category[];   // categorías
  thumbnail: string;        // ruta pública a imagen
  status?: "draft" | "published";
};

// === Programa Lectura (ejemplo inicial) ===
export const PROGRAMS: ProgramMeta[] = [
  {
    id: "lectura",
    slug: "lectura", // coincide con la carpeta /programas/lectura
    title: "Conviértete en lector",
    shortDescription:
      "Programa basado en neurociencia con tareas diarias para que disfrutes del proceso de convertirte en lector",
    days: 30,
    kind: "good",
    categories: ["productividad"],
    thumbnail: "/images/programs/reading.jpg",
    status: "published",
  },
];

/** Aliases históricos de slug → slug canónico */
const SLUG_ALIASES: Record<string, string> = {
  "lectura-30": "lectura",
};

function normalizeSlug(slug: string) {
  return SLUG_ALIASES[slug] ?? slug;
}

// ==== Helpers ====
export function listPrograms(): ProgramMeta[] {
  return PROGRAMS.filter((p) => p.status !== "draft");
}

export function getBySlug(slug: string): ProgramMeta | undefined {
  const s = normalizeSlug(slug);
  return PROGRAMS.find((p) => p.slug === s);
}

export function searchPrograms(q: string): ProgramMeta[] {
  const s = q.trim().toLowerCase();
  if (!s) return listPrograms();
  return listPrograms().filter(
    (p) =>
      p.title.toLowerCase().includes(s) ||
      p.shortDescription.toLowerCase().includes(s) ||
      p.categories.some((c) => c.toLowerCase().includes(s))
  );
}

/** Utilidad: devuelve el slug canónico (útil para construir URLs) */
export function canonicalSlug(slugOrAlias: string): string {
  return normalizeSlug(slugOrAlias);
}
