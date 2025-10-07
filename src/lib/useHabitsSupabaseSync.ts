import { useEffect, useRef } from 'react';
import { pullHabits, pullTicks, upsertHabits, upsertTicks, softDeleteHabits } from './habitsClient';

const LS_DIRTY = 'akira_habits_dirty_v1';
const LS_LAST_PULL = 'akira_habits_last_pull_v1';
const LS_MASTER = 'akira_habits_master_v1';
const LS_DAILY  = 'akira_habits_daily_v1';

type Dirty = {
  mastersUpserts: any[];
  mastersDeletes: string[];
  ticksUpserts: any[];
};

const emptyDirty = (): Dirty => ({ mastersUpserts: [], mastersDeletes: [], ticksUpserts: [] });

function getDirty(): Dirty {
  try { return JSON.parse(localStorage.getItem(LS_DIRTY) || 'null') || emptyDirty(); } catch { return emptyDirty(); }
}
function setDirty(d: Dirty) { localStorage.setItem(LS_DIRTY, JSON.stringify(d)); }

export function queueHabitUpsert(row: any) {
  const d = getDirty(); d.mastersUpserts.push({ ...row, updated_at: new Date().toISOString() }); setDirty(d);
}
export function queueHabitDelete(id: string) {
  const d = getDirty(); d.mastersDeletes.push(id); setDirty(d);
}
export function queueTickUpsert(row: any) {
  const d = getDirty(); d.ticksUpserts.push({ ...row, updated_at: new Date().toISOString() }); setDirty(d);
}

// Helpers LWW sobre tus LS
function mergeMastersLWW(serverRows: any[]) {
  const ls = JSON.parse(localStorage.getItem(LS_MASTER) || '[]');
  const byId: Record<string, any> = Object.fromEntries(ls.map((h: any) => [h.id, h]));
  serverRows.forEach((r) => {
    const local = byId[r.id];
    if (!local || (r.updated_at && (!local.updated_at || r.updated_at > local.updated_at))) {
      byId[r.id] = {
        ...local,
        id: r.id, name: r.name, color: r.color ?? undefined, icon: r.icon ?? undefined,
        startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined,
        weekend: r.weekend ?? undefined,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at ?? null,
      };
    }
  });
  const merged = Object.values(byId).filter((h: any) => !h.deleted_at);
  localStorage.setItem(LS_MASTER, JSON.stringify(merged));
}

function mergeDailyTicksLWW(serverTicks: any[]) {
  const daily = JSON.parse(localStorage.getItem(LS_DAILY) || '{}');
  serverTicks.forEach((t) => {
    const day = daily[t.date_key] || {};
    const cur = day[t.habit_id] || {};
    const curAt = cur.updated_at || '';
    if (!curAt || (t.updated_at && t.updated_at > curAt)) {
      day[t.habit_id] = {
        done: !!t.done,
        doneAt: t.done_at ? new Date(t.done_at).getTime() : undefined,
        updated_at: t.updated_at,
      };
      daily[t.date_key] = day;
    }
  });
  localStorage.setItem(LS_DAILY, JSON.stringify(daily));
}

export function useHabitsSupabaseSync(userId?: string) {
  const syncing = useRef(false);

  async function pull() {
    const since = localStorage.getItem(LS_LAST_PULL) || undefined;
    const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString().slice(0,10);
    const to   = new Date().toISOString().slice(0,10);
    const [masters, ticks] = await Promise.all([ pullHabits(since), pullTicks(from, to, since) ]);
    mergeMastersLWW(masters);
    mergeDailyTicksLWW(ticks);
    localStorage.setItem(LS_LAST_PULL, new Date().toISOString());
  }

  async function flush() {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const d = getDirty();
      if (d.mastersUpserts.length) await upsertHabits(d.mastersUpserts.map((h) => ({ ...h, user_id: userId })));
      if (d.mastersDeletes.length) await softDeleteHabits(d.mastersDeletes);
      if (d.ticksUpserts.length) await upsertTicks(d.ticksUpserts);
      setDirty(emptyDirty());
    } finally {
      syncing.current = false;
    }
  }

  useEffect(() => {
    if (!userId) return;
    pull().then(flush).catch(() => {});
    const onFocus = () => pull().then(flush).catch(() => {});
    const onOnline = () => flush().catch(() => {});
    const iv = setInterval(() => flush().catch(() => {}), 15000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      clearInterval(iv);
    };
  }, [userId]);

  return { pull, flush, queueHabitUpsert, queueHabitDelete, queueTickUpsert };
}
