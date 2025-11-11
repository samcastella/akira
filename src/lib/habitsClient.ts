import { createClient } from '@supabase/supabase-js';

export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export type HabitRow = {
  id: string; user_id: string;
  name: string; color?: string | null; icon?: string | null;
  start_date?: string | null; end_date?: string | null; weekend?: boolean | null;
  deleted_at?: string | null; created_at: string; updated_at: string;
};

export type TickRow = {
  habit_id: string; date_key: string;
  done: boolean; done_at?: string | null;
  created_at: string; updated_at: string;
};

export async function pullHabits(updatedSince?: string) {
  let q = sb.from('habits').select('*').order('updated_at', { ascending: false });
  if (updatedSince) q = q.gte('updated_at', updatedSince);
  const { data, error } = await q; if (error) throw error;
  return data as HabitRow[];
}

export async function pullTicks(from: string, to: string, updatedSince?: string) {
  let q = sb.from('habit_ticks').select('*')
    .gte('date_key', from).lte('date_key', to)
    .order('updated_at', { ascending: false });
  if (updatedSince) q = q.gte('updated_at', updatedSince);
  const { data, error } = await q; if (error) throw error;
  return data as TickRow[];
}

export async function upsertHabits(rows: Partial<HabitRow>[]) {
  if (!rows.length) return;
  const payload = rows.map(r => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await sb.from('habits').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

export async function softDeleteHabits(ids: string[]) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  const { error } = await sb.from('habits')
    .update({ deleted_at: now, updated_at: now })
    .in('id', ids);
  if (error) throw error;
}

export async function upsertTicks(rows: Partial<TickRow>[]) {
  if (!rows.length) return;
  const payload = rows.map(r => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await sb.from('habit_ticks').upsert(payload, { onConflict: 'habit_id,date_key' });
  if (error) throw error;
}
