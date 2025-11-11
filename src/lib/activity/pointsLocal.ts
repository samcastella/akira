// src/lib/activity/pointsLocal.ts
import { loadActive, type LocalStore, type LocalProgram } from '@/lib/programsLocal';

function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}

/** Puntos por un programa concreto (local) */
export function computeProgramPointsFromLocal(slug: string, lp: LocalProgram, json: any): number {
  if (!lp?.progress || !json) return 0;

  let total = 0;

  // Recorremos los días que tengan progreso guardado
  for (const rawDay of Object.keys(lp.progress)) {
    const dayNum = Number(rawDay);
    if (!Number.isFinite(dayNum) || dayNum <= 0) continue;

    // Definición del día en el JSON (por número o por índice)
    const dayDef =
      (json?.days?.find((d: any) => d?.day === dayNum)) ??
      (json?.days?.[dayNum - 1]);

    const planned = Math.max(0, dayDef?.tasks?.length ?? 0);
    const doneMap = (lp.progress[dayNum] as Record<string, boolean>) ?? {};
    const done = Object.values(doneMap).filter(Boolean).length;

    if (planned === 0) continue; // sin tareas planificadas no puntúa

    // +5 por cada check hecho
    total += done * 5;

    // +10 extra si completas todas las tareas del día
    if (done >= planned) total += 10;
  }

  return total;
}

/** Suma total de puntos de todos los programas activos (local) */
export function computeTotalPointsFromLocal(activeMap?: LocalStore): number {
  const map = activeMap ?? loadActive();
  let total = 0;

  for (const [slug, prog] of Object.entries(map)) {
    const lp = prog as LocalProgram;
    if (!lp?.startedAt) continue;
    const json = tryGetProgramJson(slug);
    if (!json?.days?.length && !json?.durationDays) continue;
    total += computeProgramPointsFromLocal(slug, lp, json);
  }

  return total;
}
