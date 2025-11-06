'use client';

import { useMemo } from 'react';
import { loadActive, type LocalProgram } from '@/lib/programsLocal';
import { useAuthUserId } from '@/lib/user';

/* ===== Tipos públicos para hoy ===== */
export type ProgramToday = {
  slug: string;
  title: string;
  day: number;
  color: string;
  tasks: { id: string; label: string; done: boolean }[];
};

export type ChallengeTask = { id: string; label: string; done: boolean; onToggle?: () => void };
export type ChallengeToday = { id: string; title: string; tasks: ChallengeTask[] };

export type HabitToday = { id: string; name: string; done: boolean; color?: string; onToggle?: () => void };

export function useTodayActivity() {
  const uid = useAuthUserId();
  const today = useISODate(new Date());

  /* ===== Programas activos (local store) ===== */
  const programs = useMemo<ProgramToday[]>(() => {
    const store = loadActive();
    const result: ProgramToday[] = [];

    Object.entries(store).forEach(([slug, p]) => {
      const lp = p as any; // evitar error con completedAt inexistente en tipo LocalProgram
      const started = !!lp?.startedAt;
      const completed = !!lp?.completedAt;
      if (!started || completed) return; // terminado → oculto

      const json = tryGetProgramJson(slug);
      const totalDays = json?.days?.length ?? 0;
      if (!totalDays) return;

      const day = clampDay(lp.startedAt, new Date(`${today}T00:00:00`), totalDays);
      const dayTasks = json!.days.find((d: any) => d.day === day) ?? json!.days[day - 1];
      const progress = (lp.progress?.[day] as Record<string, boolean>) || {};

      const tasks = (dayTasks?.tasks ?? []).map((t: any, i: number) => {
        const id = t.id ?? `task_${i}`;
        return { id, label: t.label, done: !!progress[id] };
      });

      result.push({
        slug,
        title: json?.title || slug,
        day,
        color: colorFor(slug),
        tasks,
      });
    });

    return result;
  }, [today]);

  /* ===== Retos con amigos (placeholder) ===== */
  const challengesToday = useMemo<ChallengeToday[]>(() => {
    return []; // ← conectar con challenge_days / checks
  }, []);

  /* ===== Hábitos personalizados (placeholder) ===== */
  const habitsToday = useMemo<HabitToday[]>(() => {
    return []; // ← conectar con habit_masters / habit_ticks
  }, []);

  /* ===== Totales para rueda ===== */
  const totalGoal =
    programs.reduce((a, p) => a + p.tasks.length, 0) +
    challengesToday.reduce((a, c) => a + c.tasks.length, 0) +
    habitsToday.length;

  const totalDone =
    programs.reduce((a, p) => a + p.tasks.filter((t) => t.done).length, 0) +
    challengesToday.reduce((a, c) => a + c.tasks.filter((t) => t.done).length, 0) +
    habitsToday.filter((h) => !!h.done).length;

  /* ===== Históricos / series ===== */
  const historicalPoints = 0;  // RPC real fuera de este hook
  const programsCompleted = 0; // RPC/consulta real fuera de este hook
  const weeklySeries = useMemo(() => buildWeeklySeriesReal(), [today]);

  return {
    uid,
    today,
    programsToday: programs,
    challengesToday,
    habitsToday,
    totalGoal,
    totalDone,
    historicalPoints,
    programsCompleted,
    weeklySeries,
    toggleProgramTask: (_slug: string, _day: number, _taskId: string) => {
      // noop por ahora; conecta con upsert real si quieres marcar desde /mizona/checks
      console.info('toggleProgramTask noop — conectar con upsert real si es necesario');
    },
  };
}

/* ===== helpers de fecha / json ===== */
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
  return Math.floor((b - a) / 86_400_000) + 1; // 1..N
}
function colorFor(slug: string) {
  if (slug.includes('detox')) return '#0a7cff';
  if (slug.includes('lectura')) return '#f59e0b';
  return '#111';
}
function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}

/* ===== weeklySeries real (4 semanas, Lun→Dom) ===== */
function buildWeeklySeriesReal() {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const store = loadActive();
  const today = new Date();
  const week0Start = startOfWeekMonday(today);

  const out: Array<{ labels: string[]; goal: number[]; actual: number[]; range: [string, string] }> = [];

  for (let w = 0; w < 4; w++) {
    const start = addDays(week0Start, -7 * w);
    const goal = Array(7).fill(0);
    const actual = Array(7).fill(0);

    // Sumar por día y programa
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);

      for (const [slug, prog] of Object.entries(store)) {
        const lp = prog as LocalProgram & { progress?: Record<number, Record<string, boolean>>; startedAt?: number };
        if (!lp?.startedAt) continue;

        const json = tryGetProgramJson(slug);
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
