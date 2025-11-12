// src/lib/programJson.ts
import { BUILD_V } from '@/lib/buildVersion';
import {
  getBySlug as getProgramMeta,
  PROGRAM_SLUG_ALIASES,
  resolveProgramDef, // fallback estático ya normalizado (META, normalmente sin days)
} from '@/data/programs';

/* ======================================
   Tipos del JSON de programa (runtime)
   ====================================== */
export type ProgramTask = {
  id?: string;
  label: string;
  detail?: string;
  tags?: string[];
};
export type ProgramDay = { day: number; tasks: ProgramTask[] };
export type ProgramJson = {
  // meta opcional (lo solemos añadir en los .json)
  slug?: string;                 // puede venir como 'lectura' o 'lectura-30'
  title?: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  themeColor?: string;
  accordions?: {
    whatYouWillDo?: string[];
    whatYouWillGet?: string[];
    howToUse?: string[];
  };
  days: ProgramDay[];            // en fresh/LS siempre existirá; en estático usamos [] si no hay datos
};

/* ======================================
   Flags de depuración por querystring
   ====================================== */
const QS =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null;

const PROGRAMS_DEBUG = !!QS?.get('programsDebug'); // ?programsDebug=1
const FORCE_FRESH    = !!QS?.get('forceFresh');    // ?forceFresh=1

/* ======================================
   Utilidades internas
   ====================================== */
export function canonicalizeSlug(input: string): string {
  if (!input) return input;
  return PROGRAM_SLUG_ALIASES[input] ?? input;
}

// Telemetría de fetch para inspección en runtime
const LAST_FETCH_META: Record<string, any> = {};
export function getLastProgramFetchMeta(slug: string) {
  return LAST_FETCH_META[canonicalizeSlug(slug)];
}

// Memo y caché local
const MEMO = new Map<string, ProgramJson>();
const LS_KEY = 'akira_program_json_cache_v1';

// Lectura/escritura de caché
function readCache(): Record<string, ProgramJson> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeCache(map: Record<string, ProgramJson>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {}
}

/* ======================================
   Normalización mínima (ids, orden, trim)
   ====================================== */
function normalizeJson(canonical: string, raw: any): ProgramJson {
  const daysRaw: any[] = Array.isArray(raw?.days) ? raw.days : [];
  const days: ProgramDay[] = daysRaw
    .map((d: any) => ({
      day: Number(d?.day ?? 0),
      tasks: (Array.isArray(d?.tasks) ? d.tasks : []).map((t: any, i: number) => ({
        id: t?.id ?? `${canonical}:${Number(d?.day ?? 0)}:${i}`,
        label: String(t?.label ?? '').trim(),
        detail: t?.detail ? String(t.detail) : undefined,
        tags: Array.isArray(t?.tags) ? (t.tags as string[]) : undefined,
      })),
    }))
    .filter((d) => Number.isFinite(d.day) && d.day > 0)
    .sort((a, b) => a.day - b.day);

  if (process.env.NODE_ENV !== 'production') {
    const seq = days.map((d) => d.day);
    const contiguous = seq.length === 0 || (seq[0] === 1 && seq.every((v, i) => v === i + 1));
    if (!contiguous) console.warn('[programJson] Días no contiguos en', canonical, seq);
  }

  return {
    slug: raw?.slug ?? canonical,
    title: raw?.title,
    shortDescription: raw?.shortDescription,
    howItWorks: raw?.howItWorks,
    durationDays: raw?.durationDays ?? days.length,
    themeColor: raw?.themeColor,
    accordions: raw?.accordions,
    days,
  };
}

/* ======================================
   Fetch fresh con fallback a slugData
   ====================================== */
async function fetchFresh(canonical: string): Promise<any> {
  const meta = getProgramMeta(canonical) || getProgramMeta(PROGRAM_SLUG_ALIASES[canonical] ?? canonical);
  const primary = `/data/programs/${canonical}.json?v=${encodeURIComponent(BUILD_V)}`;

  if (PROGRAMS_DEBUG) console.info('[programJson] try canonical', primary);
  let res = await fetch(primary, { cache: 'no-store' });
  if (res.ok) {
    const json = await res.json();
    LAST_FETCH_META[canonical] = { source: 'fresh-canonical', url: primary, build: BUILD_V, ok: true };
    return json;
  }
  if (PROGRAMS_DEBUG) console.warn('[programJson] miss canonical', res.status, primary);

  const slugData = meta?.slugData;
  if (slugData && slugData !== canonical) {
    const alt = `/data/programs/${slugData}.json?v=${encodeURIComponent(BUILD_V)}`;
    if (PROGRAMS_DEBUG) console.info('[programJson] try slugData', alt);
    res = await fetch(alt, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      LAST_FETCH_META[canonical] = { source: 'fresh-slugData', url: alt, build: BUILD_V, ok: true };
      return json;
    }
    if (PROGRAMS_DEBUG) console.warn('[programJson] miss slugData', res.status, alt);
  }

  LAST_FETCH_META[canonical] = { source: 'fresh-fail', build: BUILD_V, ok: false };
  throw new Error(`Program JSON fetch failed for ${canonical}`);
}

/* ======================================
   Loader principal (fresh → LS → estático)
   ====================================== */
export async function loadProgramJson(slug: string): Promise<ProgramJson> {
  const canonical = canonicalizeSlug(slug);

  // 1) memo
  if (!FORCE_FRESH) {
    const m = MEMO.get(canonical);
    if (m) {
      LAST_FETCH_META[canonical] = { source: 'memo', build: BUILD_V, ok: true };
      return m;
    }
  }

  // 2) fresh
  try {
    const raw = await fetchFresh(canonical);
    const norm = normalizeJson(canonical, raw);
    MEMO.set(canonical, norm);
    const cache = readCache();
    cache[canonical] = norm;
    writeCache(cache);
    return norm;
  } catch (e) {
    if (PROGRAMS_DEBUG) console.warn('[programJson] fresh failed → fallback', canonical, e);
  }

  // 3) localStorage
  if (!FORCE_FRESH) {
    const cache = readCache();
    if (cache[canonical]) {
      LAST_FETCH_META[canonical] = { source: 'localStorage', build: BUILD_V, ok: true };
      MEMO.set(canonical, cache[canonical]);
      return cache[canonical];
    }
  }

  // 4) estático (índice ya normalizado en data/programs – normalmente META SOLA)
  const staticDef = resolveProgramDef(canonical);
  if (staticDef) {
    // OJO: el índice estático suele NO tener "days". Rellenamos con [] y conservamos meta útil.
    const staticAny = staticDef as any;
    const norm: ProgramJson = {
      slug: staticDef.slug,
      title: staticDef.title,
      shortDescription: staticDef.shortDescription,
      howItWorks: staticDef.howItWorks,
      durationDays:
        staticDef.durationDays ??
        (Array.isArray(staticAny?.days) ? staticAny.days.length : undefined),
      themeColor: staticDef.themeColor ?? (staticAny?.color as string | undefined),
      accordions: staticDef.accordions,
      days: Array.isArray(staticAny?.days) ? (staticAny.days as ProgramDay[]) : [], // ✅ sin days en meta: []
    };
    LAST_FETCH_META[canonical] = { source: 'static-index', build: BUILD_V, ok: true };
    MEMO.set(canonical, norm);
    return norm;
  }

  throw new Error(`[programJson] No se pudo cargar el programa '${canonical}' de ninguna fuente`);
}

/* ======================================
   Helpers extra
   ====================================== */
export function invalidateProgramJsonCache() {
  MEMO.clear();
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
  } catch {}
}

// Export útil en pruebas
export const __PROGRAMS_FORCE_FRESH__ = FORCE_FRESH;
export const __PROGRAMS_DEBUG__ = PROGRAMS_DEBUG;
