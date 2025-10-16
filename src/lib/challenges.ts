// src/lib/challenges.ts
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

/* ===========================
   Tipos
   =========================== */
type MemberIdRow = { challenge_id: string };
type MemberRow = { challenge_id: string; user_id: string };

type ChallengeRow = {
  id: string;
  code: string;
  owner_id?: string;
  title: string;
  start: string; // yyyy-mm-dd
  end: string;   // yyyy-mm-dd
};

type ChallengeWithCount = ChallengeRow & { members_count: number };

/** Tipo legacy para compatibilidad: mapea day_index/label -> day/title */
export type DayRow = { id: string; day: string; title: string };

/** Tipo nativo del nuevo esquema (por si lo necesitas) */
export type DayRowV2 = { id: string; day_index: number; label: string | null };

/* ===========================
   Utils
   =========================== */
function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function requireUser(): Promise<User> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) throw new Error('No autenticado');
  return session.user;
}

/* ===========================
   Helpers de personalización (RPC + Storage)
   =========================== */

/** Asegura filas 1..duration en challenge_days (solo owner por RLS) */
export async function ensureChallengeDays(challengeId: string, duration: number) {
  const { error } = await supabase.rpc('ensure_challenge_days', {
    p_challenge_id: challengeId,
    p_duration: duration,
  });
  if (error) throw error;
}

/** Inserta/actualiza el label de un día concreto (solo owner por RLS) */
export async function upsertDayLabel(challengeId: string, dayIndex: number, label: string) {
  const { error } = await supabase.rpc('upsert_day_label', {
    p_challenge_id: challengeId,
    p_day_index: dayIndex,
    p_label: label,
  });
  if (error) throw error;
}

/** Actualiza customize_days, rules y cover_url del reto (owner por RLS de challenges) */
export async function setChallengeMeta(
  challengeId: string,
  customize: boolean | null,
  rules: string | null,
  coverUrl: string | null
) {
  const { error } = await supabase.rpc('set_challenge_meta', {
    p_challenge_id: challengeId,
    p_customize: customize,
    p_rules: rules,
    p_cover_url: coverUrl,
  });
  if (error) throw error;
}

/** Sube portada al bucket challenge-covers y devuelve URL pública */
export async function uploadChallengeCover(challengeId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${challengeId}/cover.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('challenge-covers')
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from('challenge-covers').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('No se pudo obtener la URL pública de la portada.');
  return data.publicUrl;
}

/* ===========================
   Flujo principal (crear / unirse / listar / días)
   =========================== */

/** Crear reto + días + auto-miembro (owner). Devuelve {id, code}. */
export async function createChallengeWithDays(input: {
  title: string;
  start: string; // yyyy-mm-dd
  end: string;   // yyyy-mm-dd
  /** Acepta legacy { day, title } o nuevo { day_index, label } */
  days: Array<{ day?: string | number; title?: string; day_index?: number; label?: string }>;
}): Promise<{ id: string; code: string }> {
  const user = await requireUser();

  // Genera un code único con reintentos mínimos
  let code = randomCode();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase
      .from('challenges')
      .select('id')
      .eq('code', code)
      .maybeSingle()
      .returns<{ id: string } | null>();
    if (!clash) break;
    code = randomCode();
  }

  // Insert challenge (ahora también guardamos join_code = code)
  const { data: challenge, error: e1 } = await supabase
    .from('challenges')
    .insert({
      owner_id: user.id,
      title: input.title,
      start: input.start,
      end: input.end,
      code,
      join_code: code,
    })
    .select('id, code')
    .single()
    .returns<{ id: string; code: string }>();
  if (e1) throw e1;

  // Normaliza días al nuevo esquema (day_index / label)
  const payload = (input.days || []).map((d) => {
    const day_index =
      typeof d.day_index === 'number'
        ? d.day_index
        : Number(d.day) || 0;
    const label = d.label ?? d.title ?? '';
    return { challenge_id: challenge.id, day_index, label };
  }).filter((x) => Number.isFinite(x.day_index) && x.day_index >= 1);

  if (payload.length) {
    const { error: e2 } = await supabase.from('challenge_days').insert(payload);
    if (e2) throw e2;
  }

  // Miembro (owner)
  const { error: e3 } = await supabase
    .from('challenge_members')
    .insert({ challenge_id: challenge.id, user_id: user.id });
  if (e3) throw e3;

  return challenge;
}

/** Unirse a un reto por código (RPC con RLS). Devuelve el challenge_id. */
export async function joinByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_challenge_by_code', { p_code: code });
  if (error) throw error;
  if (!data) throw new Error('Código no válido');
  return data as string;
}

/** Retos donde soy miembro + número de miembros. */
export async function getMyChallenges(): Promise<ChallengeWithCount[]> {
  const user = await requireUser();

  // ids de retos donde soy miembro
  const { data: mems, error: e0 } = await supabase
    .from('challenge_members')
    .select('challenge_id')
    .eq('user_id', user.id)
    .returns<MemberIdRow[]>();
  if (e0) throw e0;

  const ids = (mems ?? []).map((m: MemberIdRow) => m.challenge_id);
  if (!ids.length) return [];

  const { data: challenges, error: e1 } = await supabase
    .from('challenges')
    .select('id, code, title, start, end')
    .in('id', ids)
    .order('start', { ascending: false })
    .returns<ChallengeRow[]>();
  if (e1) throw e1;

  // contar miembros por reto
  const { data: memberRows, error: e2 } = await supabase
    .from('challenge_members')
    .select('challenge_id, user_id')
    .in('challenge_id', ids)
    .returns<MemberRow[]>();
  if (e2) throw e2;

  const counts: Record<string, number> = {};
  (memberRows ?? []).forEach((r: MemberRow) => {
    counts[r.challenge_id] = (counts[r.challenge_id] ?? 0) + 1;
  });

  return (challenges ?? []).map((c: ChallengeRow) => ({
    ...c,
    members_count: counts[c.id] ?? 1,
  }));
}

/** Días de un reto (ordenados) — mantiene compat para código viejo */
export async function getChallengeDays(challengeId: string): Promise<DayRow[]> {
  const { data, error } = await supabase
    .from('challenge_days')
    .select('id, day_index, label')
    .eq('challenge_id', challengeId)
    .order('day_index', { ascending: true })
    .returns<DayRowV2[]>();
  if (error) throw error;

  const rows = (data ?? []).map((r) => ({
    id: r.id,
    day: String(r.day_index),
    title: r.label ?? '',
  }));
  return rows;
}

/** Actualizar título de un día (solo owner por RLS) — ahora escribe en label */
export async function updateDayTitle(dayId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('challenge_days')
    .update({ label: title })
    .eq('id', dayId);
  if (error) throw error;
}
