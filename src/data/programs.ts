// Catálogo de Programas (fuente de datos para /habitos)

export type Category =
  | "salud"
  | "bienestar"
  | "productividad"
  | "malos-habitos";

export type ProgramMeta = {
  id: string;               // clave interna estable
  slug: string;             // slug visible en URL (/habitos/[slug])
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
    slug: "lectura-30",
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

// ==== Helpers ====
export function listPrograms(): ProgramMeta[] {
  return PROGRAMS.filter((p) => p.status !== "draft");
}

export function getBySlug(slug: string): ProgramMeta | undefined {
  return PROGRAMS.find((p) => p.slug === slug);
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
