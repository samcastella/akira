// src/lib/useDailySync.ts
'use client';

import { useEffect } from 'react';
import { LEGACY_TO_SLUG } from '@/lib/programs_map';
import { getProgram as getMeta } from '@/lib/programs_catalog';
import { loadStore, getRelativeDayIndexForDate } from '@/lib/programs';
import { todayKey } from '@/lib/date';

const LS_RETOS = 'akira_mizona_retos_v1';
const LS_DAILY_SYNC = 'akira_daily_sync_date';

type Reto = {
  id: string;           // prog:<legacyKey>:YYYY-MM-DD  (determinista)
  text: string;         // ej. "La máquina lectora — Día 2: 15 min"
  createdAt: number;
  due: string;          // YYYY-MM-DD
  done: boolean;        // normalizado a false al crear
  permanent?: boolean;  // opcional (no se usa aquí)
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
  catch { return fallback; }
}
function saveLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function useDailySync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const today = todayKey();

    // Evita ejecutar más de una vez por día
    const last = loadLS<string | null>(LS_DAILY_SYNC, null);
    if (last === today) return;

    const retos = loadLS<Reto[]>(LS_RETOS, []);
    const store = loadStore();

    Object.keys(store).forEach((legacyKey) => {
      const slug = LEGACY_TO_SLUG[legacyKey]; // puede ser undefined si aún no hay metadatos
      const dayIdx = getRelativeDayIndexForDate(legacyKey, today);
      if (dayIdx < 1) return; // todavía no empezó o fuera de rango

      const retoId = `prog:${legacyKey}:${today}`;
      // si ya existe este reto, no lo dupliques
      if (retos.some((r) => r.id === retoId)) return;

      // Construye el texto usando el catálogo si existe
      let text = `Programa ${legacyKey} — Día ${dayIdx}`;
      if (slug) {
        try {
          const meta = getMeta(slug as any);
          const idx = Math.max(0, Math.min(dayIdx - 1, meta.durationDays - 1));
          const val = meta.plan[idx];
          const unit = meta.unit === 'minutes' ? 'min' : meta.unit;
          text = `${meta.title} — Día ${dayIdx}: ${val} ${unit}`;
        } catch {
          // si falla el meta, deja el texto genérico
        }
      }

      retos.push({
        id: retoId,
        text,
        createdAt: Date.now(),
        due: today,     // ⬅️ normalizado
        done: false,    // ⬅️ normalizado
      });
    });

    saveLS(LS_RETOS, retos);
    saveLS(LS_DAILY_SYNC, today);
  }, []);
}
