'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

/* ===========================
   Tipos
   =========================== */
type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

type PublicProfile = {
  user_id: string;
  nombre?: string;
  apellido?: string;
  sexo?: Sex;
  instagram?: string;
  tiktok?: string;
};

type DayDraft = { date: string; title: string };
type DayRow = { id: string; day: string; title: string };
type ChallengeRow = {
  id: string;
  code: string;
  owner_id: string;
  title: string;
  start: string;
  end: string;
};

/* ===========================
   Helpers
   =========================== */
const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function normalizeUrl(val: string) {
  const v = val.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + v.replace(/^@/, '');
}
function handleFromUrl(val?: string) {
  if (!val) return '';
  const m = val.match(/\/@?([^/?#]+)$/);
  if (m?.[1]) return m[1];
  return val.replace(/^https?:\/\/(www\.)?[^/]+\//i, '').replace(/^@/, '');
}
function stripAt(s: string) {
  return s.replace(/^@/, '');
}

/* ===========================
   Página Mis Amigos
   =========================== */
export default function AmigosPage() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<'crear' | 'unirse' | 'retos' | 'buscar' | 'ranking'>('crear');

  // Requiere sesión (muy simple)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setSessionUserId(uid);
      if (!uid) window.location.href = '/login';
    });
  }, []);

  // Sube/actualiza mi perfil público con lo que haya en local (nombre/rrss)
  useEffect(() => {
    if (!sessionUserId) return;
    try {
      const raw = localStorage.getItem('akira_user_v1');
      const me = raw ? JSON.parse(raw) : {};
      supabase
        .from('public_profiles')
        .upsert(
          {
            user_id: sessionUserId,
            nombre: me.nombre || null,
            apellido: me.apellido || null,
            sexo: me.sexo || null,
            instagram: me.instagram || null,
            tiktok: me.tiktok || null,
          },
          { onConflict: 'user_id' }
        )
        .then();
    } catch {}
  }, [sessionUserId]);

  if (!sessionUserId) {
    return (
      <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <h2 className="page-title">Mis amigos</h2>
        <p className="text-sm muted">Redirigiendo a inicio de sesión…</p>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="page-title">Mis amigos</h2>
        <Link href="/" className="btn secondary">
          Volver
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button className={`btn ${tab === 'crear' ? '' : 'secondary'}`} onClick={() => setTab('crear')}>
          Crear reto
        </button>
        <button className={`btn ${tab === 'unirse' ? '' : 'secondary'}`} onClick={() => setTab('unirse')}>
          Unirse con código
        </button>
        <button className={`btn ${tab === 'retos' ? '' : 'secondary'}`} onClick={() => setTab('retos')}>
          Retos con amigos
        </button>
        <button className={`btn ${tab === 'buscar' ? '' : 'secondary'}`} onClick={() => setTab('buscar')}>
          Buscar amigos
        </button>
        <button className={`btn ${tab === 'ranking' ? '' : 'secondary'}`} onClick={() => setTab('ranking')}>
          Ranking
        </button>
      </div>

      {tab === 'crear' && <CreateChallenge userId={sessionUserId} onCreated={() => setTab('retos')} />}
      {tab === 'unirse' && <JoinChallenge />}
      {tab === 'retos' && <MyChallenges userId={sessionUserId} />}
      {tab === 'buscar' && <Friends userId={sessionUserId} />}
      {tab === 'ranking' && <RankingPlaceholder />}
    </main>
  );
}

/* ===========================
   Crear reto (Supabase)
   =========================== */
function CreateChallenge({ userId, onCreated }: { userId: string; onCreated?: () => void }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [days, setDays] = useState<DayDraft[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [createdOpen, setCreatedOpen] = useState(false); // popup

  useEffect(() => {
    if (start && end) {
      const dates = eachDateInclusive(start, end);
      setDays(dates.map((d) => ({ date: d, title: title || 'Reto' })));
    } else {
      setDays([]);
    }
  }, [start, end, title]);

  function updateDay(idx: number, val: string) {
    setDays((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], title: val };
      return next;
    });
  }

  async function create() {
    if (!title || !start || !end || days.length === 0) return;

    // Genera código único con reintentos mínimos
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase.from('challenges').select('id').eq('code', code).maybeSingle();
      if (!clash) break;
      code = randomCode();
    }

    // 1) challenge
    const { data: ch, error: e1 } = await supabase
      .from('challenges')
      .insert({ owner_id: userId, title, start, end, code })
      .select('id, code')
      .single();
    if (e1) {
      console.error(e1);
      return;
    }

    // 2) days
    const payload = days.map((d) => ({ challenge_id: ch.id, day: d.date, title: d.title }));
    const { error: e2 } = await supabase.from('challenge_days').insert(payload);
    if (e2) {
      console.error(e2);
    }

    // 3) me as member
    const { error: e3 } = await supabase.from('challenge_members').insert({ challenge_id: ch.id, user_id: userId });
    if (e3) {
      console.error(e3);
    }

    setCode(ch.code);
    setCreatedOpen(true);
  }

  return (
    <section className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
      <h3 className="font-semibold text-base">Crear reto conjunto</h3>

      <label className="block">
        <span className="text-xs font-medium">Nombre del reto</span>
        <input className="input mt-1 text-[16px]" placeholder="Entrenar, Correr, Meditar…" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium">Inicio del reto</span>
          <input type="date" className="input mt-1 text-[16px]" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium">Final del reto</span>
          <input type="date" className="input mt-1 text-[16px]" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      {days.length > 0 && (
        <div className="mt-2">
          <p className="text-xs mb-2 muted">Edita los días (p. ej. “correr 1 km”, “correr 2 km”…)</p>
          <ul className="space-y-2 max-h-[260px] overflow-auto pr-1">
            {days.map((d, i) => (
              <li key={d.date} className="flex items-center gap-2">
                <span className="text-xs shrink-0 w-[96px]">{d.date}</span>
                <input className="input text-[14px] flex-1" value={d.title} onChange={(e) => updateDay(i, e.target.value)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn" onClick={create} disabled={!title || !start || !end}>
          Crear reto
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            setTitle('');
            setStart('');
            setEnd('');
            setDays([]);
            setCode(null);
          }}
        >
          Limpiar
        </button>
      </div>

      {code && (
        <div className="bg-black/5 rounded-xl p-3 mt-2">
          <div className="text-xs muted">Código para compartir</div>
          <div className="text-lg font-semibold tracking-widest">{code}</div>
          <div className="text-xs mt-1">
            Tus amigos pueden ir a <b>Unirse con código</b> y pegarlo.
          </div>
        </div>
      )}

      {/* Pop-up: Reto creado */}
      {createdOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 text-sm" style={{ width: 'min(90vw, 360px)' }} role="dialog" aria-modal="true">
            <p className="font-semibold">Reto creado con éxito</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn"
                onClick={() => {
                  setCreatedOpen(false);
                  onCreated?.();
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===========================
   Unirse con código (Supabase RPC)
   =========================== */
function JoinChallenge() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function join() {
    try {
      const { data, error } = await supabase.rpc('join_challenge_by_code', { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      if (!data) throw new Error('Código no válido');
      setMsg('¡Te has unido con éxito!');
    } catch (e: any) {
      setMsg(e?.message || 'Código no válido');
    }
  }

  return (
    <section className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
      <h3 className="font-semibold text-base">Unirse a un reto</h3>
      <label className="block">
        <span className="text-xs font-medium">Código del reto</span>
        <input className="input mt-1 text-[16px]" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" />
      </label>
      <button className="btn" onClick={join} disabled={!code.trim()}>
        Unirme
      </button>
      {msg && <p className="text-xs mt-1">{msg}</p>}
    </section>
  );
}

/* ===========================
   Retos con amigos (listado + editor)
   =========================== */
function MyChallenges({ userId }: { userId: string }) {
  const [list, setList] = useState<(ChallengeRow & { members_count: number })[]>([]);

  async function refresh() {
    // retos donde soy miembro
    const { data: mems } = await supabase.from('challenge_members').select('challenge_id').eq('user_id', userId);
    const ids = (mems || []).map((m) => m.challenge_id);
    if (!ids.length) {
      setList([]);
      return;
    }
    const { data: challenges } = await supabase
      .from('challenges')
      .select('id, code, owner_id, title, start, end')
      .in('id', ids)
      .order('start', { ascending: false });

    // contar miembros
    const { data: members } = await supabase.from('challenge_members').select('challenge_id, user_id').in('challenge_id', ids);
    const counts: Record<string, number> = {};
    members?.forEach((m) => (counts[m.challenge_id] = (counts[m.challenge_id] || 0) + 1));

    setList((challenges || []).map((c) => ({ ...c, members_count: counts[c.id] || 1 })));
  }

  useEffect(() => {
    refresh();
  }, [userId]);

  return (
    <section style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
      <h3 className="font-semibold text-base mb-2">Retos con amigos</h3>
      {!list.length ? (
        <p className="text-xs muted">Aún no tienes retos. Crea uno o únete con un código.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((ch) => (
            <li key={ch.id} className="border rounded-xl p-3" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{ch.title}</div>
                <div className="text-xs muted">
                  {ch.start} → {ch.end}
                </div>
              </div>
              <div className="text-xs mt-1">
                Código: <b>{ch.code}</b> · Miembros: {ch.members_count}
              </div>
              <details className="mt-2">
                <summary className="text-sm cursor-pointer">Ver / editar días</summary>
                <EditorDays challengeId={ch.id} ownerId={ch.owner_id} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditorDays({ challengeId, ownerId }: { challengeId: string; ownerId: string }) {
  const [days, setDays] = useState<DayRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
    supabase
      .from('challenge_days')
      .select('id, day, title')
      .eq('challenge_id', challengeId)
      .order('day')
      .then(({ data }) => setDays(data || []));
  }, [challengeId]);

  const canEdit = myId === ownerId;

  async function saveTitle(idx: number, val: string) {
    if (!canEdit) return;
    const d = days[idx];
    setDays((prev) => {
      const n = [...prev];
      n[idx] = { ...d, title: val };
      return n;
    });
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

/* ===========================
   Amigos: buscar / conectar / aceptar
   =========================== */
function Friends({ userId }: { userId: string }) {
  const [dir, setDir] = useState<Record<string, PublicProfile>>({});
  const [q, setQ] = useState('');
  const [pendingIn, setPendingIn] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);

  // carga directorio y estado de amistades
  useEffect(() => {
    async function loadAll() {
      const { data: users } = await supabase.from('public_profiles').select('*');
      const map: Record<string, PublicProfile> = {};
      (users || []).forEach((u) => (map[u.user_id] = u));
      setDir(map);

      // solicitudes recibidas
      const { data: pendIn } = await supabase
        .from('friendships')
        .select('requester')
        .eq('addressee', userId)
        .eq('status', 'pending');
      setPendingIn((pendIn || []).map((r) => r.requester));

      // amigos aceptados
      const { data: acceptedAsReq } = await supabase
        .from('friendships')
        .select('addressee')
        .eq('requester', userId)
        .eq('status', 'accepted');
      const { data: acceptedAsAdd } = await supabase
        .from('friendships')
        .select('requester')
        .eq('addressee', userId)
        .eq('status', 'accepted');

      const ids = [
        ...(acceptedAsReq || []).map((r) => r.addressee as string),
        ...(acceptedAsAdd || []).map((r) => r.requester as string),
      ];
      setFriends(ids);
    }
    loadAll();
  }, [userId]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const arr = Object.values(dir).filter((u) => u.user_id !== userId);
    if (!term) return arr.slice(0, 20);
    return arr.filter(
      (u) =>
        (u.nombre || '').toLowerCase().includes(term) ||
        (u.apellido || '').toLowerCase().includes(term) ||
        (u.instagram || '').toLowerCase().includes(term)
    );
  }, [dir, q, userId]);

  async function sendRequest(targetId: string) {
    if (friends.includes(targetId)) return;
    await supabase.from('friendships').upsert({ requester: userId, addressee: targetId, status: 'pending' });
    // reflejar UI un poco
    setPendingIn((prev) => prev.filter((x) => x !== targetId));
  }

  async function acceptRequest(fromId: string) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', fromId).eq('addressee', userId);
    setPendingIn((prev) => prev.filter((x) => x !== fromId));
    setFriends((prev) => [...prev, fromId]);
  }

  return (
    <section className="grid md:grid-cols-2 gap-4">
      {/* Buscar y enviar solicitud */}
      <div className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        <h3 className="font-semibold text-base">Buscar usuarios</h3>
        <input className="input text-[16px]" placeholder="Nombre, apellido o Instagram…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="space-y-2 max-h-[280px] overflow-auto pr-1">
          {results.map((u) => (
            <li key={u.user_id} className="border rounded-xl p-2 flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
              <div className="text-sm">
                <div className="font-semibold">
                  {u.nombre || '—'} {u.apellido || ''}
                </div>
                <div className="text-xs muted">{u.sexo || '—'}</div>
                <div className="text-xs break-all">
                  {u.instagram ? (
                    <a className="underline" href={normalizeUrl(u.instagram)} target="_blank" rel="noreferrer">
                      @{stripAt(handleFromUrl(u.instagram))}
                    </a>
                  ) : (
                    '—'
                  )}
                  {' · '}
                  {u.tiktok ? (
                    <a className="underline" href={normalizeUrl(u.tiktok)} target="_blank" rel="noreferrer">
                      @{stripAt(handleFromUrl(u.tiktok))}
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <button className="btn" onClick={() => sendRequest(u.user_id)}>
                Conectar
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="text-xs muted">Sin resultados</li>}
        </ul>
      </div>

      {/* Solicitudes y amigos */}
      <div className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        <h3 className="font-semibold text-base">Solicitudes y amigos</h3>

        <div>
          <div className="text-xs font-medium mb-1">Solicitudes recibidas</div>
          <ul className="space-y-2">
            {pendingIn.map((id) => {
              const u = dir[id];
              if (!u) return null;
              return (
                <li key={id} className="flex items-center justify-between border rounded-xl p-2" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-sm font-semibold">
                    {u.nombre} {u.apellido}
                  </span>
                  <button className="btn" onClick={() => acceptRequest(id)}>
                    Aceptar
                  </button>
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
                  <div className="font-semibold">
                    {u.nombre || '—'} {u.apellido || ''}
                  </div>
                  <div className="text-xs muted">{u.sexo || '—'}</div>
                  <div className="text-xs break-all">
                    Instagram:{' '}
                    {u.instagram ? (
                      <a className="underline" href={normalizeUrl(u.instagram)} target="_blank" rel="noreferrer">
                        @{stripAt(handleFromUrl(u.instagram))}
                      </a>
                    ) : (
                      '—'
                    )}
                    <br />
                    TikTok:{' '}
                    {u.tiktok ? (
                      <a className="underline" href={normalizeUrl(u.tiktok)} target="_blank" rel="noreferrer">
                        @{stripAt(handleFromUrl(u.tiktok))}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </li>
              );
            })}
            {friends.length === 0 && <li className="text-xs muted">Aún no tienes amigos añadidos</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ===========================
   Ranking placeholder
   =========================== */
function RankingPlaceholder() {
  return (
    <section className="text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
      <h3 className="font-semibold text-base">Ranking</h3>
      <p className="text-xs muted mt-1">Pronto podrás ver aquí la clasificación entre tus amigos.</p>
    </section>
  );
}
