'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ===========================
   Storage keys (local demo)
   =========================== */
const LS_USER              = 'akira_user_v1';
const LS_USER_ID           = 'akira_user_id';
const LS_FRIENDS           = 'akira_friends_v1';          // {friends: string[], pendingOut: string[], pendingIn: string[]}
const LS_USERS_DIRECTORY   = 'akira_users_directory_v1';  // Record<userId, PublicProfile>
const LS_GROUP_CHALLENGES  = 'akira_groupchallenges_v1';  // Record<challengeId, Challenge>

type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

/* ===== Perfil público visible a amigos ===== */
type PublicProfile = {
  id: string;
  nombre?: string;
  apellido?: string;
  sexo?: Sex;
  instagram?: string;
  tiktok?: string;
};

/* ===== Reto conjunto ===== */
type DayItem = { date: string; title: string; done?: boolean };
type Challenge = {
  id: string;
  code: string;            // para compartir
  ownerId: string;
  title: string;
  start: string;           // yyyy-mm-dd
  end: string;             // yyyy-mm-dd
  days: DayItem[];         // 1 item por día (editable)
  members: string[];       // userIds participantes (incluye owner)
};

/* ===========================
   Utils
   =========================== */
const uid = () => Math.random().toString(36).slice(2, 10);

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, val: T) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
}

function ensureUserId(): string {
  let id = load<string | null>(LS_USER_ID, null);
  if (!id) {
    id = 'u_' + uid();
    save(LS_USER_ID, id);
  }
  return id;
}
function myPublicProfile(): PublicProfile {
  const me = load<Record<string, any>>(LS_USER, {});
  const id = ensureUserId();
  return {
    id,
    nombre: me.nombre,
    apellido: me.apellido,
    sexo: me.sexo,
    instagram: me.instagram,
    tiktok: me.tiktok,
  };
}
function upsertUserDirectory(profile: PublicProfile) {
  const dir = load<Record<string, PublicProfile>>(LS_USERS_DIRECTORY, {});
  dir[profile.id] = profile;
  save(LS_USERS_DIRECTORY, dir);
}

function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ===========================
   Página Mis Amigos
   =========================== */
export default function AmigosPage() {
  const me = useMemo(() => myPublicProfile(), []);
  const [tab, setTab] = useState<'crear' | 'unirse' | 'buscar'>('crear');

  // Sincroniza mi perfil público en el “directorio”
  useEffect(() => {
    upsertUserDirectory(me);
  }, [me]);

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="page-title">Mis amigos</h2>
        <Link href="/" className="btn secondary">Volver</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          className={`btn ${tab === 'crear' ? '' : 'secondary'}`}
          onClick={() => setTab('crear')}
        >
          Crear reto
        </button>
        <button
          className={`btn ${tab === 'unirse' ? '' : 'secondary'}`}
          onClick={() => setTab('unirse')}
        >
          Unirse con código
        </button>
        <button
          className={`btn ${tab === 'buscar' ? '' : 'secondary'}`}
          onClick={() => setTab('buscar')}
        >
          Buscar amigos
        </button>
      </div>

      {tab === 'crear' && <CreateChallenge me={me} />}
      {tab === 'unirse' && <JoinChallenge me={me} />}
      {tab === 'buscar' && <Friends me={me} />}

      <MyChallenges me={me} />
    </main>
  );
}

/* ===========================
   Create Challenge
   =========================== */
function CreateChallenge({ me }: { me: PublicProfile }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [days, setDays] = useState<DayItem[]>([]);
  const [code, setCode] = useState<string | null>(null);

  // Generar días cuando cambian fechas
  useEffect(() => {
    if (start && end) {
      const dates = eachDateInclusive(start, end);
      setDays(dates.map((d, i) => ({ date: d, title: title || 'Reto' })));
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

  function create() {
    if (!title || !start || !end || days.length === 0) return;
    const challenges = load<Record<string, Challenge>>(LS_GROUP_CHALLENGES, {});
    const id = 'c_' + uid();
    const code = id.slice(-6).toUpperCase(); // código corto legible
    const ch: Challenge = {
      id,
      code,
      ownerId: me.id,
      title,
      start,
      end,
      days,
      members: [me.id],
    };
    challenges[id] = ch;
    save(LS_GROUP_CHALLENGES, challenges);
    setCode(code);
  }

  return (
    <section className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
      <h3 className="font-semibold text-base">Crear reto conjunto</h3>

      <label className="block">
        <span className="text-xs font-medium">Nombre del reto</span>
        <input className="input mt-1 text-[16px]" placeholder="Entrenar, Correr, Meditar…" value={title} onChange={e => setTitle(e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium">Inicio del reto</span>
          <input type="date" className="input mt-1 text-[16px]" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium">Final del reto</span>
          <input type="date" className="input mt-1 text-[16px]" value={end} onChange={e => setEnd(e.target.value)} />
        </label>
      </div>

      {days.length > 0 && (
        <div className="mt-2">
          <p className="text-xs mb-2 muted">Edita los días (p. ej. “correr 1 km”, “correr 2 km”…)</p>
          <ul className="space-y-2 max-h-[260px] overflow-auto pr-1">
            {days.map((d, i) => (
              <li key={d.date} className="flex items-center gap-2">
                <span className="text-xs shrink-0 w-[96px]">{d.date}</span>
                <input
                  className="input text-[14px] flex-1"
                  value={d.title}
                  onChange={(e) => updateDay(i, e.target.value)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn" onClick={create} disabled={!title || !start || !end}>Crear reto</button>
        <button className="btn secondary" onClick={() => { setTitle(''); setStart(''); setEnd(''); setDays([]); setCode(null); }}>Limpiar</button>
      </div>

      {code && (
        <div className="bg-black/5 rounded-xl p-3 mt-2">
          <div className="text-xs muted">Código para compartir</div>
          <div className="text-lg font-semibold tracking-widest">{code}</div>
          <div className="text-xs mt-1">Tus amigos pueden ir a <b>Unirse con código</b> y pegarlo.</div>
        </div>
      )}
    </section>
  );
}

/* ===========================
   Join Challenge
   =========================== */
function JoinChallenge({ me }: { me: PublicProfile }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function join() {
    const store = load<Record<string, Challenge>>(LS_GROUP_CHALLENGES, {});
    const found = Object.values(store).find(c => c.code.toUpperCase() === code.trim().toUpperCase());
    if (!found) {
      setMsg('Código no válido.');
      return;
    }
    if (!found.members.includes(me.id)) {
      found.members.push(me.id);
      store[found.id] = found;
      save(LS_GROUP_CHALLENGES, store);
    }
    setMsg('¡Te has unido con éxito!');
  }

  return (
    <section className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
      <h3 className="font-semibold text-base">Unirse a un reto</h3>
      <label className="block">
        <span className="text-xs font-medium">Código del reto</span>
        <input className="input mt-1 text-[16px]" value={code} onChange={e => setCode(e.target.value)} placeholder="ABC123" />
      </label>
      <button className="btn" onClick={join} disabled={!code.trim()}>Unirme</button>
      {msg && <p className="text-xs mt-1">{msg}</p>}
    </section>
  );
}

/* ===========================
   My Challenges (listado)
   =========================== */
function MyChallenges({ me }: { me: PublicProfile }) {
  const [list, setList] = useState<Challenge[]>([]);
  useEffect(() => {
    const all = load<Record<string, Challenge>>(LS_GROUP_CHALLENGES, {});
    setList(Object.values(all).filter(c => c.members.includes(me.id)));
  }, [me.id]);

  if (!list.length) return null;

  return (
    <section className="mt-6" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
      <h3 className="font-semibold text-base mb-2">Mis retos conjuntos</h3>
      <ul className="space-y-3">
        {list.map(ch => (
          <li key={ch.id} className="border rounded-xl p-3" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{ch.title}</div>
              <div className="text-xs muted">{ch.start} → {ch.end}</div>
            </div>
            <div className="text-xs mt-1">Código: <b>{ch.code}</b> · Miembros: {ch.members.length}</div>
            <details className="mt-2">
              <summary className="text-sm cursor-pointer">Ver / editar días</summary>
              <EditorDays challengeId={ch.id} />
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditorDays({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    const store = load<Record<string, Challenge>>(LS_GROUP_CHALLENGES, {});
    setChallenge(store[challengeId] || null);
  }, [challengeId]);

  function saveTitle(idx: number, val: string) {
    const store = load<Record<string, Challenge>>(LS_GROUP_CHALLENGES, {});
    const ch = store[challengeId];
    if (!ch) return;
    ch.days[idx].title = val;
    store[challengeId] = ch;
    save(LS_GROUP_CHALLENGES, store);
    setChallenge({ ...ch });
  }

  if (!challenge) return null;

  return (
    <ul className="space-y-2 mt-2 max-h-[240px] overflow-auto pr-1">
      {challenge.days.map((d, i) => (
        <li key={d.date} className="flex items-center gap-2">
          <span className="text-xs shrink-0 w-[96px]">{d.date}</span>
          <input
            className="input text-[14px] flex-1"
            value={d.title}
            onChange={(e) => saveTitle(i, e.target.value)}
          />
        </li>
      ))}
    </ul>
  );
}

/* ===========================
   Friends: buscar/conectar
   =========================== */
type FriendsState = {
  friends: string[];
  pendingOut: string[]; // yo he enviado
  pendingIn: string[];  // me han enviado
};

function loadFriends(): FriendsState {
  return load<FriendsState>(LS_FRIENDS, { friends: [], pendingOut: [], pendingIn: [] });
}
function saveFriends(f: FriendsState) { save(LS_FRIENDS, f); }

function Friends({ me }: { me: PublicProfile }) {
  const [dir, setDir] = useState<Record<string, PublicProfile>>({});
  const [q, setQ] = useState('');
  const [state, setState] = useState<FriendsState>(loadFriends());

  useEffect(() => {
    // garantizar que yo estoy en el directorio
    upsertUserDirectory(me);
    setDir(load<Record<string, PublicProfile>>(LS_USERS_DIRECTORY, {}));
    setState(loadFriends());
  }, [me]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const arr = Object.values(dir).filter(u => u.id !== me.id);
    if (!term) return arr.slice(0, 20);
    return arr.filter(u =>
      (u.nombre || '').toLowerCase().includes(term) ||
      (u.apellido || '').toLowerCase().includes(term) ||
      (u.instagram || '').toLowerCase().includes(term)
    );
  }, [dir, q, me.id]);

  function sendRequest(targetId: string) {
    const st = loadFriends();
    if (st.friends.includes(targetId) || st.pendingOut.includes(targetId)) return;
    st.pendingOut.push(targetId);
    saveFriends(st);
    setState(st);

    // Simulación: también registramos que “el otro” recibió una solicitud en su LS (demo single-device)
    const otherKey = LS_FRIENDS + '_' + targetId;
    const other = load<FriendsState>(otherKey, { friends: [], pendingOut: [], pendingIn: [] });
    if (!other.pendingIn.includes(me.id)) other.pendingIn.push(me.id);
    save(otherKey, other);
  }

  function acceptRequest(fromId: string) {
    const st = loadFriends();
    st.pendingIn = st.pendingIn.filter(id => id !== fromId);
    if (!st.friends.includes(fromId)) st.friends.push(fromId);
    saveFriends(st);
    setState(st);

    // Simulación espejo
    const otherKey = LS_FRIENDS + '_' + fromId;
    const other = load<FriendsState>(otherKey, { friends: [], pendingOut: [], pendingIn: [] });
    other.pendingOut = other.pendingOut.filter(id => id !== me.id);
    if (!other.friends.includes(me.id)) other.friends.push(me.id);
    save(otherKey, other);
  }

  return (
    <section className="grid md:grid-cols-2 gap-4">
      {/* Buscar y enviar solicitud */}
      <div className="space-y-3 text-sm" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: 16 }}>
        <h3 className="font-semibold text-base">Buscar usuarios</h3>
        <input className="input text-[16px]" placeholder="Nombre, apellido o Instagram…" value={q} onChange={e => setQ(e.target.value)} />
        <ul className="space-y-2 max-h-[280px] overflow-auto pr-1">
          {results.map(u => (
            <li key={u.id} className="border rounded-xl p-2 flex items-center justify-between" style={{ borderColor: 'var(--line)' }}>
              <div className="text-sm">
                <div className="font-semibold">{u.nombre || '—'} {u.apellido || ''}</div>
                <div className="text-xs muted">{u.sexo || '—'}</div>
                <div className="text-xs break-all">
                  {u.instagram ? <a className="underline" href={normalizeUrl(u.instagram)} target="_blank" rel="noreferrer">@{stripAt(handleFromUrl(u.instagram))}</a> : '—'}
                  {' · '}
                  {u.tiktok ? <a className="underline" href={normalizeUrl(u.tiktok)} target="_blank" rel="noreferrer">@{stripAt(handleFromUrl(u.tiktok))}</a> : '—'}
                </div>
              </div>
              <button className="btn" onClick={() => sendRequest(u.id)}>Conectar</button>
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
            {state.pendingIn.map(id => {
              const u = dir[id];
              if (!u) return null;
              return (
                <li key={id} className="flex items-center justify-between border rounded-xl p-2" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-sm font-semibold">{u.nombre} {u.apellido}</span>
                  <button className="btn" onClick={() => acceptRequest(id)}>Aceptar</button>
                </li>
              );
            })}
            {state.pendingIn.length === 0 && <li className="text-xs muted">No tienes solicitudes</li>}
          </ul>
        </div>

        <div>
          <div className="text-xs font-medium mb-1">Amigos</div>
          <ul className="space-y-2">
            {state.friends.map(id => {
              const u = dir[id];
              if (!u) return null;
              return (
                <li key={id} className="border rounded-xl p-2" style={{ borderColor: 'var(--line)' }}>
                  <div className="font-semibold">{u.nombre || '—'} {u.apellido || ''}</div>
                  <div className="text-xs muted">{u.sexo || '—'}</div>
                  <div className="text-xs break-all">
                    Instagram: {u.instagram ? <a className="underline" href={normalizeUrl(u.instagram)} target="_blank" rel="noreferrer">@{stripAt(handleFromUrl(u.instagram))}</a> : '—'}
                    <br />
                    TikTok: {u.tiktok ? <a className="underline" href={normalizeUrl(u.tiktok)} target="_blank" rel="noreferrer">@{stripAt(handleFromUrl(u.tiktok))}</a> : '—'}
                  </div>
                </li>
              );
            })}
            {state.friends.length === 0 && <li className="text-xs muted">Aún no tienes amigos añadidos</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ===== helpers sociales para mostrar enlaces bonitos ===== */
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
function stripAt(s: string) { return s.replace(/^@/, ''); }
