// src/lib/activity/useTodayActivity.ts
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
      // usamos any para evitar error de tipo con completedAt
      const lp = p as any;
      const started = !!lp?.startedAt;
      const completed = !!lp?.completedAt;
      if (!started || completed) return; // terminado → oculto

      const json = tryGetProgramJson(slug);
      const totalDays = json?.days?.length ?? 0;
      if (!totalDays) return;

      const day = Math.min(totalDays, Math.max(1, daysBetween(lp.startedAt, today) + 1));
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

  /* ===== Retos con amigos (tipado explícito, de momento vacío) ===== */
  const challengesToday = useMemo<ChallengeToday[]>(() => {
    return []; // ← conecta aquí challenge_days/checks
  }, []);

  /* ===== Hábitos personalizados (tipado explícito, de momento vacío) ===== */
  const habitsToday = useMemo<HabitToday[]>(() => {
    return []; // ← conecta aquí habit_masters/habit_ticks
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

  /* ===== Históricos (placeholders) ===== */
  const historicalPoints = 0;
  const programsCompleted = 0;
  const weeklySeries = buildWeeklySeries(programs);

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
      // noop por ahora; puedes reutilizar tu upsert real
      // si quieres marcar desde /mizona/checks
      console.info('toggleProgramTask noop — conectar con upsert real si es necesario');
    },
  };
}

/* ===== helpers ===== */
function useISODate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function daysBetween(startMs: number, endISOyyyyMmDd: string) {
  const a = startOfDay(new Date(startMs));
  const b = startOfDay(new Date(`${endISOyyyyMmDd}T00:00:00`));
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
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
function buildWeeklySeries(_programs: Array<{ day: number; tasks: { done: boolean }[] }>) {
  const mk = () => ({
    labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    goal: Array(7).fill(0),
    actual: Array(7).fill(0),
    range: ['--', '--'] as [string, string],
  });
  return [mk(), mk(), mk(), mk()];
}
