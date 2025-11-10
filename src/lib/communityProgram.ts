// src/lib/communityProgram.ts
import { supabase } from '@/lib/supabaseClient';

export type ProgramLeaderRow = {
  user_id: string;
  score: number;
  rank_position: number;
  handle?: string | null;
  nombre?: string | null;
  apellido?: string | null;
};

export async function loadProgramLeaders(slug: string): Promise<ProgramLeaderRow[]> {
  // 1) Intento: vista/tabla program_leaderboard
  const tryView = await supabase
    .from('program_leaderboard')
    .select('user_id, score, rank_position, handle, nombre, apellido')
    .eq('program_slug', slug)
    .order('rank_position', { ascending: true });

  if (!tryView.error && tryView.data) return tryView.data as ProgramLeaderRow[];

  // 2) Fallback: RPC get_program_leaderboard
  const { data, error } = await supabase.rpc('get_program_leaderboard', { p_program_slug: slug });
  if (!error && Array.isArray(data)) return data as ProgramLeaderRow[];

  console.warn('[communityProgram] No leaderboard available:', tryView.error || error);
  return [];
}

export async function loadProgramMembersCount(slug: string): Promise<number> {
  // Intento: vista program_members (program_slug, user_id)
  const tryView = await supabase
    .from('program_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('program_slug', slug);

  if (!tryView.error && typeof tryView.count === 'number') return tryView.count;

  // Fallback: RPC get_program_members_count
  const { data, error } = await supabase.rpc('get_program_members_count', { p_program_slug: slug });
  if (!error && typeof data === 'number') return Number(data);

  console.warn('[communityProgram] No members count available:', tryView.error || error);
  return 0;
}

export async function loadAvatarsFor(userIds: string[]) {
  if (!userIds.length) return {} as Record<string, string | null>;
  const { data, error } = await supabase
    .from('public_profiles')
    .select('user_id, avatar_url')
    .in('user_id', userIds);

  if (error) {
    console.warn('[communityProgram] public_profiles not available:', error);
    return {};
  }
  const map: Record<string, string | null> = {};
  (data ?? []).forEach((p: any) => {
    map[p.user_id] = (p.avatar_url as string) ?? null;
  });
  return map;
}
