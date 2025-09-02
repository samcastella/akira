import { supabase } from '@/lib/supabaseClient';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function requireUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No autenticado');
  return session.user;
}

/** Crear reto + días + auto-miembro (owner). Devuelve {id, code}. */
export async function createChallengeWithDays(input: {
  title: string;
  start: string; // yyyy-mm-dd
  end: string;   // yyyy-mm-dd
  days: { day: string; title: string }[];
}) {
  const user = await requireUser();

  // Genera un code único sencillo (reintentos)
  let code = randomCode();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase
      .from('challenges')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!clash) break;
    code = randomCode();
  }

  const { data: challenge, error: e1 } = await supabase
    .from('challenges')
    .insert({ owner_id: user.id, title: input.title, start: input.start, end: input.end, code })
    .select('id, code')
    .single();
  if (e1) throw e1;

  const payload = input.days.map(d => ({ challenge_id: challenge.id, day: d.day, title: d.title }));
  const { error: e2 } = await supabase.from('challenge_days').insert(payload);
  if (e2) throw e2;

  const { error: e3 } = await supabase
    .from('challenge_members')
    .insert({ challenge_id: challenge.id, user_id: user.id });
  if (e3) throw e3;

  return challenge;
}

/** Unirse a un reto por código (RPC con RLS). */
export async function joinByCode(code: string) {
  const { data, error } = await supabase.rpc('join_challenge_by_code', { p_code: code });
  if (error) throw error;
  return data as string; // challenge_id
}

/** Retos donde soy miembro + número de miembros. */
export async function getMyChallenges() {
  const user = await requireUser();

  // ids de retos donde soy miembro
  const { data: mems, error: e0 } = await supabase
    .from('challenge_members')
    .select('challenge_id')
    .eq('user_id', user.id);
  if (e0) throw e0;
  const ids = (mems || []).map(m => m.challenge_id);
  if (!ids.length) return [];

  const { data: challenges, error: e1 } = await supabase
    .from('challenges')
    .select('id, code, title, start, end')
    .in('id', ids)
    .order('start', { ascending: false });
  if (e1) throw e1;

  // contar miembros por reto
  const counts: Record<string, number> = {};
  const { data: memberRows, error: e2 } = await supabase
    .from('challenge_members')
    .select('challenge_id, user_id')
    .in('challenge_id', ids);
  if (e2) throw e2;
  memberRows?.forEach(r => (counts[r.challenge_id] = (counts[r.challenge_id] || 0) + 1));

  return (challenges || []).map(c => ({ ...c, members_count: counts[c.id] || 1 }));
}

/** Días de un reto (ordenados). */
export async function getChallengeDays(challengeId: string) {
  const { data, error } = await supabase
    .from('challenge_days')
    .select('id, day, title')
    .eq('challenge_id', challengeId)
    .order('day');
  if (error) throw error;
  return data || [];
}

/** Actualizar título de un día (solo owner por RLS). */
export async function updateDayTitle(dayId: string, title: string) {
  const { error } = await supabase.from('challenge_days').update({ title }).eq('id', dayId);
  if (error) throw error;
}
