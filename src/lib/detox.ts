// src/lib/detox.ts
export type DetoxTaskType = 'limit' | 'habit' | 'reflection' | 'timer' | 'info';

export type DetoxTask = {
  id: string;                 // único por día (slug + day + id recomendado)
  title: string;              // “Silencia notificaciones 2h”
  type: DetoxTaskType;        // comportamiento del form/seguimiento
  targetMinutes?: number;     // para 'timer' o 'limit'
  guidance?: string;          // texto corto de ayuda en el “+”
};

export type DetoxDay = {
  day: number;                // 1..N
  tasks: DetoxTask[];
};

export type DetoxProgramData = {
  slug: string;               // "detox-tecnologico-30"
  // ...otros campos existentes de tu JSON (title, shortDescription, howItWorks…)
  daily: DetoxDay[];          // NUEVO: matriz día -> tareas
};

/** Devuelve las tareas del día N (1-indexed). Si no existe, array vacío. */
export function getDetoxDayTasks(program: DetoxProgramData, day: number): DetoxTask[] {
  if (!program?.daily?.length) return [];
  const entry = program.daily.find(d => d.day === day);
  return entry?.tasks ?? [];
}
