import { useEffect, useRef } from 'react';
import { supabase, isSupabaseEnvReady } from '@/lib/supabaseClient';

const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY = 'akira_habits_daily_v1';

/* =========================
 Tipos
========================= */
export type HabitPerDayItem = {
  id: string;
  name?: string;
  description?: string;
};
export type HabitPerDay = Record<string, { items: HabitPerDayItem[] }>;

export type HabitMaster = {
  id: string;              // local_id
  rid?: string;            // id remoto (uuid)
  name: string;            // title
  icon?: string;           // emoji
  color?: string;          // '#xxxxxx'
  textColor?: 'black' | 'white';
  startDate?: string;      // yyyy-mm-dd
  endDate?: string;        // yyyy-mm-dd
  weekend?: boolean;
  time?: string;           // 'HH:MM'
  place?: string;          // texto libre
  perDay?: HabitPerDay;    // { monday: { items: [...] }, ... }
  updated_at?: string;
  deleted_at?: string | null;
};

/* =========================
 LocalStorage helpers
========================= */
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
const nowIso = () => new Date().toISOString();

/** YYYY-MM-DD Europe/Madrid */
function dateKeyTZ(d = new Date(), tz = 'Europe/Madrid') {
  const parts = new Intl.DateTimeFormat('es-ES', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const g = (t:string) => parts.find(p=>p.type===t)?.value!;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/* =========================
 Colas in-memory
========================= */
type MasterUpsert = HabitMaster;
const masterQueue: MasterUpsert[] = [];
let flushingMasters = false;

export function queueMasterUpsert(master: HabitMaster) {
  masterQueue.push({ ...master, updated_at: master.updated_at ?? nowIso() });
}

type TickUpsert = {
  habit_id: string; // SIEMPRE el id local del hábito (== local_id)
  date_key: string; // YYYY-MM-DD
  done: boolean;
  done_at: string | null;
  updated_at: string;
};
const tickQueue: TickUpsert[] = [];
export function queueTickUpsert(t: TickUpsert) { tickQueue.push(t); }

/* =========================
 Helpers de compat per_day
========================= */
function adaptRemotePerDay(per_day: any | null | undefined): HabitPerDay | undefined {
  if (!per_day || typeof per_day !== 'object') return undefined;
  const result: HabitPerDay = {};
  for (const [dayKey, val] of Object.entries(per_day as Record<string, any>)) {
    const itemsRaw = (val && (val as any).items) ? (val as any).items : undefined;
    let items: HabitPerDayItem[] = [];
    if (Array.isArray(itemsRaw)) {
      items = itemsRaw.map((i) => ({
        id: String(i.id ?? cryptoRandomId()),
        name: i.name ?? undefined,
        description: i.description ?? undefined,
      }));
    } else if (val && typeof (val as any).name === 'string') {
      // compat antiguo: { name: string }
      items = [{ id: cryptoRandomId(), name: (val as any).name }];
    }
    result[dayKey] = { items };
  }
  return result;
}
function cryptoRandomId() {
  // fallback sencillo (no dependemos de crypto.randomUUID para SSR)
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* =========================
 Masters: pull / flush
========================= */
async function pullHabitMasters(uid: string) {
  const { data, error } = await supabase
    .from('habit_masters')
    .select('id, user_id, local_id, title, icon, color, text_color, start_date, end_date, weekend, time, place, per_day, updated_at, deleted_at')
    .eq('user_id', uid);

  if (error) { console.warn('[pullHabitMasters] error', error); return; }

  const remote = (data || []).map(r => ({
    id: String(r.local_id || ''),
    rid: r.id,
    name: r.title,
    icon: r.icon || undefined,
    color: r.color || undefined,
    textColor: (r as any).text_color ?? undefined,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    weekend: typeof r.weekend === 'boolean' ? r.weekend : undefined,
    time: (r as any).time ?? undefined,
    place: (r as any).place ?? undefined,
    perDay: adaptRemotePerDay((r as any).per_day),
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
      text_color: m.textColor ?? null,
      start_date: m.startDate ?? null,
      end_date: m.endDate ?? null,
      weekend: typeof m.weekend === 'boolean' ? m.weekend : null,
      time: m.time ?? null,
      place: m.place ?? null,
      per_day: m.perDay ?? null,
      updated_at: m.updated_at ?? nowIso(),
      deleted_at: m.deleted_at ?? null,
    }));
    const { error } = await supabase.from('habit_masters').upsert(rows, { onConflict: 'user_id,local_id' });
    if (error) {
      console.warn('[flushMasters] upsert error', error);
      masterQueue.unshift(...batch);
      return;
    }
  } finally { flushingMasters = false; }
}

/* =========================
 Ticks: pull / merge / flush
========================= */
function mergeTickIntoLocal(row: {
  local_id?: string | number;
  habit_id?: string | number; // compat (si alguna vista/trigger lo rellena)
  date_key: string;
  done: boolean;
  done_at: string | null;
  updated_at: string | null;
}) {
  const hid = row.local_id != null ? String(row.local_id) :
             (row.habit_id != null ? String(row.habit_id) : undefined);
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
  // Leemos ambas columnas cuando existan; supabase ignora las que no están.
  const { data, error } = await supabase
    .from('habit_ticks')
    .select('local_id,habit_id,date_key,done,done_at,updated_at')
    .eq('user_id', uid)
    .gte('date_key', fromKey)
    .lte('date_key', toKey);

  if (error) { console.warn('[pullHabitTicksRange] error', error); return; }
  for (const r of data ?? []) mergeTickIntoLocal(r as any);
}

async function flushTicks(uid: string) {
  if (tickQueue.length === 0) return;

  const batch = tickQueue.splice(0, tickQueue.length);

  // ✅ Siempre persistimos con local_id. NO enviamos habit_id para evitar la FK.
  const rows = batch.map(t => ({
    user_id: uid,
    local_id: t.habit_id,
    date_key: t.date_key,
    done: t.done,
    done_at: t.done_at,
    updated_at: t.updated_at,
  }));

  const { error } = await supabase
    .from('habit_ticks')
    .upsert(rows, { onConflict: 'user_id,local_id,date_key' });

  if (error) {
    console.warn('[flushTicks] upsert error', {
      code: (error as any)?.code, message: (error as any)?.message,
      details: (error as any)?.details, hint: (error as any)?.hint
    });
    tickQueue.unshift(...batch);
    return;
  }

  // Pull inmediato corto para refrescar UI sin esperar al intervalo
  try {
    const to = dateKeyTZ(new Date());
    const d = new Date(); d.setDate(d.getDate() - 1);
    const from = dateKeyTZ(d);
    await pullHabitTicksRange(uid, from, to);
  } catch (e) {
    console.warn('[flushTicks] immediate pull failed', e);
  }
}

/* =========================
 API pública para forzar flush
========================= */
export async function flushHabitsNow(uid?: string | null) {
  const realUid = uid ?? (await supabase.auth.getUser()).data.user?.id ?? undefined;
  if (!realUid) return;
  await flushMasters(realUid);
  await flushTicks(realUid);
}

/* =========================
 Realtime
========================= */
function subscribeRealtime(uid: string) {
  const chTicks = supabase.channel('rt-habit-ticks')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'habit_ticks', filter: `user_id=eq.${uid}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as any;
        if (!row || !row.date_key) return;
        mergeTickIntoLocal({
          local_id: row.local_id,
          habit_id: row.habit_id, // si el backend lo rellena, también nos vale
          date_key: row.date_key,
          done: !!row.done,
          done_at: row.done_at ?? null,
          updated_at: row.updated_at ?? nowIso(),
        });
      }
    )
    .subscribe();

  const chMasters = supabase.channel('rt-habit-masters')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'habit_masters', filter: `user_id=eq.${uid}` },
      async () => { await pullHabitMasters(uid); }
    )
    .subscribe();

  return () => {
    try { supabase.removeChannel(chTicks); } catch {}
    try { supabase.removeChannel(chMasters); } catch {}
  };
}

/* =========================
 Hook principal (con flush en ocultar/cerrar/sign-out)
========================= */
export function useHabitsSupabaseSync(uid?: string) {
  const timerRef = useRef<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastUidRef = useRef<string | undefined>(uid);

  useEffect(() => { lastUidRef.current = uid || lastUidRef.current; }, [uid]);

  useEffect(() => {
    if (!isSupabaseEnvReady()) return;
    if (!uid) return;

    // Helpers debug en consola
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

    // 🔔 Flush cuando la página se oculta/cierra
    const onVisibility = () => { if (document.visibilityState === 'hidden') void beat(); };
    const onPageHide = () => { void beat(); };
    const onBeforeUnload = () => { void beat(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    // 🔔 Flush al hacer sign-out
    const authSub = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        const u = lastUidRef.current || session?.user?.id;
        if (u) await flushHabitsNow(u);
      }
    });

    // Timer
    timerRef.current = window.setInterval(beat, 15000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (unsubRef.current) unsubRef.current();
      try { authSub.data.subscription.unsubscribe(); } catch {}
    };
  }, [uid]);
}
