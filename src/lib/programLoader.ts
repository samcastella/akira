// src/lib/programLoader.ts
'use client';

/**
 * Loader unificado de programas.
 * Lee SIEMPRE desde /data/programs/[slug].json (ruta pública/route), con bust de versión
 * y alias → canónico (p. ej., detox-tecnologico-30 → detox-tecnologico).
 */

export type ProgramTask = {
  id?: string;
  label: string;
  detail?: string;
};

export type ProgramDay = {
  day: number;              // 1..N
  tasks: ProgramTask[];     // lista de tareas del día
};

export type ProgramAccordions = {
  whatYouWillDo?: string[];
  whatYouWillGet?: string[];
  howToUse?: string[];
};

export type ProgramJson = {
  slug: string;
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;    // si no viene, se deduce de days.length
  themeColor?: string;
  accordions?: ProgramAccordions;
  days: ProgramDay[];
};

// ===== Helpers
const BUILD_V = process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev';

/** Canonicaliza slugs con sufijos tipo -30, -60, etc. */
export function canonicalizeSlug(slug: string): string {
  // mapea alias conocidos
  const map: Record<string, string> = {
    'detox-tecnologico-30': 'detox-tecnologico',
    'lectura-30': 'lectura',
  };
  if (map[slug]) return map[slug];

  // regla genérica: si acaba en -\d+, intenta quitar el sufijo
  const m = slug.match(/^(.*)-\d+$/);
  return m ? m[1] : slug;
}

/** Intenta varios paths razonables para robustez. */
function buildCandidateUrls(slug: string): string[] {
  const can = canonicalizeSlug(slug);
  const q = `?v=${encodeURIComponent(BUILD_V)}`;
  return [
    // ruta “oficial” que estamos usando
    `/data/programs/${can}.json${q}`,

    // si el JSON usa el slug con sufijo numérico como nombre de archivo
    `/data/programs/${slug}.json${q}`,

    // reintentos sin query (por si hay CDN peculiar)
    `/data/programs/${can}.json`,
    `/data/programs/${slug}.json`,
  ];
}

/**
 * Carga el JSON (fresh-first). Si falla un candidato, prueba el siguiente.
 * Lanza error si todos fallan.
 */
export async function loadProgramJson(slug: string): Promise<ProgramJson> {
  const urls = buildCandidateUrls(slug);
  let lastErr: any = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ProgramJson;

      // Normaliza mínimos
      if (!data.slug) data.slug = canonicalizeSlug(slug);
      if (!data.days) data.days = [];
      if (!data.durationDays) data.durationDays = data.days.length;

      return data;
    } catch (e) {
      lastErr = e;
      // intenta el siguiente candidato
    }
  }

  throw new Error(
    `[programLoader] No se pudo cargar ${slug}. Último error: ${String(lastErr)}`
  );
}
