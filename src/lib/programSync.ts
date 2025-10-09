// src/lib/programSync.ts
import { supabase } from '@/lib/supabaseClient';
import { getAuthUserId } from '@/lib/user';
import {
  loadActive as loadLocalPrograms,
  saveActive as saveLocalPrograms,
  type LocalStore,
  type LocalProgram,
} from '@/lib/programsLocal';

/* ===== Tipos DB (ligeros) ===== */
type UserProgramRow = {
  user_id: string;
  program_slug: string;
  started_at: string;        // timestamptz
  current_day: number | null;
  is_active: boolean;
  updated_at: string;        // timestamptz
};

type UserProgramTaskRow = {
  user_id: string;
  program_slug: string;
  task_id: string;
  day: number;
  completed: boolean;
  completed_at: string | null;
  // updated_at puede existir en tu tabla; si no, Supabase ignora ese campo en upsert
  updated_at?: string | null;
};

/* ===== Útiles ===== */
const toMs = (ts: string | null | undefined) => (ts ? new Date(ts).getTime() : undefined);
const nowISO = () => new Date().toISOString();

/* ====================================================================== */
/*  PULL: Trae programas + tareas y los fusiona en el storage local (LWW) */
/* ====================================================================== */
export async function pullUserPrograms(): Promise<void> {
  const uid = await getAuthUserId();
  if (!uid) return;

  // 1) Programas activos del usuario
  const { data: programs, error: e1 } = await supabase
    .from('user_programs')
    .select('user_id, program_slug, started_at, current_day, is_active, updated_at')
    .eq('user_id', uid)
    .eq('is_active', true);

  if (e1) throw e1;

  // 2) Fusionar con local (LWW por updated_at)
  const local: LocalStore = loadLocalPrograms() || {};
  const activeSlugs = new Set<string>();

  (programs || []).forEach((row: UserProgramRow) => {
    const slug = row.program_slug;
    activeSlugs.add(slug);

    const remoteUpdatedMs = toMs(row.updated_at) ?? 0;
    const localUpdatedMs = local[slug]?.updatedAt ?? 0;

    if (!local[slug] || remoteUpdatedMs >= localUpdatedMs) {
      local[slug] = {
        programSlug: slug,
        status: row.is_active ? 'active' : 'paused',
        startedAt: toMs(row.started_at) ?? Date.now(),
        progress: local[slug]?.progress ?? {}, // el progreso granular llega abajo
        updatedAt: remoteUpdatedMs || Date.now(),
      };
    }
  });

  // 3) Cargar checks de tareas para esos programas
  if (activeSlugs.size > 0) {
    const slugs = Array.from(activeSlugs);
    const { data: tasks, error: e2 } = await supabase
      .from('user_program_tasks')
      .select('user_id, program_slug, task_id, day, completed, completed_at')
      .eq('user_id', uid)
      .in('program_slug', slugs);

    if (e2) throw e2;

    const taskRows = (tasks ?? []) as UserProgramTaskRow[];

    taskRows.forEach((t) => {
      const entry = (local[t.program_slug] ||= {
        programSlug: t.program_slug,
        status: 'active',
        startedAt: Date.now(),
        progress: {},
        updatedAt: Date.now(),
      }) as LocalProgram;

      const dayMap = (entry.progress[t.day] ||= {});
      dayMap[t.task_id] = !!t.completed;

      // Refresca updatedAt con la marca más reciente
      const cMs = toMs(t.completed_at) ?? 0;
      if (cMs > (entry.updatedAt ?? 0)) entry.updatedAt = cMs;
    });
  }

  saveLocalPrograms(local);
}

/* ================================================================== */
/*  PUSH: empezar un programa (crea/activa en server y en storage)    */
/* ================================================================== */
export async function pushStartProgram(slug: string): Promise<void> {
  const uid = await getAuthUserId();
  if (!uid) throw new Error('Usuario no autenticado');

  const startedISO = nowISO();

  // upsert por (user_id, program_slug)
  const { error } = await supabase
    .from('user_programs')
    .upsert(
      {
        user_id: uid,
        program_slug: slug,
        is_active: true,
        started_at: startedISO,
        current_day: 1,
        updated_at: startedISO,
      },
      { onConflict: 'user_id,program_slug' }
    );

  if (error) throw error;

  // Refleja local
  const local = loadLocalPrograms() || {};
  local[slug] = {
    programSlug: slug,
    status: 'active',
    startedAt: new Date(startedISO).getTime(),
    progress: local[slug]?.progress ?? {},
    updatedAt: Date.now(),
  };
  saveLocalPrograms(local);
}

/* ================================================================== */
/*  PUSH: reiniciar / desactivar programa (y limpiar tareas opcional) */
/* ================================================================== */
export async function pushResetProgram(slug: string, opts?: { deleteTasks?: boolean }) {
  const uid = await getAuthUserId();
  if (!uid) throw new Error('Usuario no autenticado');

  const { error } = await supabase
    .from('user_programs')
    .update({ is_active: false, current_day: 1, updated_at: nowISO() })
    .eq('user_id', uid)
    .eq('program_slug', slug);

  if (error) throw error;

  if (opts?.deleteTasks) {
    const { error: e2 } = await supabase
      .from('user_program_tasks')
      .delete()
      .eq('user_id', uid)
      .eq('program_slug', slug);
    if (e2) throw e2;
  }

  // Refleja local
  const local = loadLocalPrograms() || {};
  delete local[slug];
  saveLocalPrograms(local);
}

/* ========================================================== */
/*  PUSH: toggle/guardar una tarea del día (upsert granular)  */
/* ========================================================== */
export async function pushToggleTask(params: {
  slug: string;
  day: number;
  taskId: string;
  completed: boolean;
}) {
  const uid = await getAuthUserId();
  if (!uid) throw new Error('Usuario no autenticado');

  const { slug, day, taskId, completed } = params;
  const ts = nowISO();

  // upsert tarea; explicitamos completed_at/updated_at
  const { error } = await supabase
    .from('user_program_tasks')
    .upsert(
      {
        user_id: uid,
        program_slug: slug,
        task_id: taskId,
        day,
        completed,
        completed_at: completed ? ts : null,
        updated_at: ts,
      } as Partial<UserProgramTaskRow> as any,
      // 🔧 Clave única correcta: incluye 'day'
      { onConflict: 'user_id,program_slug,day,task_id' }
    );

  if (error) throw error;

  // Espejo local inmediato
  const local = loadLocalPrograms() || {};
  const entry = (local[slug] ||= {
    programSlug: slug,
    status: 'active',
    startedAt: Date.now(),
    progress: {},
    updatedAt: Date.now(),
  }) as LocalProgram;

  const dayMap = (entry.progress[day] ||= {});
  dayMap[taskId] = completed;
  entry.updatedAt = Date.now();
  saveLocalPrograms(local);
}

/* ========================================================== */
/*  Opcional: actualizar current_day en server (si lo usas)   */
/* ========================================================== */
export async function pushCurrentDay(slug: string, currentDay: number) {
  const uid = await getAuthUserId();
  if (!uid) throw new Error('Usuario no autenticado');
  const { error } = await supabase
    .from('user_programs')
    .update({ current_day: currentDay, updated_at: nowISO() })
    .eq('user_id', uid)
    .eq('program_slug', slug);
  if (error) throw error;
}

/* ========================================================== */
/*  (Opcional) Lectura por rango de días de un programa       */
/* ========================================================== */
export async function pullProgramWindow(
  slug: string,
  fromDay: number,
  toDay: number
): Promise<UserProgramTaskRow[]> {
  const uid = await getAuthUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('user_program_tasks')
    .select('user_id, program_slug, task_id, day, completed, completed_at')
    .eq('user_id', uid)
    .eq('program_slug', slug)
    .gte('day', fromDay)
    .lte('day', toDay);

  if (error) {
    console.warn('[pullProgramWindow] error', error);
    return [];
  }
  return (data ?? []) as UserProgramTaskRow[];
}
