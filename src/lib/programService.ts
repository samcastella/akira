// src/lib/programService.ts
// Servicios para Programas guiados con sincronización Supabase.
// Fuente de metadatos: public/data/programs/*.json
// Fuente de estado: Supabase (multi-dispositivo).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBySlug, type ProgramMeta } from '@/lib/programRegistry';
import { loadProgramJson, canonicalizeSlug, type ProgramJson } from '@/lib/programLoader';
import { supabase } from '@/lib/supabaseClient';

// ---------- Tipos de contenido (JSON) ----------
export type ProgramTaskDef = {
  id: string;
  label: string;
  detail: string;
  tags?: string[];
};
export type ProgramDayDef = { day: number; tasks: ProgramTaskDef[] };

export type ProgramDef = ProgramMeta & {
  howItWorks: string;
  daysDef: ProgramDayDef[];
  durationDays?: number;
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
export const TABLE_PROGRAMS = 'user_programs';
export const TABLE_TASKS = 'user_program_tasks';

// Helper actualizado: compara el slug o su forma canónica
function matchesSlug(meta: ProgramMeta, slug: string) {
  const can = canonicalizeSlug(slug);
  return meta.slug === slug || canonicalizeSlug(meta.slug) === can;
}

// Normaliza el JSON + enlaza con metadatos del catálogo
function normalizeProgramDef(slug: string, input: ProgramJson): ProgramDef {
  const meta = getBySlug(slug);
  if (!meta) throw new Error(`No se encontró metadato para ${slug}`);

  const howItWorks = String(
    input?.howItWorks ?? 'Completa las mini-tareas diarias y avanza automáticamente.'
  );
  const daysDef: ProgramDayDef[] = Array.isArray(input?.days)
    ? input.days.map((d: any, idx: number) => ({
        day: typeof d?.day === 'number' ? d.day : idx + 1,
        tasks: Array.isArray(d?.tasks)
          ? d.tasks.map((t: any, tIdx: number) => ({
              id: String(t?.id ?? `d${idx + 1}-t${tIdx + 1}`),
              label: String(t?.label ?? 'Tarea'),
              detail: String(t?.detail ?? ''),
              tags: Array.isArray(t?.tags) ? t.tags.map(String) : undefined,
            }))
          : [],
      }))
    : [];

  return {
    ...meta,
    howItWorks,
    daysDef,
    durationDays: input?.durationDays ?? daysDef.length,
  };
}

// ---------- Carga dinámica del programa ----------
export async function getProgramDef(slug: string): Promise<ProgramDef> {
  const json = await loadProgramJson(slug);
  return normalizeProgramDef(slug, json);
}

// ---------- Helpers de cache local ----------
const LS_POINTS_KEY = 'akira_points_cache_v1';
const LS_RANK_KEY = 'akira_rank_cache_v1';
const LS_STREAK_KEY = 'akira_streak_cache_v1';
export const CACHE_TTL_MS = 5 * 60 * 1000;

type PointsCacheFormat =
  | { ts: number; value: { total_points: number } }
  | { _ts: number; total_points: number };

function nowTs() {
  return Date.now();
}

export function readPointsCache(): { total_points: number } | null {
  try {
    const raw = localStorage.getItem(LS_POINTS_KEY);
    if (!raw) return null;
    const obj: PointsCacheFormat = JSON.parse(raw);
    const ts = (obj as any).ts ?? (obj as any)._ts;
    const value =
      'value' in (obj as any) ? (obj as any).value : { total_points: (obj as any).total_points };
    if (typeof ts !== 'number' || nowTs() - ts > CACHE_TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}

export function writePointsCache(v: { total_points: number }) {
  try {
    const payload = { ts: nowTs(), value: { total_points: Number(v.total_points) } };
    localStorage.setItem(LS_POINTS_KEY, JSON.stringify(payload));
  } catch {}
}

export function readRankCache(): number | null {
  try {
    const raw = localStorage.getItem(LS_RANK_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const ts = obj?.ts ?? obj?._ts;
    if (typeof ts !== 'number' || nowTs() - ts > CACHE_TTL_MS) return null;
    const val = obj?.value;
    return typeof val === 'number' ? val : null;
  } catch {
    return null;
  }
}

export function writeRankCache(rank: number) {
  try {
    localStorage.setItem(LS_RANK_KEY, JSON.stringify({ ts: nowTs(), value: Number(rank) }));
  } catch {}
}

export function readStreakCache(): number | null {
  try {
    const raw = localStorage.getItem(LS_STREAK_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const ts = obj?._ts ?? obj?.ts;
    if (typeof ts !== 'number' || nowTs() - ts > CACHE_TTL_MS) return null;
    const v = obj?.v;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

export function isBootCacheFresh(): boolean {
  try {
    const pts = readPointsCache();
    const rank = readRankCache();
    return !!pts && (typeof rank === 'number' || readStreakCache() !== null);
  } catch {
    return false;
  }
}

// ---------- Estado Supabase ----------
export async function getActiveProgram(
  sb: SupabaseClient,
  userId: string,
  slug: string
): Promise<ActiveProgramRow | null> {
  const { data, error } = await sb
    .from(TABLE_PROGRAMS)
    .select('*')
    .eq('user_id', userId)
    .eq('program_slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error && (error as any).code !== 'PGRST116') throw error;
  if (!data) return null;

  const row = data as ActiveProgramRow;
  localStorage.setItem(
    'akira_program_active',
    JSON.stringify({ slug, startedAt: row.started_at, currentDay: row.current_day, ts: nowTs() })
  );
  return row;
}

export async function startProgram(
  sb: SupabaseClient,
  userId: string,
  slug: string
): Promise<ActiveProgramRow> {
  const { data, error } = await sb
    .from(TABLE_PROGRAMS)
    .upsert(
      {
        user_id: userId,
        program_slug: slug,
        started_at: new Date().toISOString(),
        current_day: 1,
        is_active: true,
      },
      { onConflict: 'user_id,program_slug' }
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as ActiveProgramRow;
}

export async function resetProgram(
  sb: SupabaseClient,
  userId: string,
  slug: string
): Promise<void> {
  const { error: delErr } = await sb
    .from(TABLE_TASKS)
    .delete()
    .eq('user_id', userId)
    .eq('program_slug', slug);
  if (delErr) throw delErr;

  const { error: upErr } = await sb
    .from(TABLE_PROGRAMS)
    .upsert(
      {
        user_id: userId,
        program_slug: slug,
        started_at: new Date().toISOString(),
        current_day: 1,
        is_active: true,
      },
      { onConflict: 'user_id,program_slug' }
    );
  if (upErr) throw upErr;
}

// ---------- Gestión de tareas ----------
async function ensureDayTaskRows(
  sb: SupabaseClient,
  userId: string,
  slug: string,
  day: number,
  def: ProgramDef
): Promise<void> {
  const dayDef = def.daysDef.find((d) => d.day === day);
  if (!dayDef) throw new Error(`Día ${day} no existe en ${slug}`);

  const { data: existing, error: exErr } = await sb
    .from(TABLE_TASKS)
    .select('task_id')
    .eq('user_id', userId)
    .eq('program_slug', slug)
    .eq('day', day);
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
    const { error: insErr } = await sb.from(TABLE_TASKS).insert(toInsert);
    if (insErr) throw insErr;
  }
}

export type TaskWithStatus = ProgramTaskDef & {
  day: number;
  completed: boolean;
  completed_at: string | null;
};

export async function getDayTasks(
  sb: SupabaseClient,
  userId: string,
  slug: string,
  day: number
): Promise<TaskWithStatus[]> {
  const def = await getProgramDef(slug);
  await ensureDayTaskRows(sb, userId, slug, day, def);

  const { data: rows, error } = await sb
    .from(TABLE_TASKS)
    .select('*')
    .eq('user_id', userId)
    .eq('program_slug', slug)
    .eq('day', day);
  if (error) throw error;

  const dayDef = def.daysDef.find((d) => d.day === day)!;
  const map = new Map((rows as UserTaskRow[] | null)?.map((r) => [r.task_id, r]) || []);
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
  sb: SupabaseClient,
  userId: string,
  slug: string,
  day: number,
  taskId: string,
  completed: boolean
): Promise<{ advanced: boolean; nextDay: number | null }> {
  const { error: upErr } = await sb
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
      { onConflict: 'user_id,program_slug,day,task_id' }
    );
  if (upErr) throw upErr;

  const { data: pending, error: pendErr } = await sb
    .from(TABLE_TASKS)
    .select('task_id')
    .eq('user_id', userId)
    .eq('program_slug', slug)
    .eq('day', day)
    .eq('completed', false);
  if (pendErr) throw pendErr;

  if (!pending || pending.length === 0) {
    const { data: prog, error: selErr } = await sb
      .from(TABLE_PROGRAMS)
      .select('*')
      .eq('user_id', userId)
      .eq('program_slug', slug)
      .maybeSingle();
    if (selErr) throw selErr;

    const next = Math.max(day + 1, (prog as ActiveProgramRow | null)?.current_day ?? day + 1);
    const { error: updErr } = await sb
      .from(TABLE_PROGRAMS)
      .update({ current_day: next, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('program_slug', slug);
    if (updErr) throw updErr;

    return { advanced: true, nextDay: next };
  }
  return { advanced: false, nextDay: null };
}

export async function getProgress(
  sb: SupabaseClient,
  userId: string,
  slug: string
): Promise<{ daysCompleted: number; totalDays: number; currentDay: number }> {
  const def = await getProgramDef(slug);

  const { data: prog, error: pErr } = await sb
    .from(TABLE_PROGRAMS)
    .select('*')
    .eq('user_id', userId)
    .eq('program_slug', slug)
    .maybeSingle();
  if (pErr) throw pErr;

  const { data: rows, error: rErr } = await sb
    .from(TABLE_TASKS)
    .select('day, completed')
    .eq('user_id', userId)
    .eq('program_slug', slug);
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
    totalDays: def.durationDays ?? def.daysDef.length,
    currentDay: (prog as ActiveProgramRow | null)?.current_day ?? 1,
  };
}

/* ========= RPCs de puntos y ranking ========= */
export type ProgramPointsTotals = {
  total_points: number;
  checks_done: number;
  days_completed: number;
};

export type ProgramPointsByDayRow = {
  day_index: number;
  tasks_total: number;
  tasks_done: number;
  day_completed: boolean;
  day_points: number;
};

export async function fetchProgramPoints(uid: string, slug: string): Promise<ProgramPointsTotals> {
  const { data, error } = await supabase.rpc('get_program_points', { p_user: uid, p_slug: slug });
  if (error) throw error;
  return (data?.[0] ?? { total_points: 0, checks_done: 0, days_completed: 0 }) as ProgramPointsTotals;
}

export async function fetchProgramPointsByDay(
  uid: string,
  slug: string
): Promise<ProgramPointsByDayRow[]> {
  const { data, error } = await supabase.rpc('get_program_points_by_day', { p_user: uid, p_slug: slug });
  if (error) throw error;
  return (data ?? []) as ProgramPointsByDayRow[];
}

/* ========= GLOBAL y ranking mensual ========= */
export type GlobalPointsTotal = { total_points: number };

export async function fetchGlobalProgramPoints(
  fromISO: string,
  toISO: string
): Promise<GlobalPointsTotal | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { total_points: 0 };

  const { data, error } = await supabase.rpc('get_user_program_points_total', {
    p_user_id: uid,
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) {
    console.warn('[fetchGlobalProgramPoints]', error);
    return null;
  }
  return Array.isArray(data)
    ? (data[0] ?? { total_points: 0 })
    : (data ?? { total_points: 0 });
}

export type MonthlyRank = { rank_month: number; total_points: number } | null;

export async function fetchMyMonthlyRank(): Promise<MonthlyRank> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase.rpc('get_monthly_rank_for_user', { p_user_id: uid });
  if (error) {
    console.warn('[fetchMyMonthlyRank]', error);
    return null;
  }
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

/* ========= Racha real de días ========= */
export async function fetchUserStreakDays(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return 0;

  const { data, error } = await supabase.rpc('get_user_streak_days', { p_user_id: uid });
  if (error) {
    console.warn('[fetchUserStreakDays]', error);
    return 0;
  }
  const v =
    Array.isArray(data) ? (data[0] as any)?.streak_days : (data as any)?.streak_days ?? data;
  return typeof v === 'number' ? v : 0;
}
