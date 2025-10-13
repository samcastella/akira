'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';
type PublicProfile = { user_id: string; nombre?: string | null; apellido?: string | null; sexo?: Sex | null; instagram?: string | null; tiktok?: string | null; };
type FriendReqRow = { requester: string };
type FriendAddRow = { addressee: string };

function normalizeUrl(val: string) { const v = val.trim(); if (/^https?:\/\//i.test(v)) return v; return 'https://' + v.replace(/^@/, ''); }
function handleFromUrl(val?: string) { if (!val) return ''; const m = val.match(/\/@?([^/?#]+)$/); if (m?.[1]) return m[1]; return val.replace(/^https?:\/\/(www\.)?[^/]+\//i, '').replace(/^@/, ''); }
function stripAt(s: string) { return s.replace(/^@/, ''); }

export default function MisAmigosPage() {
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

  const [dir, setDir] = useState<Record<string, PublicProfile>>({});
  const [q, setQ] = useState('');
  const [pendingIn, setPendingIn] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      const { data: users } = await supabase.from('public_profiles').select('*').returns<PublicProfile[]>();
      if (!alive) return;
      const map: Record<string, PublicProfile> = {};
      (users ?? []).forEach((u) => { map[u.user_id] = u; });
      setDir(map);

      if (!userId) { setPendingIn([]); setFriends([]); return; }

      const { data: pendIn } = await supabase.from('friendships').select('requester').eq('addressee', userId).eq('status', 'pending').returns<FriendReqRow[]>();
      if (!alive) return;
      setPendingIn((pendIn || []).map((r) => r.requester));

      const { data: acceptedAsReq } = await supabase.from('friendships').select('addressee').eq('requester', userId).eq('status', 'accepted').returns<FriendAddRow[]>();
      const { data: acceptedAsAdd } = await supabase.from('friendships').select('requester').eq('addressee', userId).eq('status', 'accepted').returns<FriendReqRow[]>();
      if (!alive) return;
      const ids = [...(acceptedAsReq || []).map((r) => r.addressee), ...(acceptedAsAdd || []).map((r) => r.requester)];
      setFriends(ids);
    }
    loadAll();
    return () => { alive = false; };
  }, [userId]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const arr = Object.values(dir).filter((u) => u.user_id !== userId);
    if (!term) return arr.slice(0, 20);
    return arr.filter((u) => (u.nombre || '').toLowerCase().includes(term) || (u.apellido || '').toLowerCase().includes(term) || (u.instagram || '').toLowerCase().includes(term));
  }, [dir, q, userId]);

  async function sendRequest(targetId: string) {
    if (!userId) return;
    if (friends.includes(targetId)) return;
    await supabase.from('friendships').upsert({ requester: userId, addressee: targetId, status: 'pending' });
    setPendingIn((prev) => prev.filter((x) => x !== targetId));
  }

  async function acceptRequest(fromId: string) {
    if (!userId) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', fromId).eq('addressee', userId);
    setPendingIn((prev) => prev.filter((x) => x !== fromId));
    setFriends((prev) => [...prev, fromId]);
  }

  const disabled = !userId;

  return (
    <main className="grid md:grid-cols-2 gap-4">
      <section className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Buscar usuarios</h2>
          <Link href="/amigos" className="btn secondary">Volver</Link>
        </div>
        {!userId && <div className="text-xs">Puedes explorar perfiles sin iniciar sesión. Para conectar, <Link className="underline" href="/login?redirect=/amigos/mis-amigos">inicia sesión</Link>.</div>}
        <input className="input text-[16px]" placeholder="Nombre, apellido o Instagram…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="space-y-2 max-h-[280px] overflow-auto pr-1">
          {results.map((u) => (
            <li key={u.user_id} className="border rounded-xl p-2 flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
              <div className="text-sm">
                <div className="font-semibold">{u.nombre || '—'} {u.apellido || ''}</div>
                <div className="text-xs muted">{u.sexo || '—'}</div>
                <div className="text-xs break-all">
                  {u.instagram ? (
                    <a className="underline" href={normalizeUrl(u.instagram)} target="_blank" rel="noreferrer">
                      @{stripAt(handleFromUrl(u.instagram))}
                    </a>
                  ) : ('—')}
                  {' · '}
                  {u.tiktok ? (
                    <a className="underline" href={normalizeUrl(u.tiktok)} target="_blank" rel="noreferrer">
                      @{stripAt(handleFromUrl(u.tiktok))}
                    </a>
                  ) : ('—')}
                </div>
              </div>
              <button className="btn" onClick={() => sendRequest(u.user_id)} disabled={disabled}>Conectar</button>
            </li>
          ))}
          {results.length === 0 && <li className="text-xs muted">Sin resultados</li>}
        </ul>
      </section>

      <section className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        <h3 className="font-semibold text-base">Solicitudes y amigos</h3>

        <div>
          <div className="text-xs font-medium mb-1">Solicitudes recibidas</div>
          <ul className="space-y-2">
            {pendingIn.map((id) => {
              const u = dir[id];
              if (!u) return null;
              return (
                <li key={id} className="flex items-center justify-between border rounded-xl p-2" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-sm font-semibold">{u.nombre} {u.apellido}</span>
                  <button className="btn" onClick={() => acceptRequest(id)} disabled={disabled}>Aceptar</button>
                </li>
              );
            })}
            {pendingIn.length === 0 && <li className="text-xs muted">No tienes solicitudes</li>}
          </ul>
        </div>

        <div>
          <div className="text-xs font-medium mb-1">Amigos</div>
          <ul className="space-y-2">
            {friends.map((id) => {
              const u = dir[id];
              if (!u) return null;
              return (
                <li key={id} className="border rounded-xl p-2" style={{ borderColor: 'var(--line)' }}>
                  <div className="font-semibold">{u.nombre || '—'} {u.apellido || ''}</div>
                  <div className="text-xs muted">{u.sexo || '—'}</div>
                  <div className="text-xs break-all">
                    Instagram:{' '}
                    {u.instagram ? (
                      <a className="underline" href={normalizeUrl(u.instagram)} target="_blank" rel="noreferrer">
                        @{stripAt(handleFromUrl(u.instagram))}
                      </a>
                    ) : ('—')}
                    <br />
                    TikTok:{' '}
                    {u.tiktok ? (
                      <a className="underline" href={normalizeUrl(u.tiktok)} target="_blank" rel="noreferrer">
                        @{stripAt(handleFromUrl(u.tiktok))}
                      </a>
                    ) : ('—')}
                  </div>
                </li>
              );
            })}
            {friends.length === 0 && <li className="text-xs muted">Aún no tienes amigos añadidos</li>}
          </ul>
        </div>
      </section>
    </main>
  );
}
