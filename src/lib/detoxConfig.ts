// src/lib/detoxConfig.ts
export type DetoxAppLimit = {
  appId: string;            // id interno (slug o bundle id si lo tuviéramos)
  name: string;             // nombre visible ("Instagram")
  minutesPerDay: number;    // minutos/día
};

export type DetoxCategoryLimit = {
  categoryId: string;       // id interno ("social", "video", "juegos"...)
  name: string;             // nombre visible
  minutesPerDay: number;
};

export type DetoxWindow = {
  id: string;               // uuid-like
  label: string;            // "Desconexión nocturna"
  from: string;             // "22:00" (HH:mm 24h)
  to: string;               // "07:00"
  days: number[];           // 1..7 (1=Lunes, 7=Domingo)
};

export type DetoxConfig = {
  version: 1;
  slug: string;             // "detox-tecnologico-30"
  user_id?: string | null;  // para persistencia remota posterior
  apps: DetoxAppLimit[];
  categories: DetoxCategoryLimit[];
  windows: DetoxWindow[];
  created_at: string;       // ISO
  updated_at: string;       // ISO
};

// ====== Semillas opcionales ======
export const SUGGESTED_APPS: DetoxAppLimit[] = [
  { appId: 'instagram', name: 'Instagram', minutesPerDay: 20 },
  { appId: 'tiktok', name: 'TikTok', minutesPerDay: 15 },
  { appId: 'youtube', name: 'YouTube', minutesPerDay: 25 },
  { appId: 'x', name: 'X (Twitter)', minutesPerDay: 10 },
];

export const SUGGESTED_CATEGORIES: DetoxCategoryLimit[] = [
  { categoryId: 'social', name: 'Redes sociales', minutesPerDay: 30 },
  { categoryId: 'video', name: 'Vídeo/Streaming', minutesPerDay: 40 },
  { categoryId: 'games', name: 'Juegos', minutesPerDay: 20 },
];

export const PRESET_WINDOWS: DetoxWindow[] = [
  { id: 'night', label: 'Desconexión nocturna', from: '22:00', to: '07:00', days: [1,2,3,4,5,6,7] },
  { id: 'deepwork', label: 'Deep Work (laborables)', from: '09:30', to: '11:30', days: [1,2,3,4,5] },
];

// ====== Helpers ======
function keyFor(uid: string | undefined, slug: string) {
  const u = uid || 'anon';
  return `akira_detox_config_v1:${u}:${slug}`;
}

export function newConfig(slug: string, uid?: string | null): DetoxConfig {
  const now = new Date().toISOString();
  return {
    version: 1,
    slug,
    user_id: uid ?? null,
    apps: [],
    categories: [],
    windows: [],
    created_at: now,
    updated_at: now,
  };
}

export function validateConfig(cfg: DetoxConfig): { ok: true } | { ok: false; reason: string } {
  if (!cfg?.slug) return { ok: false, reason: 'slug vacío' };

  const minsOk = (n: number) => Number.isFinite(n) && n >= 0 && n <= 24 * 60;
  for (const a of cfg.apps) {
    if (!a.appId || !a.name) return { ok: false, reason: 'app sin id o nombre' };
    if (!minsOk(a.minutesPerDay)) return { ok: false, reason: `minutos inválidos en app ${a.name}` };
  }
  for (const c of cfg.categories) {
    if (!c.categoryId || !c.name) return { ok: false, reason: 'categoría sin id o nombre' };
    if (!minsOk(c.minutesPerDay)) return { ok: false, reason: `minutos inválidos en categoría ${c.name}` };
  }
  for (const w of cfg.windows) {
    if (!w.id || !w.label) return { ok: false, reason: 'ventana sin id o label' };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(w.from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.to)) {
      return { ok: false, reason: `hora inválida en ventana ${w.label}` };
    }
    if (!Array.isArray(w.days) || w.days.some(d => d < 1 || d > 7)) {
      return { ok: false, reason: `días inválidos en ventana ${w.label}` };
    }
  }

  // debe haber al menos algún límite o alguna ventana
  if (cfg.apps.length + cfg.categories.length + cfg.windows.length === 0) {
    return { ok: false, reason: 'config vacía: añade límites o ventanas' };
  }
  return { ok: true };
}

export function loadDetoxConfig(slug: string, uid?: string | null): DetoxConfig | null {
  try {
    const raw = localStorage.getItem(keyFor(uid ?? undefined, slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DetoxConfig;
    return parsed ?? null;
  } catch {
    return null;
  }
}

export function saveDetoxConfig(cfg: DetoxConfig, uid?: string | null) {
  const now = new Date().toISOString();
  const toSave = { ...cfg, updated_at: now };
  localStorage.setItem(keyFor(uid ?? undefined, cfg.slug), JSON.stringify(toSave));
  return toSave as DetoxConfig;
}

export function clearDetoxConfig(slug: string, uid?: string | null) {
  localStorage.removeItem(keyFor(uid ?? undefined, slug));
}

// Pequeño util para ids legibles
export function uid(prefix = 'w'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
