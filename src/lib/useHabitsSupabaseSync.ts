// src/lib/useHabitsSupabaseSync.ts
import { useEffect, useRef } from 'react';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY  = 'akira_habits_daily_v1';

export type HabitMaster = {
  id: string;
  rid?: string;
  name: string;
  icon?: string;
  color?: string;
  startDate?: string;
  endDate?: string;
  weekend?: boolean;
  updated_at?: string;
  deleted_at?: string | null;
};

/* ===== LocalStorage ===== */
function loadMasters(): HabitMaster[] {
  try { return JSON.parse(localStorage.getItem(LS_HABITS_MASTER) || '[]') as HabitMaster[]; } catch { return []; }
}
function saveMasters(arr: HabitMaster[]) {
  localStorage.setItem(LS_HABITS_MASTER, JSON.stringify(arr));
  // señal suave para la UI (mis-habitos escucha algunos eventos propios)
  try { window.dispatchEvent(new Event('akira:masters-updated')); } catch {}
}
type DailyEntry = { done: boolean; doneAt?: number; updated_at?: string };
type DailyMap = Record<string, Record<string, DailyEntry>>;
function loadDaily(): DailyMap {
  try { return JSON.parse(localStorage.getItem(LS_HABITS_DAILY) || '{}') as DailyMap; } catch { return {}; }
}
function saveDaily(map: DailyMap) {
  localStorage.setItem(LS_HABITS_DAILY, JSON.stringify(map));
}

const nowIso = () => new Date().toISOString();
const dateKeyTZ = (d = new Date(), tz = 'Europe/Madrid') => {
  const parts = new Intl.DateTimeFormat('es-ES', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const g = (t:string) => parts.find(p=>p.type===t)?.value!;
  return `${g('year')}-${g('month')}-${g('day')}`;
};

/* ===== Colas ===== */
type MasterUpsert = HabitMaster;
const masterQueue: MasterUpsert[] = [];
let flushingMasters = false;

export function queueMasterUpsert(master: HabitMaster) {
  masterQueue.push({ ...master, updated_at: master.updated_at ?? nowIso() });
}

type TickUpsert = {
  habit_id: string;     // id local del hábito
  date_key: string;     // YYYY-MM-DD
  done: boolean;
  done_at: string | null;
  updated_at: string;
};
const tickQueue: TickUpsert[] = [];
export function queueTickUpsert(t: TickUpsert) { tickQueue.push(t); }

/* ===== Masters: pull / flush ===== */
async function pullHabitMasters(uid: string) {
  const { data, error } = await supabase
    .from('habit_masters')
    .select('id, user_id, local_id, title, icon, color, start_date, end_date, weekend, updated_at, deleted_at')
    .eq('user_id', uid);

  if (error) { console.warn('[pullHabitMasters] error', error); return; }

  const remote = (data || []).map(r => ({
    id: String(r.local_id || ''),
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
    if (!l) { byLocalId.set(r.id, r); changed = true; continue; }
    const lt = l.updated_at ? Date.parse(l.updated_at) : 0;
    const rt = r.updated_at ? Date.parse(r.updated_at) : 0;
    if (rt > lt) { byLocalId.set(r.id, { ...l, ...r }); changed = true; }
    else if (lt > rt) masterQueue.push({ ...l });
  }

  for (const l of local) {
    if (!remote.find(r => r.id === l.id)) masterQueue.push({ ...l, updated_at: l.updated_at ?? nowIso() });
  }

  if (changed) saveMasters(Array.from(byLocalId.values()));
}

async function flushMasters(uid: string) {
  if (flushingMasters || masterQueue.length === 0) return;
  flushingMasters = true;
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
    const { error } = await supabase.from('habit_masters').upsert(rows, { onConflict: 'user_id,local_id' });
    if (error) { console.warn('[flushMasters] upsert error', error); masterQueue.unshift(...batch); return; }
  } finally { flushingMasters = false; }
}

/* ===== Ticks: merge local ===== */
function mergeTickIntoLocal(row: {
  local_id?: string | number;
  habit_id?: string; // compat
  date_key: string;
  done: boolean;
  done_at: string | null;
  updated_at: string | null;
}) {
  const hid = row.local_id != null ? String(row.local_id) : (row.habit_id ?? undefined);
  if (!hid) return false;

  const map = loadDaily();
  const dKey = row.date_key;
  const bucket = { ...(map[dKey] ?? {}) };
  const current = bucket[hid] ?? { done: false, updated_at: null as string | null };
  const curTs = current.updated_at ? Date.parse(current.updated_at) : -1;
  const newTs = row.updated_at ? Date.parse(row.updated_at) : Date.now();

  if (newTs >= curTs) {
    bucket[hid] = {
      done: !!row.done,
      doneAt: row.done && row.done_at ? Date.parse(row.done_at) : current.doneAt,
      updated_at: row.updated_at ?? nowIso(),
    };
    map[dKey] = bucket;
    saveDaily(map);
    return true;
  }
  return false;
}

async function pullHabitTicksRange(uid: string, fromKey: string, toKey: string) {
  const { data, error } = await supabase
    .from('habit_ticks')
    .select('local_id,date_key,done,done_at,updated_at')
    .eq('user_id', uid)
    .gte('date_key', fromKey)
    .lte('date_key', toKey);

  if (error) { console.warn('[pullHabitTicksRange] error', error); return; }
  for (const r of data ?? []) mergeTickIntoLocal(r as any);
}

/* ===== Ticks: flush con fallback ===== */
async function flushTicks(uid: string) {
  if (tickQueue.length === 0) return;

  // 1) Intento UPsert por (user_id, local_id, date_key)
  const batch = tickQueue.splice(0, tickQueue.length);
  const rowsLocalId = batch.map(t => ({
    user_id: uid,
    local_id: t.habit_id,
    date_key: t.date_key,
    done: t.done,
    done_at: t.done_at,
    updated_at: t.updated_at,
  }));

  const tryUpsert = async () =>
    supabase.from('habit_ticks').upsert(rowsLocalId, { onConflict: 'user_id,local_id,date_key' });

  let up = await tryUpsert();

  // 2) Si falla por 42P10 (no hay índice único), hacemos delete+insert (idempotente)
  if (up.error && (up.error as any)?.code === '42P10') {
    console.warn('[flushTicks] upsert 42P10 → fallback delete+insert');

    // delete en lote por filtro IN
    const dels = await Promise.all(batch.map(t =>
      supabase.from('habit_ticks')
        .delete()
        .eq('user_id', uid)
        .eq('local_id', t.habit_id)
        .eq('date_key', t.date_key)
    ));
    const delErr = dels.find(r => r.error)?.error;
    if (delErr) console.warn('[flushTicks] delete error (fallback)', delErr);

    const ins = await supabase.from('habit_ticks').insert(rowsLocalId);
    if (ins.error && (ins.error as any)?.code === '42703') {
      // 3) La columna puede llamarse `habit_id` en tu esquema: reintento
      console.warn('[flushTicks] insert con local_id → 42703. Reintento con habit_id.');
      const rowsHabitId = batch.map(t => ({
        user_id: uid,
        habit_id: t.habit_id,
        date_key: t.date_key,
        done: t.done,
        done_at: t.done_at,
        updated_at: t.updated_at,
      }));
      const ins2 = await supabase.from('habit_ticks').insert(rowsHabitId);
      if (ins2.error) {
        console.warn('[flushTicks] insert con habit_id también falló', ins2.error);
        tickQueue.unshift(...batch); // re-encolar
        return;
      }
    } else if (ins.error) {
      console.warn('[flushTicks] insert (fallback) falló', ins.error);
      tickQueue.unshift(...batch);
      return;
    }
  } else if (up.error) {
    // Otro error → re-encolar
    console.warn('[flushTicks] upsert error', up.error);
    tickQueue.unshift(...batch);
    return;
  }

  // 4) Refresco corto inmediato (re-hidratar local sin esperar 15s)
  try {
    const to = dateKeyTZ(new Date());
    const d = new Date(); d.setDate(d.getDate() - 1);
    const from = dateKeyTZ(d);
    await pullHabitTicksRange(uid, from, to);
  } catch (e) {
    console.warn('[flushTicks] immediate pull failed', e);
  }
}

/* ===== Realtime ===== */
function subscribeRealtime(uid: string) {
  const chTicks = supabase.channel('rt-habit-ticks')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'habit_ticks', filter: `user_id=eq.${uid}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as any;
        if (!row?.date_key) return;
        mergeTickIntoLocal({
          local_id: row.local_id,
          habit_id: row.habit_id,
          date_key: row.date_key,
          done: !!row.done,
          done_at: row.done_at ?? null,
          updated_at: row.updated_at ?? nowIso(),
        });
      })
    .subscribe();

  const chMasters = supabase.channel('rt-habit-masters')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'habit_masters', filter: `user_id=eq.${uid}` },
      async () => { await pullHabitMasters(uid); })
    .subscribe();

  return () => {
    try { supabase.removeChannel(chTicks); } catch {}
    try { supabase.removeChannel(chMasters); } catch {}
  };
}

/* ===== Hook ===== */
export function useHabitsSupabaseSync(uid?: string) {
  const timerRef = useRef<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isSupabaseEnvReady()) return;
    if (!uid) return;

    // Debug helpers
    try {
      (window as any).__akiraSync = {
        async pull(n = 3) {
          const to = dateKeyTZ(new Date());
          const d = new Date(); d.setDate(d.getDate() - n);
          const from = dateKeyTZ(d);
          await pullHabitTicksRange(uid, from, to);
          await pullHabitMasters(uid);
          return { ok: true, from, to };
        },
        async flush() { await flushMasters(uid); await flushTicks(uid); return { ok: true }; },
        daily(day?: string) {
          const map = loadDaily();
          const key = day || dateKeyTZ(new Date());
          return { key, bucket: map[key] || {}, raw: map };
        }
      };
    } catch {}

    // Pull inicial
    void pullHabitMasters(uid);
    const to = dateKeyTZ(new Date());
    const d = new Date(); d.setDate(d.getDate() - 3);
    const from = dateKeyTZ(d);
    void pullHabitTicksRange(uid, from, to);

    // Flush inicial
    void flushMasters(uid);
    void flushTicks(uid);

    // Realtime
    unsubRef.current = subscribeRealtime(uid);

    // Bucle periódico
    const beat = async () => {
      const _to = dateKeyTZ(new Date());
      const _d = new Date(); _d.setDate(_d.getDate() - 3);
      const _from = dateKeyTZ(_d);
      await pullHabitTicksRange(uid, _from, _to);
      await pullHabitMasters(uid);
      await flushMasters(uid);
      await flushTicks(uid);
    };

    timerRef.current = window.setInterval(beat, 15000);
    const vis = () => { if (document.visibilityState === 'hidden') void beat(); };
    document.addEventListener('visibilitychange', vis);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', vis);
      if (unsubRef.current) unsubRef.current();
    };
  }, [uid]);
}
