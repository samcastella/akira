// src/lib/activity/useTodayActivity.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadActive, saveActive, type LocalProgram } from '@/lib/programsLocal';
import { useAuthUserId } from '@/lib/user';
import { supabase } from '@/lib/supabaseClient';

/* ===== Tipos públicos para hoy ===== */
export type ProgramToday = {
  slug: string;
  title: string;
  day: number;
  color: string;
  tasks: { id: string; label: string; detail?: string; done: boolean }[];
};

export type ChallengeTask = { id: string; label: string; done: boolean; onToggle?: () => void };
export type ChallengeToday = { id: string; title: string; tasks: ChallengeTask[] };

export type HabitToday = { id: string; name: string; done: boolean; color?: string; onToggle?: () => void };

/* ===== Reto sugerido (no puntúa ranking) ===== */
export type TodaySuggestion = {
  id: string;
  status: 'proposed' | 'accepted' | 'dismissed' | 'done';
  title: string;
  description?: string;
  payload?: any;
};

/* ===== Build tag para bustear caché de JSON ===== */
const BUILD_V = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev';

/* Lee JSON fresco desde la API; fallback a require del bundle */
// Ahora acepta opcionalmente AbortSignal
async function fetchProgramJsonFresh(slug: string, signal?: AbortSignal) {
  const url = `/data/programs/${encodeURIComponent(slug)}.json?v=${encodeURIComponent(BUILD_V)}`;
  const res = await fetch(url, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

function tryGetProgramJsonBundled(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}
function getDayDef(json: any, day: number) {
  return json?.days?.find((x: any) => x.day === day) ?? json?.days?.[day - 1];
}

/* ===== Hook principal ===== */
export function useTodayActivity() {
  const uid = useAuthUserId();
  const todayISO = useISODate(new Date());
  const [version, setVersion] = useState(0); // fuerza re-render tras toggle

  /* Cache en memoria de JSON frescos por slug */
  const [programJsonCache, setProgramJsonCache] = useState<Record<string, any>>({});

  // Descarga JSON actualizados para los slugs activos; reintenta en cada build nuevo
  useEffect(() => {
    const store = loadActive();
    // Sólo slugs "vivos": empezados y no completados
    const activeSlugs = Object.entries(store)
      .filter(([, p]) => {
        const lp = p as LocalProgram & { startedAt?: number; completedAt?: number | null };
        return !!lp?.startedAt && !lp?.completedAt;
      })
      .map(([slug]) => slug);

    if (!activeSlugs.length) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      await Promise.all(
        activeSlugs.map(async (slug) => {
          try {
            const fresh = await fetchProgramJsonFresh(slug, controller.signal);
            if (!cancelled) {
              setProgramJsonCache((prev) => (prev[slug] ? prev : { ...prev, [slug]: fresh }));
              // al llegar “fresh” forzamos re-render para sustituir bundled
              setVersion((v) => v + 1);
            }
          } catch {
            // si falla la red/API, nos quedamos con bundled
          }
        })
      );
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [BUILD_V]);

  /* Getter: usa fresco si existe; si no, cae al bundled */
  const getJson = useCallback(
    (slug: string) => programJsonCache[slug] ?? tryGetProgramJsonBundled(slug),
    [programJsonCache]
  );

  /* ===== Programas activos (local store) ===== */
  const programs = useMemo<ProgramToday[]>(() => {
    const store = loadActive();
    const result: ProgramToday[] = [];

    Object.entries(store).forEach(([slug, p]) => {
      const lp = p as LocalProgram & {
        progress?: Record<number, Record<string, boolean>>;
        startedAt?: number;
        completedAt?: number | null;
      };

      const started = !!lp?.startedAt;
      const completed = !!lp?.completedAt;
      if (!started || completed) return; // terminado → fuera

      const json = getJson(slug);
      if (!json) return; // ⬅ guard: aún no disponible

      const totalDays = json?.days?.length ?? json?.durationDays ?? 0;
      if (!totalDays) return;

      const day = clampDay(lp.startedAt!, new Date(`${todayISO}T00:00:00`), totalDays);
      const dayDef = getDayDef(json, day);
      const progress = (lp.progress?.[day] as Record<string, boolean>) || {};

      const tasksRaw = (dayDef?.tasks ?? []) as Array<{ id?: string; label: string; detail?: string }>;
      const tasks = tasksRaw.map((t, i) => {
        const id = t.id ?? `task_${i}`;
        return { id, label: t.label, detail: t.detail, done: !!progress[id] };
      });

      // Si es el último día y TODO está hecho, no mostrar en Checks
      const planned = tasks.length;
      const done = tasks.filter((t) => t.done).length;
      const lastDayAndComplete = planned > 0 && done >= planned && day >= totalDays;
      if (lastDayAndComplete) return;

      result.push({
        slug,
        title: json?.title || slug,
        day,
        color: colorFor(slug),
        tasks,
      });
    });

    return result;
  }, [todayISO, version, getJson]);

  /* ===== Retos con amigos (placeholder) ===== */
  const challengesToday = useMemo<ChallengeToday[]>(() => {
    return [];
  }, [version]);

  /* ===== Hábitos personalizados (placeholder) ===== */
  const habitsToday = useMemo<HabitToday[]>(() => {
    return [];
  }, [version]);

  /* ===== Sugerencia del día (DB) ===== */
  const [suggestion, setSuggestion] = useState<TodaySuggestion | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) return;
      const iso = todayISO;
      const { data, error } = await supabase
        .from('user_suggested_challenges')
        .select(`
          id, status,
          suggested_challenges_master ( title, description, payload )
        `)
        .eq('user_id', uid)
        .eq('date_key', iso)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[useTodayActivity] load suggestion error:', error);
        if (!cancelled) setSuggestion(null);
        return;
      }
      if (!data) {
        if (!cancelled) setSuggestion(null);
        return;
      }
      if (!cancelled) {
        setSuggestion({
          id: data.id,
          status: data.status,
          title: (data as any)?.suggested_challenges_master?.title ?? 'Reto sugerido',
          description: (data as any)?.suggested_challenges_master?.description ?? undefined,
          payload: (data as any)?.suggested_challenges_master?.payload ?? undefined,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, todayISO, version]);

  const acceptSuggestion = useCallback(async () => {
    if (!uid || !suggestion) return;
    const { error } = await supabase
      .from('user_suggested_challenges')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', suggestion.id)
      .eq('user_id', uid);
    if (error) return console.warn('[suggestion] accept error:', error);
    setSuggestion((s) => (s ? { ...s, status: 'accepted' } : s));
    window.dispatchEvent(new CustomEvent('akira:activity:changed', {
      detail: { source: 'suggestion', action: 'accept' },
    }));
  }, [uid, suggestion]);

  const dismissSuggestion = useCallback(async () => {
    if (!uid || !suggestion) return;
    const { error } = await supabase
      .from('user_suggested_challenges')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('id', suggestion.id)
      .eq('user_id', uid);
    if (error) return console.warn('[suggestion] dismiss error:', error);
    setSuggestion((s) => (s ? { ...s, status: 'dismissed' } : s));
    window.dispatchEvent(new CustomEvent('akira:activity:changed', {
      detail: { source: 'suggestion', action: 'dismiss' },
    }));
  }, [uid, suggestion]);

  const toggleSuggestionDone = useCallback(async () => {
    if (!uid || !suggestion) return;
    const next = suggestion.status === 'done' ? 'accepted' : 'done';
    const patch: any = { status: next, done_at: next === 'done' ? new Date().toISOString() : null };
    const { error } = await supabase
      .from('user_suggested_challenges')
      .update(patch)
      .eq('id', suggestion.id)
      .eq('user_id', uid);
    if (error) return console.warn('[suggestion] toggle error:', error);
    setSuggestion((s) => (s ? { ...s, status: next } : s));
    window.dispatchEvent(new CustomEvent('akira:activity:changed', {
      detail: { source: 'suggestion', action: 'toggle' },
    }));
  }, [uid, suggestion]);

  /* ===== Totales para rueda ===== (sin suggestion: no puntúa ranking) */
  const totalGoal =
    programs.reduce((a, p) => a + p.tasks.length, 0) +
    challengesToday.reduce((a, c) => a + c.tasks.length, 0) +
    habitsToday.length;

  const totalDone =
    programs.reduce((a, p) => a + p.tasks.filter((t) => t.done).length, 0) +
    challengesToday.reduce((a, c) => a + c.tasks.filter((t) => t.done).length, 0) +
    habitsToday.filter((h) => !!h.done).length;

  /* ===== Históricos / series ===== */
  const historicalPoints = 0; // fallback hasta conectar RPC/BD
  const programsCompleted = 0; // fallback hasta conectar RPC/BD
  const weeklySeries = useMemo(() => buildWeeklySeriesReal(getJson), [todayISO, version, getJson]);

  return {
    uid,
    today: todayISO,
    programsToday: programs,
    challengesToday,
    habitsToday,

    // Sugerencia (no puntúa ranking)
    suggestionsToday: suggestion,
    acceptSuggestion,
    dismissSuggestion,
    toggleSuggestionDone,

    totalGoal,
    totalDone,
    historicalPoints,
    programsCompleted,
    weeklySeries,

    toggleProgramTask: (slug: string, day: number, taskId: string) => {
      // Marca/desmarca en local
      const store = loadActive();
      const lp = store[slug] as LocalProgram & {
        progress?: Record<number, Record<string, boolean>>;
        startedAt?: number;
        completedAt?: number | null;
      };
      if (!lp) return;

      lp.progress = lp.progress || {};
      lp.progress[day] = lp.progress[day] || {};
      lp.progress[day][taskId] = !lp.progress[day][taskId];

      // Si al marcar desencadenamos "todo listo" en el último día → sellar completedAt
      const json = getJson(slug);
      const totalDays = json?.days?.length ?? json?.durationDays ?? 0;
      if (totalDays > 0) {
        const isLastDay = day >= totalDays;
        if (isLastDay) {
          const dayDef = getDayDef(json, day);
          const ids = ((dayDef?.tasks ?? []) as Array<{ id?: string }>).map((t, i) => t.id ?? `task_${i}`);
          const allDone = ids.length > 0 && ids.every((id) => lp.progress![day]?.[id]);
          if (allDone) {
            lp.completedAt = Date.now();
          }
        }
      }

      saveActive(store);
      setVersion((v) => v + 1);
    },
  };
}

/* ===== Helpers ===== */
function useISODate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // L=0..D=6
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function clampDay(startedAt: number, when: Date, totalDays: number) {
  const idx = dayIdxSince(startedAt, when);
  return Math.min(totalDays, Math.max(1, idx));
}
function dayIdxSince(startedAt: number, when: Date) {
  const a = startOfDay(new Date(startedAt)).getTime();
  const b = startOfDay(when).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}
function colorFor(slug: string) {
  if (slug.includes('detox')) return '#0a7cff';
  if (slug.includes('lectura')) return '#f59e0b';
  return '#111';
}

/* ===== weeklySeries real (4 semanas, Lun→Dom) usando getJson() ===== */
function buildWeeklySeriesReal(getJson: (slug: string) => any) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const store = loadActive();
  const today = new Date();
  const week0Start = startOfWeekMonday(today);

  const out: Array<{ labels: string[]; goal: number[]; actual: number[]; range: [string, string] }> = [];

  for (let w = 0; w < 4; w++) {
    const start = addDays(week0Start, -7 * w);
    const goal = Array(7).fill(0);
    const actual = Array(7).fill(0);

    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);

      for (const [slug, prog] of Object.entries(store)) {
        const lp = prog as LocalProgram & {
          progress?: Record<number, Record<string, boolean>>;
          startedAt?: number;
          completedAt?: number | null;
        };
        if (!lp?.startedAt) continue;

        const json = getJson(slug);
        if (!json) continue;

        const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
        if (!totalDays) continue;

        const dayNum = dayIdxSince(lp.startedAt!, d);
        if (dayNum < 1 || dayNum > totalDays) continue;

        const dayDef = json?.days?.find((x: any) => x.day === dayNum) ?? json?.days?.[dayNum - 1];
        const planned = Math.max(0, dayDef?.tasks?.length ?? 0);
        goal[i] += planned;

        const doneMap = (lp.progress?.[dayNum] as Record<string, boolean> | undefined) ?? {};
        const done = Object.values(doneMap).filter(Boolean).length;
        actual[i] += done;
      }
    }

    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const range: [string, string] = [fmt(start), fmt(addDays(start, 6))];

    out.push({ labels, goal, actual, range });
  }

  return out;
}
