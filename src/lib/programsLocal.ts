// Fuente única de verdad para Programas Activos en LocalStorage
export const LS_ACTIVE = 'akira_programs_active_v1';
const LS_ACTIVE_COMPAT_SINGLE = 'akira_program_active'; // legacy single-object

// Claves legacy adicionales que hemos visto en el proyecto
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
  startedAt: number;                    // epoch ms (día 1 = fecha local a las 00:00)
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
  // normalizamos a día local (00:00) y formateamos a YYYY-MM-DD (zona local)
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const z = new Date(local.getTime() - local.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function epochMsFromYmd(ymd: string | undefined): number | undefined {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split('-').map(n => parseInt(n, 10));
  const local = new Date(y, (m - 1), d);              // 00:00 local
  return local.getTime();
}

function canonicalSlug(slug: string | undefined): string | undefined {
  if (!slug) return slug;
  return slug.endsWith('-30') ? slug.slice(0, -3) : slug;
}

/* =========================
   Lectura/Escritura canónica
   ========================= */

/** Lee la estructura actual (v1). */
export function loadActive(): LocalStore {
  if (!isBrowser()) return {};
  const store = parseJSON<LocalStore>(localStorage.getItem(LS_ACTIVE), {});
  return normalizeStore(store);
}

/** Guarda la estructura actual (v1). */
export function saveActive(store: LocalStore) {
  if (!isBrowser()) return;
  writeJSON(LS_ACTIVE, normalizeStore(store));
}

/* =========================
   Migraciones (idempotentes)
   ========================= */

/**
 * Migra desde la clave legacy *single-object* si existe.
 * Legacy: { slug, startedAt?, currentDay? }
 */
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
          progress: {
            currentDay: legacy.currentDay ?? 1,
            days: {},
          },
          updatedAt: now,
        };
        saveActive(current);
      }
    }
    localStorage.removeItem(LS_ACTIVE_COMPAT_SINGLE);
  } catch { /* no romper flujo */ }
}

/**
 * Migra desde los *arrays de slugs activos* y el *store con startDate* (YYYY-MM-DD) si existieran.
 * Construye LocalStore canónico con startedAt (epoch ms).
 */
export function migrateFromLegacyStores(): void {
  if (!isBrowser()) return;

  // si ya tenemos datos en la key canónica, no hacemos nada
  const current = parseJSON<LocalStore>(localStorage.getItem(LS_ACTIVE), {});
  const hasCurrent = Object.keys(current).length > 0;

  if (hasCurrent) {
    // aún así normalizamos por si hay slugs con "-30"
    saveActive(current);
    return;
  }

  // 1) buscar arrays de slugs
  let legacyActive: string[] | null = null;
  for (const k of LEGACY_ACTIVE_ARRAY_KEYS) {
    const arr = parseJSON<string[] | null>(localStorage.getItem(k), null);
    if (arr && Array.isArray(arr) && arr.length) { legacyActive = arr; break; }
  }

  // 2) buscar store con startDate
  let legacyStore: Record<string, { startDate?: string }> | null = null;
  for (const k of LEGACY_STORE_KEYS) {
    const obj = parseJSON<Record<string, { startDate?: string }> | null>(localStorage.getItem(k), null);
    if (obj && typeof obj === 'object' && Object.keys(obj).length) { legacyStore = obj; break; }
  }

  if (!legacyActive && !legacyStore) return; // nada que migrar

  const migrated: LocalStore = {};
  const now = Date.now();

  // Si hay active array, construir esqueleto
  if (legacyActive) {
    for (const raw of legacyActive) {
      const slug = canonicalSlug(raw)!;
      if (!slug) continue;
      migrated[slug] = {
        programSlug: slug,
        status: 'active',
        startedAt: now,   // provisional; intentaremos mejorar con startDate abajo
        progress: { days: {} },
        updatedAt: now,
      };
    }
  }

  // Si hay store con startDate, enriquecer startedAt
  if (legacyStore) {
    for (const [rawSlug, st] of Object.entries(legacyStore)) {
      const slug = canonicalSlug(rawSlug)!;
      const startMs = epochMsFromYmd(st?.startDate);
      if (!migrated[slug]) {
        migrated[slug] = {
          programSlug: slug,
          status: 'active',
          startedAt: startMs ?? now,
          progress: { days: {} },
          updatedAt: now,
        };
      } else if (startMs) {
        migrated[slug].startedAt = startMs;
        migrated[slug].updatedAt = now;
      }
    }
  }

  // Guardar canónico y limpiar legacy si procede
  if (Object.keys(migrated).length) {
    saveActive(migrated);
  }
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

/** Devuelve YYYY-MM-DD del inicio del programa (cálculo desde startedAt). */
export function getStartDateYMD(slug: string): string | undefined {
  const store = loadActive();
  const entry = store[canonicalSlug(slug)!];
  return ymdFromEpochMs(entry?.startedAt);
}

/** Calcula el índice de día relativo (0-based) para hoy (o para un YYYY-MM-DD específico). */
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

/** Inicializa el sistema local: migra legacy → canónico y devuelve el store final. */
export function initProgramsLocal(): LocalStore {
  if (!isBrowser()) return {};
  migrateCompat();
  migrateFromLegacyStores();
  const final = loadActive();
  saveActive(final); // asegurar normalización
  return final;
}
