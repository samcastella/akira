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

type DayRow = { id: string; day: string; title: string };

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

/** Crear reto + días + auto-miembro (owner). Devuelve {id, code}. */
export async function createChallengeWithDays(input: {
  title: string;
  start: string; // yyyy-mm-dd
  end: string;   // yyyy-mm-dd
  days: { day: string; title: string }[];
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

  const { data: challenge, error: e1 } = await supabase
    .from('challenges')
    .insert({ owner_id: user.id, title: input.title, start: input.start, end: input.end, code })
    .select('id, code')
    .single()
    .returns<{ id: string; code: string }>();
  if (e1) throw e1;

  // Días
  const payload = input.days.map(d => ({ challenge_id: challenge.id, day: d.day, title: d.title }));
  const { error: e2 } = await supabase.from('challenge_days').insert(payload);
  if (e2) throw e2;

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
  // si el RPC devuelve NULL cuando no existe, lanzamos error explícito
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

/** Días de un reto (ordenados). */
export async function getChallengeDays(challengeId: string): Promise<DayRow[]> {
  const { data, error } = await supabase
    .from('challenge_days')
    .select('id, day, title')
    .eq('challenge_id', challengeId)
    .order('day')
    .returns<DayRow[]>();
  if (error) throw error;
  return data ?? [];
}

/** Actualizar título de un día (solo owner por RLS). */
export async function updateDayTitle(dayId: string, title: string): Promise<void> {
  const { error } = await supabase.from('challenge_days').update({ title }).eq('id', dayId);
  if (error) throw error;
}
