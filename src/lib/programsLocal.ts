// Fuente única de verdad para Programas Activos en LocalStorage
export const LS_ACTIVE = 'akira_programs_active_v1';
const LS_ACTIVE_COMPAT = 'akira_program_active'; // legacy single-object

export type LocalProgram = {
  programSlug: string;                          // slug tal cual lo guardes (puede venir con o sin "-30")
  status: 'active' | 'paused' | 'completed';
  startedAt: number;                            // epoch ms (opcionalmente 00:00 local)
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
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const z = new Date(local.getTime() - local.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

/* =========================
   Lectura/Escritura (no intrusivo)
   ========================= */
/** Lee la estructura actual (v1) tal cual está almacenada (sin tocarla). */
export function loadActive(): LocalStore {
  if (!isBrowser()) return {};
  return parseJSON<LocalStore>(localStorage.getItem(LS_ACTIVE), {});
}

/** Guarda la estructura actual (v1) tal cual la recibimos (sin normalizar). */
export function saveActive(store: LocalStore) {
  if (!isBrowser()) return;
  localStorage.setItem(LS_ACTIVE, JSON.stringify(store));
}

/* =========================
   Migración mínima (la que te funcionaba)
   ========================= */
/** Migra desde la clave legacy si existe y luego la elimina. Idempotente. */
export function migrateCompat(): void {
  if (!isBrowser()) return;
  try {
    const legacyRaw = localStorage.getItem(LS_ACTIVE_COMPAT);
    if (!legacyRaw) return;

    // Legacy era un único programa { slug, startedAt?, currentDay? }
    type Legacy = { slug: string; startedAt?: number; currentDay?: number };
    const legacy = parseJSON<Legacy>(legacyRaw, { slug: '' });

    if (legacy?.slug) {
      const current = loadActive();
      // si ya existe en v1, no sobreescribimos
      if (!current[legacy.slug]) {
        const now = Date.now();
        current[legacy.slug] = {
          programSlug: legacy.slug,
          status: 'active',
          startedAt: legacy.startedAt ?? now,
          progress: {
            currentDay: legacy.currentDay ?? 1,
            days: {},
          },
          updatedAt: now,
        };
        saveActive(current);
      }
    }
    // borra legacy
    localStorage.removeItem(LS_ACTIVE_COMPAT);
  } catch {
    // no romper flujo
  }
}

/* =========================
   Compatibilidad de lectura (mapa o array)
   ========================= */

// Detecta y lee cualquier forma de "activos" que podamos encontrar
function readRawActiveAny():
  | { kind: 'map'; map: LocalStore }
  | { kind: 'array'; arr: string[] }
  | { kind: 'empty' } {
  if (!isBrowser()) return { kind: 'empty' };

  // Preferencia: clave canónica
  const raw = localStorage.getItem(LS_ACTIVE);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return { kind: 'array', arr: parsed.filter(Boolean).map(String) };
      }
      if (parsed && typeof parsed === 'object') {
        return { kind: 'map', map: parsed as LocalStore };
      }
    } catch {}
  }

  // Fallback arrays legacy
  const legacyArrayKeys = ['akira_programs_active', 'akira_active_programs_v1'];
  for (const k of legacyArrayKeys) {
    const r = localStorage.getItem(k);
    if (!r) continue;
    try {
      const p = JSON.parse(r);
      if (Array.isArray(p)) {
        return { kind: 'array', arr: p.filter(Boolean).map(String) };
      }
    } catch {}
  }

  return { kind: 'empty' };
}

/* =========================
   Helpers de LECTURA para Mi zona (no escriben)
   ========================= */

/** Slugs activos en orden reciente (canónicos SOLO al devolver, no guardamos). */
export function getActiveSlugs(): string[] {
  const any = readRawActiveAny();

  if (any.kind === 'array') {
    return Array.from(new Set(any.arr.map(s => canonicalSlug(s)!).filter(Boolean)));
  }

  if (any.kind === 'map') {
    const store = any.map;
    return Object.values(store)
      .filter(p => p?.status === 'active')
      .sort((a, b) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0))
      .map(p => canonicalSlug(p.programSlug)!)
      .filter(Boolean);
  }

  return [];
}

/** Devuelve YYYY-MM-DD calculado desde startedAt si existe. */
export function getStartDateYMD(slugRaw: string): string | undefined {
  const any = readRawActiveAny();

  if (any.kind === 'map') {
    const store = any.map;
    // buscamos exacto y por variante canónica/inversa
    const entry =
      store[slugRaw] ??
      store[canonicalSlug(slugRaw) ?? ''] ??
      store[`${slugRaw}-30`];
    return ymdFromEpochMs(entry?.startedAt);
  }

  // Si solo existe array, no hay startedAt almacenado
  return undefined;
}

/**
 * Calcula el índice de día relativo (0-based).
 * Prioridad:
 *  1) Si hay startedAt → diff días entre hoy y startedAt
 *  2) Si NO hay startedAt pero existe progress.currentDay → currentDay-1
 *  3) Si no hay datos → 0
 */
export function getDayIndexFor(slugRaw: string, todayYmd?: string): number {
  const any = readRawActiveAny();

  if (any.kind === 'map') {
    const store = any.map;
    const entry =
      store[slugRaw] ??
      store[canonicalSlug(slugRaw) ?? ''] ??
      store[`${slugRaw}-30`];

    // 1) startedAt → diff
    if (entry?.startedAt) {
      const start = ymdFromEpochMs(entry.startedAt)!;
      const today =
        todayYmd && /^\d{4}-\d{2}-\d{2}$/.test(todayYmd)
          ? todayYmd
          : (() => {
              const now = new Date();
              const z = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
              return z.toISOString().slice(0, 10);
            })();
      const a = Date.parse(start);
      const b = Date.parse(today);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const diff = Math.floor((b - a) / 86400000);
        return diff < 0 ? 0 : diff;
      }
    }

    // 2) progress.currentDay → 0-based
    const cd = Number(entry?.progress?.currentDay);
    if (Number.isFinite(cd) && cd > 0) return cd - 1;

    // 3) fallback
    return 0;
  }

  // Solo array de slugs → empezado hoy → día 0
  return 0;
}

/** Inicializa: migra legacy simple y devuelve el store (no altera nada más). */
export function initProgramsLocal(): LocalStore {
  if (!isBrowser()) return {};
  migrateCompat();
  return loadActive();
}

/**
 * (Opcional) Forzar activar/actualizar un programa en el store canónico.
 * No se usa automáticamente; llámalo SOLO desde tu handler de “Empezar programa”.
 */
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
