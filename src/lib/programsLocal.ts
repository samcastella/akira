// Fuente única de verdad para Programas Activos en LocalStorage
export const LS_ACTIVE = 'akira_programs_active_v1';
const LS_ACTIVE_COMPAT = 'akira_program_active'; // legacy

export type LocalProgram = {
  programSlug: string;
  status: 'active' | 'paused' | 'completed';
  startedAt: number; // epoch ms
  progress: any;
  updatedAt: number; // epoch ms
};

export type LocalStore = Record<string /* slug */, LocalProgram>;

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/** Lee la estructura actual (v1). */
export function loadActive(): LocalStore {
  if (typeof window === 'undefined') return {};
  return parseJSON<LocalStore>(localStorage.getItem(LS_ACTIVE), {});
}

/** Guarda la estructura actual (v1). */
export function saveActive(store: LocalStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_ACTIVE, JSON.stringify(store));
}

/** Migra desde la clave legacy si existe y luego la elimina. Idempotente. */
export function migrateCompat(): void {
  if (typeof window === 'undefined') return;
  try {
    const legacyRaw = localStorage.getItem(LS_ACTIVE_COMPAT);
    if (!legacyRaw) return;

    // La legacy solía ser un único programa { slug, startedAt, currentDay }
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
    // si algo falla, no rompemos flujo
  }
}
