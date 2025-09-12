// Servicios para Programas guiados con sincronización Supabase.
// Fuente de metadatos: src/data/programs.ts
// Fuente de contenidos detallados: JSON local (ej. lectura-30.json).
// Fuente de estado: Supabase (multi-dispositivo).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBySlug, type ProgramMeta } from "@/data/programs";

// JSON del programa Lectura
import lecturaProgramRaw from "../data/programs/lectura-30.json";

// ---------- Tipos de contenido (JSON) ----------
export type ProgramTaskDef = {
  id: string;    // p.ej. "d1_t2"
  label: string; // texto corto
  detail: string;
  tags?: string[];
};
export type ProgramDayDef = { day: number; tasks: ProgramTaskDef[] };

export type ProgramDef = ProgramMeta & {
  howItWorks: string;
  daysDef: ProgramDayDef[];
};

// ---------- Tipos de estado (Supabase) ----------
export type ActiveProgramRow = {
  user_id: string;
  program_slug: string;
  started_at: string;
  current_day: number;
  is_active: boolean;
  updated_at: string;
};

export type UserTaskRow = {
  user_id: string;
  program_slug: string;
  day: number;
  task_id: string;
  completed: boolean;
  completed_at: string | null;
};

// ---------- Constantes ----------
export const TABLE_PROGRAMS = "user_programs";
export const TABLE_TASKS = "user_program_tasks";

// Normaliza el JSON + enlaza con metadatos del catálogo
function normalizeProgramDef(slug: string, input: any): ProgramDef {
  const meta = getBySlug(slug);
  if (!meta) throw new Error(`No se encontró metadato para ${slug}`);

  const howItWorks = String(
    input?.howItWorks ??
      "Completa las mini-tareas diarias y avanza automáticamente."
  );
  const daysDef: ProgramDayDef[] = Array.isArray(input?.days)
    ? input.days.map((d: any, idx: number) => ({
        day: typeof d?.day === "number" ? d.day : idx + 1,
        tasks: Array.isArray(d?.tasks)
          ? d.tasks.map((t: any, tIdx: number) => ({
              id: String(t?.id ?? `d${idx + 1}-t${tIdx + 1}`),
              label: String(t?.label ?? "Tarea"),
              detail: String(t?.detail ?? ""),
              tags: Array.isArray(t?.tags) ? t.tags.map(String) : undefined,
            }))
          : [],
      }))
    : [];

  return {
    ...meta,
    howItWorks,
    daysDef,
  };
}

// Solo tenemos lectura por ahora
const lecturaProgram: ProgramDef = normalizeProgramDef(
  "lectura-30",
  lecturaProgramRaw as any
);

export function getProgramDef(slug: string): ProgramDef {
  if (slug === lecturaProgram.slug) return lecturaProgram;
  throw new Error(`Programa no soportado: ${slug}`);
}

// ---------- Helpers de cache local ----------
const LS_ACTIVE_KEY = "akira_program_active"; // { slug, startedAt, currentDay }

function writeLocalActive(slug: string, startedAt: string, currentDay: number) {
  try {
    localStorage.setItem(
      LS_ACTIVE_KEY,
      JSON.stringify({ slug, startedAt, currentDay, ts: Date.now() })
    );
  } catch {}
}
export function readLocalActive():
  | { slug: string; startedAt: string; currentDay: number; ts?: number }
  | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearLocalActive() {
  try {
    localStorage.removeItem(LS_ACTIVE_KEY);
  } catch {}
}

// ---------- Servicios de estado Supabase ----------

export async function getActiveProgram(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<ActiveProgramRow | null> {
  const { data, error } = await supabase
    .from(TABLE_PROGRAMS)
    .select("*")
    .eq("user_id", userId)
    .eq("program_slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error && (error as any).code !== "PGRST116") throw error;
  if (!data) return null;

  const row = data as unknown as ActiveProgramRow;
  writeLocalActive(slug, row.started_at, row.current_day);
  return row;
}

export async function startProgram(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<ActiveProgramRow> {
  const { data, error } = await supabase
    .from(TABLE_PROGRAMS)
    .upsert(
      {
        user_id: userId,
        program_slug: slug,
        started_at: new Date().toISOString(),
        current_day: 1,
        is_active: true,
      },
      { onConflict: "user_id,program_slug" }
    )
    .select("*")
    .single();

  if (error) throw error;
  const row = data as unknown as ActiveProgramRow;
  writeLocalActive(slug, row.started_at, row.current_day);
  return row;
}

export async function resetProgram(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<void> {
  const { error: delErr } = await supabase
    .from(TABLE_TASKS)
    .delete()
    .eq("user_id", userId)
    .eq("program_slug", slug);
  if (delErr) throw delErr;

  const { error: upErr } = await supabase
    .from(TABLE_PROGRAMS)
    .upsert(
      {
        user_id: userId,
        program_slug: slug,
        started_at: new Date().toISOString(),
        current_day: 1,
        is_active: true,
      },
      { onConflict: "user_id,program_slug" }
    );
  if (upErr) throw upErr;

  writeLocalActive(slug, new Date().toISOString(), 1);
}

// ---------- Gestión de tareas ----------

async function ensureDayTaskRows(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  day: number,
  def: ProgramDef
): Promise<void> {
  const dayDef = def.daysDef.find((d) => d.day === day);
  if (!dayDef) throw new Error(`Día ${day} no existe en ${slug}`);

  const { data: existing, error: exErr } = await supabase
    .from(TABLE_TASKS)
    .select("task_id")
    .eq("user_id", userId)
    .eq("program_slug", slug)
    .eq("day", day);

  if (exErr) throw exErr;
  if (existing && existing.length >= dayDef.tasks.length) return;

  const toInsert = dayDef.tasks
    .filter((t) => !existing?.some((e: any) => e.task_id === t.id))
    .map<UserTaskRow>((t) => ({
      user_id: userId,
      program_slug: slug,
      day,
      task_id: t.id,
      completed: false,
      completed_at: null,
    }));

  if (toInsert.length) {
    const { error: insErr } = await supabase
      .from(TABLE_TASKS)
      .insert(toInsert);
    if (insErr) throw insErr;
  }
}

export type TaskWithStatus = ProgramTaskDef & {
  day: number;
  completed: boolean;
  completed_at: string | null;
};

export async function getDayTasks(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  day: number
): Promise<TaskWithStatus[]> {
  const def = getProgramDef(slug);
  await ensureDayTaskRows(supabase, userId, slug, day, def);

  const { data: rows, error } = await supabase
    .from(TABLE_TASKS)
    .select("*")
    .eq("user_id", userId)
    .eq("program_slug", slug)
    .eq("day", day);

  if (error) throw error;

  const dayDef = def.daysDef.find((d) => d.day === day)!;
  const map = new Map(
    (rows as UserTaskRow[] | null)?.map((r) => [r.task_id, r]) || []
  );

  return dayDef.tasks.map((t) => {
    const r = map.get(t.id);
    return {
      ...t,
      day,
      completed: !!r?.completed,
      completed_at: r?.completed_at ?? null,
    };
  });
}

export async function toggleTask(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  day: number,
  taskId: string,
  completed: boolean
): Promise<{ advanced: boolean; nextDay: number | null }> {
  const { error: upErr } = await supabase
    .from(TABLE_TASKS)
    .upsert(
      {
        user_id: userId,
        program_slug: slug,
        day,
        task_id: taskId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,program_slug,task_id" }
    );
  if (upErr) throw upErr;

  const { data: pending, error: pendErr } = await supabase
    .from(TABLE_TASKS)
    .select("task_id")
    .eq("user_id", userId)
    .eq("program_slug", slug)
    .eq("day", day)
    .eq("completed", false);

  if (pendErr) throw pendErr;

  if (!pending || pending.length === 0) {
    const { data: prog, error: selErr } = await supabase
      .from(TABLE_PROGRAMS)
      .select("*")
      .eq("user_id", userId)
      .eq("program_slug", slug)
      .maybeSingle();
    if (selErr) throw selErr;

    const next = Math.max(
      day + 1,
      (prog as ActiveProgramRow | null)?.current_day ?? day + 1
    );
    const { error: updErr } = await supabase
      .from(TABLE_PROGRAMS)
      .update({ current_day: next })
      .eq("user_id", userId)
      .eq("program_slug", slug);
    if (updErr) throw updErr;

    writeLocalActive(
      slug,
      (prog as ActiveProgramRow | null)?.started_at ??
        new Date().toISOString(),
      next
    );
    return { advanced: true, nextDay: next };
  }

  return { advanced: false, nextDay: null };
}

export async function getProgress(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<{ daysCompleted: number; totalDays: number; currentDay: number }> {
  const def = getProgramDef(slug);

  const { data: prog, error: pErr } = await supabase
    .from(TABLE_PROGRAMS)
    .select("*")
    .eq("user_id", userId)
    .eq("program_slug", slug)
    .maybeSingle();
  if (pErr) throw pErr;

  const { data: rows, error: rErr } = await supabase
    .from(TABLE_TASKS)
    .select("day, completed")
    .eq("user_id", userId)
    .eq("program_slug", slug);
  if (rErr) throw rErr;

  const byDay = new Map<number, { total: number; done: number }>();
  (rows as Array<{ day: number; completed: boolean }> | null)?.forEach((r) => {
    const acc = byDay.get(r.day) ?? { total: 0, done: 0 };
    acc.total += 1;
    if (r.completed) acc.done += 1;
    byDay.set(r.day, acc);
  });

  let daysCompleted = 0;
  for (const dayDef of def.daysDef) {
    const acc = byDay.get(dayDef.day);
    if (acc && acc.total >= dayDef.tasks.length && acc.done === acc.total) {
      daysCompleted += 1;
    }
  }

  return {
    daysCompleted,
    totalDays: def.days,
    currentDay: (prog as ActiveProgramRow | null)?.current_day ?? 1,
  };
}
