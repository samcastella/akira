// Fuente única de verdad para Programas Activos en LocalStorage
export const LS_ACTIVE = 'akira_programs_active_v1';
const LS_ACTIVE_COMPAT = 'akira_program_active'; // legacy single-object

export type LocalProgram = {
  programSlug: string;                          // slug tal cual lo guardes (puede venir con o sin "-30")
  status: 'active' | 'paused' | 'completed';
  startedAt: number;                            // epoch ms (idealmente 00:00 local)
  progress: any;                                // { currentDay?: number, days?: {...} } etc.
  updatedAt: number;                            // epoch ms
};

export type LocalStore = Record<string /* slug */, LocalProgram>;

/* =========================
   Utils
   ========================= */
function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}
function canonicalSlug(slug: string | undefined): string | undefined {
  if (!slug) return slug;
  return slug.endsWith('-30') ? slug.slice(0, -3) : slug;
}
function ymdFromEpochMs(ms?: number): string | undefined {
  if (!ms || !Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  // normalizamos a día LOCAL y lo pasamos a YMD sin arrastrar TZ
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const z = new Date(local.getTime() - local.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

/* =========================
   Lectura/Escritura (no intrusivo)
   ========================= */
export function loadActive(): LocalStore {
  if (!isBrowser()) return {};
  return parseJSON<LocalStore>(localStorage.getItem(LS_ACTIVE), {});
}
export function saveActive(store: LocalStore) {
  if (!isBrowser()) return;
  localStorage.setItem(LS_ACTIVE, JSON.stringify(store));
}

/* =========================
   Migración mínima (la que funcionaba)
   ========================= */
export function migrateCompat(): void {
  if (!isBrowser()) return;
  try {
    const legacyRaw = localStorage.getItem(LS_ACTIVE_COMPAT);
    if (!legacyRaw) return;

    type Legacy = { slug: string; startedAt?: number; currentDay?: number };
    const legacy = parseJSON<Legacy>(legacyRaw, { slug: '' });

    if (legacy?.slug) {
      const current = loadActive();
      if (!current[legacy.slug]) {
        const now = Date.now();
        current[legacy.slug] = {
          programSlug: legacy.slug,
          status: 'active',
          startedAt: legacy.startedAt ?? now,
          progress: { currentDay: legacy.currentDay ?? 1, days: {} },
          updatedAt: now,
        };
        saveActive(current);
      }
    }
    localStorage.removeItem(LS_ACTIVE_COMPAT);
  } catch { /* noop */ }
}

/* =========================
   Compatibilidad de lectura (mapa o array)
   ========================= */
function readRawActiveAny():
  | { kind: 'map'; map: LocalStore }
  | { kind: 'array'; arr: string[] }
  | { kind: 'empty' } {
  if (!isBrowser()) return { kind: 'empty' };

  const raw = localStorage.getItem(LS_ACTIVE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { kind: 'array', arr: parsed.filter(Boolean).map(String) };
      if (parsed && typeof parsed === 'object') return { kind: 'map', map: parsed as LocalStore };
    } catch {}
  }

  // Fallback arrays legacy
  for (const k of ['akira_programs_active', 'akira_active_programs_v1']) {
    const r = localStorage.getItem(k);
    if (!r) continue;
    try {
      const p = JSON.parse(r);
      if (Array.isArray(p)) return { kind: 'array', arr: p.filter(Boolean).map(String) };
    } catch {}
  }
  return { kind: 'empty' };
}

/* =========================
   Helpers de LECTURA para Mi zona (no escriben)
   ========================= */

/** Slugs activos en orden reciente (canónicos al devolver). */
export function getActiveSlugs(): string[] {
  const any = readRawActiveAny();

  if (any.kind === 'array') {
    return Array.from(new Set(any.arr.map(s => canonicalSlug(s)!).filter(Boolean)));
  }

  if (any.kind === 'map') {
    const store = any.map;
    // 1) preferimos status !== 'completed'
    let slugs = Object.values(store)
      .filter(p => (p?.status ?? 'active') !== 'completed')
      .sort((a, b) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0))
      .map(p => canonicalSlug(p.programSlug)!)
      .filter(Boolean);

    // 2) si quedó vacío por datos incompletos, usamos las KEYS del mapa
    if (slugs.length === 0) {
      slugs = Object.keys(store).map(k => canonicalSlug(k)!).filter(Boolean);
    }

    return Array.from(new Set(slugs));
  }

  return [];
}

/** YYYY-MM-DD desde startedAt (si existe). */
export function getStartDateYMD(slugRaw: string): string | undefined {
  const any = readRawActiveAny();

  if (any.kind === 'map') {
    const store = any.map;
    const entry =
      store[slugRaw] ??
      store[canonicalSlug(slugRaw) ?? ''] ??
      store[`${slugRaw}-30`];
    return ymdFromEpochMs(entry?.startedAt);
  }
  return undefined; // en array no hay startedAt
}

/**
 * Índice de día relativo (0-based).
 * 1) startedAt → diff seguro (YMD local)
 * 2) progress.currentDay - 1 (compat)
 * 3) fallback 0 (array o sin datos)
 */
export function getDayIndexFor(slugRaw: string, todayYmd?: string): number {
  const any = readRawActiveAny();

  if (any.kind === 'map') {
    const store = any.map;
    const entry =
      store[slugRaw] ??
      store[canonicalSlug(slugRaw) ?? ''] ??
      store[`${slugRaw}-30`];

    if (entry?.startedAt) {
      const startYmd = ymdFromEpochMs(entry.startedAt)!;
      const today =
        todayYmd && /^\d{4}-\d{2}-\d{2}$/.test(todayYmd)
          ? todayYmd
          : (() => {
              const now = new Date();
              const z = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
              return z.toISOString().slice(0, 10);
            })();

      const a = Date.parse(startYmd);
      const b = Date.parse(today);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const diff = Math.floor((b - a) / 86400000);
        return diff < 0 ? 0 : diff;
      }
    }

    const cd = Number(entry?.progress?.currentDay);
    if (Number.isFinite(cd) && cd > 0) return cd - 1;

    return 0;
  }

  // Solo array de slugs → asumimos empezado hoy
  return 0;
}

/** Inicializa: migra legacy simple y devuelve el store (no altera nada más). */
export function initProgramsLocal(): LocalStore {
  if (!isBrowser()) return {};
  migrateCompat();
  return loadActive();
}

/** (Opcional) Forzar activar/actualizar un programa en el store canónico. */
export function ensureActive(
  slug: string,
  opts?: { startAtMs?: number; status?: LocalProgram['status']; progress?: any }
) {
  if (!isBrowser()) return;
  const store = loadActive();
  const now = Date.now();
  store[slug] = {
    programSlug: slug,
    status: opts?.status ?? store[slug]?.status ?? 'active',
    startedAt: opts?.startAtMs ?? store[slug]?.startedAt ?? now,
    progress: opts?.progress ?? store[slug]?.progress ?? { days: {} },
    updatedAt: now,
  };
  saveActive(store);
  try { window.dispatchEvent(new Event('akira:programs-updated')); } catch {}
}

/* ===== (Opcional) Debug helpers en consola ===== */
declare global { interface Window { __akira?: any } }
(function exposeForConsole(){
  try {
    if (typeof window !== 'undefined') {
      window.__akira = window.__akira || {};
      Object.assign(window.__akira, {
        loadActive, saveActive, migrateCompat,
        getActiveSlugs, getStartDateYMD, getDayIndexFor, initProgramsLocal, ensureActive,
      });
    }
  } catch {}
})();
