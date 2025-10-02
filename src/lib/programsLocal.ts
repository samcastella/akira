// Fuente única de verdad para Programas Activos en LocalStorage
export const LS_ACTIVE = 'akira_programs_active_v1';
const LS_ACTIVE_COMPAT_SINGLE = 'akira_program_active'; // legacy single-object

// Claves legacy adicionales encontradas en el proyecto
const LEGACY_ACTIVE_ARRAY_KEYS = [
  'akira_programs_active_v1',      // antigua (array de slugs)
  'akira_programs_active',
  'akira_active_programs_v1',
];
const LEGACY_STORE_KEYS = [
  'akira_programs_store_v1',       // antigua (obj: { slug: { startDate } })
  'akira_programs_store',
  'akira_programs_state_v1',
];

export type LocalProgram = {
  programSlug: string;                  // slug canónico (sin "-30")
  status: 'active' | 'paused' | 'completed';
  startedAt: number;                    // epoch ms (día 1 = 00:00 local)
  progress: any;
  updatedAt: number;                    // epoch ms
};

export type LocalStore = Record<string /* slug */, LocalProgram>;

/* =========================
   Utils
   ========================= */
function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
function writeJSON(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}
function ymdFromEpochMs(ms: number | undefined): string | undefined {
  if (!ms || !Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate()); // 00:00 local
  const z = new Date(local.getTime() - local.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function epochMsFromYmd(ymd: string | undefined): number | undefined {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const local = new Date(y, (m - 1), d); // 00:00 local
  return local.getTime();
}
function canonicalSlug(slug: string | undefined): string | undefined {
  if (!slug) return slug;
  return slug.endsWith('-30') ? slug.slice(0, -3) : slug;
}

/* =========================
   Lectura/Escritura canónica
   ========================= */
export function loadActive(): LocalStore {
  if (!isBrowser()) return {};
  const store = parseJSON<LocalStore>(localStorage.getItem(LS_ACTIVE), {});
  return normalizeStore(store);
}
export function saveActive(store: LocalStore) {
  if (!isBrowser()) return;
  writeJSON(LS_ACTIVE, normalizeStore(store));
}

/* =========================
   Migraciones (idempotentes)
   ========================= */
/** Migra desde la clave legacy *single-object* si existe. Legacy: { slug, startedAt?, currentDay? } */
export function migrateCompat(): void {
  if (!isBrowser()) return;
  try {
    const legacyRaw = localStorage.getItem(LS_ACTIVE_COMPAT_SINGLE);
    if (!legacyRaw) return;

    type Legacy = { slug: string; startedAt?: number; currentDay?: number };
    const legacy = parseJSON<Legacy>(legacyRaw, { slug: '' });

    if (legacy?.slug) {
      const current = loadActive();
      const slug = canonicalSlug(legacy.slug)!;
      if (!current[slug]) {
        const now = Date.now();
        current[slug] = {
          programSlug: slug,
          status: 'active',
          startedAt: legacy.startedAt ?? now,
          progress: { currentDay: legacy.currentDay ?? 1, days: {} },
          updatedAt: now,
        };
        saveActive(current);
      }
    }
    localStorage.removeItem(LS_ACTIVE_COMPAT_SINGLE);
  } catch { /* noop */ }
}

/**
 * Fusiona SIEMPRE datos legacy → canónico (arrays de slugs + store con startDate).
 * Construye/actualiza el store canónico con startedAt (epoch ms).
 */
export function migrateFromLegacyStores(): void {
  if (!isBrowser()) return;

  // 0) Cargar y normalizar el canónico actual
  const currentRaw = parseJSON<LocalStore>(localStorage.getItem(LS_ACTIVE), {});
  const merged: LocalStore = normalizeStore(currentRaw);
  const now = Date.now();

  // 1) Arrays legacy de slugs
  const legacyActiveAll: string[] = [];
  for (const k of LEGACY_ACTIVE_ARRAY_KEYS) {
    const arr = parseJSON<string[] | null>(localStorage.getItem(k), null);
    if (arr && Array.isArray(arr) && arr.length) legacyActiveAll.push(...arr);
  }
  for (const raw of legacyActiveAll) {
    const slug = canonicalSlug(raw);
    if (!slug) continue;
    if (!merged[slug]) {
      merged[slug] = {
        programSlug: slug,
        status: 'active',
        startedAt: now,                 // provisional hasta que lo mejoremos con startDate
        progress: { days: {} },
        updatedAt: now,
      };
    }
  }

  // 2) Stores legacy con startDate
  const legacyStores: Array<Record<string, { startDate?: string }>> = [];
  for (const k of LEGACY_STORE_KEYS) {
    const obj = parseJSON<Record<string, { startDate?: string }> | null>(localStorage.getItem(k), null);
    if (obj && typeof obj === 'object' && Object.keys(obj).length) legacyStores.push(obj);
  }
  for (const store of legacyStores) {
    for (const [rawSlug, st] of Object.entries(store)) {
      const slug = canonicalSlug(rawSlug);
      if (!slug) continue;
      const startMs = epochMsFromYmd(st?.startDate);
      if (!merged[slug]) {
        merged[slug] = {
          programSlug: slug,
          status: 'active',
          startedAt: startMs ?? now,
          progress: { days: {} },
          updatedAt: now,
        };
      } else if (startMs && (!Number.isFinite(merged[slug].startedAt) || !merged[slug].startedAt)) {
        merged[slug].startedAt = startMs;
        merged[slug].updatedAt = now;
      }
    }
  }

  // 3) Guardar normalizado (quita "-30", rellena startedAt/updatedAt, etc.)
  saveActive(merged);
}

/* =========================
   Normalización
   ========================= */
function normalizeStore(input: LocalStore): LocalStore {
  const out: LocalStore = {};
  const now = Date.now();

  for (const [rawSlug, lp] of Object.entries(input || {})) {
    const slug = canonicalSlug(rawSlug);
    if (!slug) continue;

    const startedAt =
      Number.isFinite(lp?.startedAt) ? lp.startedAt :
      epochMsFromYmd((lp as any)?.startDate as string) ?? now; // por si vino como startDate

    out[slug] = {
      programSlug: slug,
      status: lp?.status ?? 'active',
      startedAt: startedAt!,
      progress: lp?.progress ?? { days: {} },
      updatedAt: Number.isFinite(lp?.updatedAt) ? lp.updatedAt : now,
    };
  }
  return out;
}

/* =========================
   Helpers de alto nivel (para Mi zona)
   ========================= */
/** Devuelve slugs activos (canónicos) en orden de actualización reciente. */
export function getActiveSlugs(): string[] {
  const store = loadActive();
  return Object.values(store)
    .filter(p => p.status === 'active')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(p => p.programSlug);
}
/** Devuelve YYYY-MM-DD del inicio del programa (desde startedAt). */
export function getStartDateYMD(slug: string): string | undefined {
  const store = loadActive();
  const entry = store[canonicalSlug(slug)!];
  return ymdFromEpochMs(entry?.startedAt);
}
/** Calcula el índice de día relativo (0-based) para hoy (o un YYYY-MM-DD dado). */
export function getDayIndexFor(slug: string, todayYmd?: string): number | null {
  const startYmd = getStartDateYMD(slug);
  if (!startYmd) return null;

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
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const diff = Math.floor((b - a) / 86400000);
  return diff < 0 ? 0 : diff; // nunca negativo
}

/** Inicializa: migra legacy → canónico y devuelve el store final. */
export function initProgramsLocal(): LocalStore {
  if (!isBrowser()) return {};
  migrateCompat();
  migrateFromLegacyStores();
  const final = loadActive();
  saveActive(final); // asegurar normalización
  return final;
}

/** Activa/actualiza explícitamente un programa en el store canónico. */
export function ensureActive(
  slugRaw: string,
  opts?: { startYmd?: string; status?: LocalProgram['status'] }
) {
  if (!isBrowser()) return;
  const slug = canonicalSlug(slugRaw)!;
  const store = loadActive();
  const now = Date.now();
  const startMs = opts?.startYmd ? epochMsFromYmd(opts.startYmd) : undefined;

  store[slug] = {
    programSlug: slug,
    status: opts?.status ?? store[slug]?.status ?? 'active',
    startedAt: startMs ?? store[slug]?.startedAt ?? now,
    progress: store[slug]?.progress ?? { days: {} },
    updatedAt: now,
  };

  saveActive(store);
  try { window.dispatchEvent(new Event('akira:programs-updated')); } catch {}
}
