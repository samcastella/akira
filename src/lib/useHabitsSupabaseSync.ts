// src/lib/useHabitsSupabaseSync.ts
import { useEffect, useRef } from 'react';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY  = 'akira_habits_daily_v1';

export type HabitMaster = {
  id: string;         // id local (string)
  rid?: string;       // id remoto (uuid) opcional
  name: string;
  icon?: string;
  color?: string;
  startDate?: string;
  endDate?: string;
  weekend?: boolean;  // false = no contar findes
  updated_at?: string; // ISO (cliente/servidor)
  deleted_at?: string | null;
};

// ===== helpers LS =====
function loadMasters(): HabitMaster[] {
  try { return JSON.parse(localStorage.getItem(LS_HABITS_MASTER) || '[]') as HabitMaster[]; } catch { return []; }
}
function saveMasters(arr: HabitMaster[]) {
  localStorage.setItem(LS_HABITS_MASTER, JSON.stringify(arr));
}
function nowIso() { return new Date().toISOString(); }

// ===== cola in-memory =====
type MasterUpsert = HabitMaster;
const masterQueue: MasterUpsert[] = [];
let flushing = false;

// Exportado para que el UI encole al crear/editar
export function queueMasterUpsert(master: HabitMaster) {
  // garantizamos updated_at
  const m: HabitMaster = { ...master, updated_at: master.updated_at ?? nowIso() };
  masterQueue.push(m);
}

// ====== ticks (ya lo usabas) ======
type TickUpsert = {
  habit_id: string;     // local id
  date_key: string;     // 'YYYY-MM-DD'
  done: boolean;
  done_at: string | null;
  updated_at: string;
};
const tickQueue: TickUpsert[] = [];
export function queueTickUpsert(t: TickUpsert) { tickQueue.push(t); }

// ===== reconciliación masters local <-> remoto =====
async function pullHabitMasters(uid: string) {
  const { data, error } = await supabase
    .from('habit_masters')
    .select('id, user_id, local_id, title, icon, color, start_date, end_date, weekend, updated_at, deleted_at')
    .eq('user_id', uid);
  if (error) { console.warn('[pullHabitMasters] error', error); return; }

  const remote = (data || []).map(r => ({
    id: String(r.local_id || ''), // local key
    rid: r.id,
    name: r.title,
    icon: r.icon || undefined,
    color: r.color || undefined,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    weekend: typeof r.weekend === 'boolean' ? r.weekend : undefined,
    updated_at: r.updated_at || undefined,
    deleted_at: r.deleted_at || null,
  })) as HabitMaster[];

  const local = loadMasters();
  const byLocalId = new Map(local.map(m => [m.id, m]));
  let changed = false;

  for (const r of remote) {
    const l = byLocalId.get(r.id);
    // Si no existe local → añadir
    if (!l) {
      byLocalId.set(r.id, r);
      changed = true;
      continue;
    }
    // si remoto es más nuevo → reemplazar/merge
    const lt = l.updated_at ? new Date(l.updated_at).getTime() : 0;
    const rt = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    if (rt > lt) {
      byLocalId.set(r.id, { ...l, ...r });
      changed = true;
    } else {
      // si local es más nuevo, lo encolamos para subir
      if (lt > rt) masterQueue.push({ ...l });
    }
  }

  // locales que no están en remoto → encolar subida (migración)
  for (const l of local) {
    if (!remote.find(r => r.id === l.id)) {
      // solo si no está borrado
      masterQueue.push({ ...l, updated_at: l.updated_at ?? nowIso() });
    }
  }

  if (changed) saveMasters(Array.from(byLocalId.values()));
}

async function flushMasters(uid: string) {
  if (flushing || masterQueue.length === 0) return;
  flushing = true;
  try {
    const batch = masterQueue.splice(0, masterQueue.length);

    const rows = batch.map(m => ({
      user_id: uid,
      local_id: m.id,
      title: m.name,
      icon: m.icon ?? null,
      color: m.color ?? null,
      start_date: m.startDate ?? null,
      end_date: m.endDate ?? null,
      weekend: typeof m.weekend === 'boolean' ? m.weekend : null,
      updated_at: m.updated_at ?? nowIso(),
      deleted_at: m.deleted_at ?? null,
    }));

    const { error } = await supabase.from('habit_masters').upsert(rows, {
      onConflict: 'user_id,local_id',
    });
    if (error) {
      console.warn('[flushMasters] upsert error', error);
      // re-encolar para intentar más tarde
      masterQueue.unshift(...batch);
      return;
    }

    // refrescamos local: asignar rid si vino del server
    const { data: refreshed, error: selErr } = await supabase
      .from('habit_masters')
      .select('id, user_id, local_id, title, icon, color, start_date, end_date, weekend, updated_at, deleted_at')
      .eq('user_id', uid);

    if (!selErr && refreshed) {
      const map = new Map(loadMasters().map(m => [m.id, m]));
      for (const r of refreshed) {
        const id = String(r.local_id || '');
        const prev = map.get(id);
        const merged: HabitMaster = {
          ...(prev ?? { id }),
          rid: r.id,
          name: r.title,
          icon: r.icon || undefined,
          color: r.color || undefined,
          startDate: r.start_date || undefined,
          endDate: r.end_date || undefined,
          weekend: typeof r.weekend === 'boolean' ? r.weekend : undefined,
          updated_at: r.updated_at || prev?.updated_at,
          deleted_at: r.deleted_at || null,
        };
        map.set(id, merged);
      }
      saveMasters(Array.from(map.values()));
    }
  } finally {
    flushing = false;
  }
}

async function flushTicks(uid: string) {
  if (tickQueue.length === 0) return;
  const batch = tickQueue.splice(0, tickQueue.length);
  const rows = batch.map(t => ({
    user_id: uid,
    local_id: t.habit_id,
    date_key: t.date_key,
    done: t.done,
    done_at: t.done_at,
    updated_at: t.updated_at,
  }));
  const { error } = await supabase.from('habit_ticks').upsert(rows, {
    onConflict: 'user_id,local_id,date_key',
  });
  if (error) {
    console.warn('[flushTicks] upsert error', error);
    tickQueue.unshift(...batch); // re-encolar
  }
}

export function useHabitsSupabaseSync(uid?: string) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSupabaseEnvReady()) return;
    if (!uid) return;

    // pull inicial (masters) y flush inicial (masters + ticks)
    void pullHabitMasters(uid);
    void flushMasters(uid);
    void flushTicks(uid);

    const tick = async () => {
      await flushMasters(uid);
      await flushTicks(uid);
    };

    timerRef.current = window.setInterval(tick, 15000);
    const vis = () => { if (document.visibilityState === 'hidden') void tick(); };
    document.addEventListener('visibilitychange', vis);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [uid]);
}
