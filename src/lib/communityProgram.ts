// src/lib/communityProgram.ts
import { supabase } from '@/lib/supabaseClient';

export type ProgramLeaderRow = {
  user_id: string;
  score: number;
  rank_position: number;
  username: string | null;
  nombre: string | null;
  apellido: string | null;
};

export async function loadProgramLeaders(programSlug: string): Promise<ProgramLeaderRow[]> {
  const { data, error } = await supabase
    .from('v_program_leaderboard_by_slug')
    .select('program_slug,user_id,score,rank_position,username,nombre,apellido')
    .eq('program_slug', programSlug)
    .order('rank_position', { ascending: true });

  if (error) {
    console.warn('[loadProgramLeaders] error', error);
    return [];
  }
  return (data ?? []) as ProgramLeaderRow[];
}

export async function loadProgramMembersCount(programSlug: string): Promise<number> {
  // Contamos usuarios que han iniciado el programa (sin vista adicional)
  const { count, error } = await supabase
    .from('user_programs')
    .select('user_id', { count: 'exact', head: true })
    .eq('program_slug', programSlug)
    .not('started_at', 'is', null);

  if (error) {
    console.warn('[loadProgramMembersCount] error', error);
    return 0;
  }
  return Number(count ?? 0);
}

export async function loadAvatarsFor(userIds: string[]): Promise<Record<string, string | null>> {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from('public_profiles')
    .select('user_id, avatar_url')
    .in('user_id', userIds);

  if (error) {
    console.warn('[loadAvatarsFor] error', error);
    return {};
  }

  const map: Record<string, string | null> = {};
  (data ?? []).forEach((r: any) => {
    map[r.user_id] = r.avatar_url ?? null;
  });
  return map;
}
