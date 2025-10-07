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

// ===== helpers LS =====
function loadMasters(): HabitMaster[] {
  try { return JSON.parse(localStorage.getItem(LS_HABITS_MASTER) || '[]') as HabitMaster[]; } catch { return []; }
}
function saveMasters(arr: HabitMaster[]) {
  localStorage.setItem(LS_HABITS_MASTER, JSON.stringify(arr));
}
type DailyEntry = { done: boolean; doneAt?: number; updated_at?: string };
type DailyMap = Record<string, Record<string, DailyEntry>>;
function loadDaily(): DailyMap {
  try { return JSON.parse(localStorage.getItem(LS_HABITS_DAILY) || '{}') as DailyMap; } catch { return {}; }
}
function saveDaily(map: DailyMap) {
  localStorage.setItem(LS_HABITS_DAILY, JSON.stringify(map));
}
function nowIso() { return new Date().toISOString(); }
function uuid() { try { return crypto.randomUUID(); } catch { return `cli-${Date.now()}-${Math.random().toString(16).slice(2)}`; } }

// YYYY-MM-DD Europe/Madrid
function dateKeyTZ(d = new Date(), tz = 'Europe/Madrid') {
  const parts = new Intl.DateTimeFormat('es-ES', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const g = (t:string) => parts.find(p=>p.type===t)?.value!;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

// ===== cola masters =====
type MasterUpsert = HabitMaster;
const masterQueue: MasterUpsert[] = [];
let flushing = false;

export function queueMasterUpsert(master: HabitMaster) {
  masterQueue.push({ ...master, updated_at: master.updated_at ?? nowIso() });
}

// ===== cola ticks =====
type TickUpsert = {
  habit_id: string;     // local id
  date_key: string;     // YYYY-MM-DD
  done: boolean;
  done_at: string | null;
  updated_at: string;
};
const tickQueue: TickUpsert[] = [];
export function queueTickUpsert(t: TickUpsert) { tickQueue.push(t); }

// ===== masters pull/flush =====
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
    const { error } = await supabase.from('habit_masters').upsert(rows, { onConflict: 'user_id,local_id' });
    if (error) { console.warn('[flushMasters] upsert error', error); masterQueue.unshift(...batch); return; }

    const { data: refreshed } = await supabase
      .from('habit_masters')
      .select('id, user_id, local_id, title, icon, color, start_date, end_date, weekend, updated_at, deleted_at')
      .eq('user_id', uid);

    if (refreshed) {
      const map = new Map(loadMasters().map(m => [m.id, m]));
      for (const r of refreshed) {
        const id = String(r.local_id || '');
        const prev = map.get(id);
        map.set(id, {
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
        });
      }
      saveMasters(Array.from(map.values()));
    }
  } finally { flushing = false; }
}

// ===== Ticks: pull/merge + flush =====
function mergeTickIntoLocal(row: {
  habit_id?: string;
  local_id?: string | number;
  date_key: string;
  done: boolean;
  done_at: string | null;
  updated_at: string | null;
}) {
  const hid = row.habit_id ?? (row.local_id != null ? String(row.local_id) : undefined);
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
    .select('id,habit_id,local_id,date_key,done,done_at,updated_at') // traemos id por si hace falta
    .eq('user_id', uid)
    .gte('date_key', fromKey)
    .lte('date_key', toKey);
  if (error) { console.warn('[pullHabitTicksRange] error', error); return; }
  for (const r of data ?? []) mergeTickIntoLocal(r as any);
}

async function flushTicks(uid: string) {
  if (tickQueue.length === 0) return;

  const batch = tickQueue.splice(0, tickQueue.length);

  // 👇 Si la tabla exige id NOT NULL sin default, lo enviamos.
  const rows = batch.map(t => ({
    id: uuid(),                // seguro para NOT NULL en tablas sin default
    user_id: uid,
    local_id: t.habit_id,      // compat
    date_key: t.date_key,
    done: t.done,
    done_at: t.done_at,
    updated_at: t.updated_at,
  }));

  const { error } = await supabase.from('habit_ticks').upsert(rows, {
    onConflict: 'user_id,local_id,date_key',
  });

  if (error) {
    console.warn('[flushTicks] upsert error', {
      code: (error as any)?.code, message: (error as any)?.message,
      details: (error as any)?.details, hint: (error as any)?.hint
    });
    // re-encolar para reintentar
    const back = batch.map(b => ({ ...b }));
    tickQueue.unshift(...back);
  }
}

export function useHabitsSupabaseSync(uid?: string) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isSupabaseEnvReady()) return;
    if (!uid) return;

    // ===== expone helpers en ventana (debug)
    try {
      (window as any).__akiraSync = {
        async pull(n = 3) {
          const to = dateKeyTZ(new Date());
          const d = new Date(); d.setDate(d.getDate() - n);
          const from = dateKeyTZ(d);
          await pullHabitTicksRange(uid, from, to);
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

    // pull inicial
    void pullHabitMasters(uid);
    const to = dateKeyTZ(new Date());
    const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - 3);
    const from = dateKeyTZ(fromDate);
    void pullHabitTicksRange(uid, from, to);

    // flush inicial
    void flushMasters(uid);
    void flushTicks(uid);

    const tick = async () => {
      const _to = dateKeyTZ(new Date());
      const _d = new Date(); _d.setDate(_d.getDate() - 3);
      const _from = dateKeyTZ(_d);
      await pullHabitTicksRange(uid, _from, _to);
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
