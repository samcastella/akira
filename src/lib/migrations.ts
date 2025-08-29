// src/lib/migrations.ts
import { todayKey } from '@/lib/date';
import { loadStore, saveStore, PROGRAMS, getRelativeDayIndexForDate } from '@/lib/programs';

const LS_RETOS = 'akira_mizona_retos_v1';

type RetoAny = {
  id: string;
  text: string;
  createdAt?: number;
  due?: string;
  done?: boolean;
  permanent?: boolean;
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
  catch { return fallback; }
}
function saveLS<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(val));
}

export function runMigrations() {
  if (typeof window === 'undefined') return;

  let changed = false;

  // 1) Retos: normaliza campos y deduplica por id
  {
    const raw = loadLS<RetoAny[]>(LS_RETOS, []);
    const today = todayKey();

    const byId = new Map<string, RetoAny>();
    for (const r of raw) {
      const item: RetoAny = {
        id: r.id,
        text: r.text,
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
        due: r.due ?? today,
        done: r.done ?? false,
        permanent: r.permanent ?? false,
      };
      // si hay duplicados, nos quedamos con el más reciente
      const prev = byId.get(item.id);
      if (!prev || (prev.createdAt ?? 0) < (item.createdAt ?? 0)) byId.set(item.id, item);
    }
    const next = Array.from(byId.values()).sort((a, b) =>
      (a.due! + String(a.createdAt)).localeCompare(b.due! + String(b.createdAt))
    );

    if (JSON.stringify(next) !== JSON.stringify(raw)) {
      saveLS(LS_RETOS, next);
      changed = true;
    }
  }

  // 2) Programas: limpia fechas e índices fuera de rango
  {
    const store = loadStore(); // ya hace la migración completedDates -> completedByDate
    let storeChanged = false;

    for (const key of Object.keys(store)) {
      const def = PROGRAMS[key];
      if (!def) {
        delete store[key];
        storeChanged = true;
        continue;
      }
      const dates = store[key].completedByDate || {};
      const cleaned: Record<string, number[]> = {};

      for (const d of Object.keys(dates)) {
        const rel = getRelativeDayIndexForDate(key, d);
        if (rel < 1) {
          // fecha fuera de rango → se descarta
          storeChanged = true;
          continue;
        }
        const nTasks = def.days[rel - 1]?.tasks.length ?? 0;
        const uniq = Array.from(new Set((dates[d] || []).filter((i) => Number.isInteger(i) && i >= 0 && i < nTasks))).sort((a, b) => a - b);
        cleaned[d] = uniq;
        if (uniq.length !== (dates[d] || []).length) storeChanged = true;
      }

      store[key].completedByDate = cleaned;
    }

    if (storeChanged) {
      saveStore(store);
      changed = true;
    }
  }

  return changed;
}
