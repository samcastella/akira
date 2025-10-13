'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ChallengeRow = { id: string; code: string; owner_id: string; title: string; start: string; end: string };
type MemberIdRow = { challenge_id: string };
type MemberRow = { challenge_id: string; user_id: string };
type DayRow = { id: string; day: string; title: string };

export default function MisRetosPage() {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let ok = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!ok) return;
      setUserId(data.session?.user?.id ?? undefined);
    })();
    return () => { ok = false; };
  }, []);

  const [list, setList] = useState<(ChallengeRow & { members_count: number })[]>([]);

  useEffect(() => {
    if (!userId) { setList([]); return; }
    (async () => {
      const { data: mems } = await supabase.from('challenge_members').select('challenge_id').eq('user_id', userId).returns<MemberIdRow[]>();
      const ids = (mems ?? []).map((m) => m.challenge_id);
      if (!ids.length) { setList([]); return; }

      const { data: challenges } = await supabase
        .from('challenges')
        .select('id, code, owner_id, title, start, end')
        .in('id', ids)
        .order('start', { ascending: false })
        .returns<ChallengeRow[]>();

      const { data: members } = await supabase
        .from('challenge_members')
        .select('challenge_id, user_id')
        .in('challenge_id', ids)
        .returns<MemberRow[]>();

      const counts: Record<string, number> = {};
      (members ?? []).forEach((m) => { counts[m.challenge_id] = (counts[m.challenge_id] ?? 0) + 1; });

      setList((challenges ?? []).map((c) => ({ ...c, members_count: counts[c.id] ?? 1 })));
    })();
  }, [userId]);

  if (!userId) {
    return (
      <main className="text-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="page-title">Retos con amigos</h2>
          <Link href="/amigos/retos" className="btn secondary">Volver</Link>
        </div>
        <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
          <p className="text-xs muted">Inicia sesión para ver tus retos.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Retos con amigos</h2>
        <Link href="/amigos/retos" className="btn secondary">Volver</Link>
      </div>

      <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
        {!list.length ? (
          <p className="text-xs muted">Aún no tienes retos. Crea uno o únete con un código.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((ch) => (
              <li key={ch.id} className="border rounded-xl p-3" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{ch.title}</div>
                  <div className="text-xs muted">{ch.start} → {ch.end}</div>
                </div>
                <div className="text-xs mt-1">Código: <b>{ch.code}</b> · Miembros: {ch.members_count}</div>
                <details className="mt-2">
                  <summary className="text-sm cursor-pointer">Ver / editar días</summary>
                  <EditorDays challengeId={ch.id} ownerId={ch.owner_id} />
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EditorDays({ challengeId, ownerId }: { challengeId: string; ownerId: string }) {
  const [days, setDays] = useState<DayRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setMyId(data.user?.id ?? null);

      const { data: daysData } = await supabase
        .from('challenge_days')
        .select('id, day, title')
        .eq('challenge_id', challengeId)
        .order('day')
        .returns<DayRow[]>();
      if (!alive) return;
      setDays(daysData ?? []);
    })();
    return () => { alive = false; };
  }, [challengeId]);

  const canEdit = myId === ownerId;

  async function saveTitle(idx: number, val: string) {
    if (!canEdit) return;
    const d = days[idx];
    setDays((prev) => { const n = [...prev]; n[idx] = { ...d, title: val }; return n; });
    const { error } = await supabase.from('challenge_days').update({ title: val }).eq('id', d.id);
    if (error) console.error(error);
  }

  return (
    <ul className="space-y-2 mt-2 max-h-[240px] overflow-auto pr-1">
      {days.map((d, i) => (
        <li key={d.id} className="flex items-center gap-2">
          <span className="text-xs shrink-0 w-[96px]">{d.day}</span>
          <input className="input text-[14px] flex-1" value={d.title} onChange={(e) => saveTitle(i, e.target.value)} disabled={!canEdit} />
        </li>
      ))}
      {!canEdit && <li className="text-xs muted">Solo el creador del reto puede editar los días.</li>}
    </ul>
  );
}
