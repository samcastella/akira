'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

/* ========= Tipos ========= */
type Sex = 'masculino' | 'femenino' | 'prefiero_no_decirlo';

type PublicProfile = {
  user_id: string;
  username?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  fecha_nacimiento?: string | null; // ISO (yyyy-mm-dd)
  edad?: number | null; // fallback si existe en DB
  sexo?: Sex | null;
  instagram?: string | null;
  tiktok?: string | null;
  avatar_url?: string | null;
};

type FriendReqRow = { requester: string };
type FriendAddRow = { addressee: string };

/* ========= Helpers ========= */
function normalizeUrl(val: string) {
  const v = val.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + v.replace(/^@/, '');
}
function handleFromUrl(val?: string | null) {
  if (!val) return '';
  const m = val.match(/\/(@?[^\/?#]+)$/);
  if (m?.[1]) return m[1].replace(/^@/, '');
  return val.replace(/^https?:\/\/(www\.)?[^/]+\//i, '').replace(/^@/, '');
}
function stripAt(s: string) {
  return s.replace(/^@/, '');
}
function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}
function initials(name?: string | null, surname?: string | null) {
  const a = (name || '').trim();
  const b = (surname || '').trim();
  const i = (a ? a[0] : '') + (b ? b[0] : '');
  return i || 'U';
}
function calcAge(iso?: string | null, fallback?: number | null) {
  if (!iso) return fallback ?? undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallback ?? undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

/* ========= Modales ========= */
function ModalBase({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <button className="text-sm underline" onClick={onClose}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RequestsModal({ open, onClose, ids, dir, onAccept, onReject, disabled }: {
  open: boolean;
  onClose: () => void;
  ids: string[];
  dir: Record<string, PublicProfile>;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <ModalBase open={open} onClose={onClose} title="Solicitudes de amistad">
      {ids.length === 0 && (
        <div className="text-sm text-gray-500">No tienes solicitudes pendientes.</div>
      )}
      <ul className="divide-y divide-[var(--line)]">
        {ids.map((id) => {
          const u = dir[id];
          if (!u) return null;
          const username = u.username || handleFromUrl(u.instagram) || 'usuario';
          return (
            <li key={id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar u={u} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.nombre || '—'} {u.apellido || ''}</div>
                  <div className="text-xs text-gray-500 truncate">@{stripAt(username)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-full text-sm bg-black text-white disabled:opacity-50" onClick={() => onAccept(id)} disabled={disabled}>Aceptar</button>
                <button className="px-3 py-1.5 rounded-full text-sm border border-[var(--line)] disabled:opacity-50" onClick={() => onReject(id)} disabled={disabled}>Rechazar</button>
              </div>
            </li>
          );
        })}
      </ul>
    </ModalBase>
  );
}

function ProfileModal({ open, onClose, profile }: { open: boolean; onClose: () => void; profile?: PublicProfile | null; }) {
  return (
    <ModalBase open={!!open} onClose={onClose} title="Perfil">
      {!profile ? (
        <div className="text-sm text-gray-500">No hay datos para mostrar.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar u={profile} size={48} />
            <div>
              <div className="font-semibold text-sm">{profile.nombre || '—'} {profile.apellido || ''}</div>
              <div className="text-xs text-gray-500">@{stripAt(profile.username || handleFromUrl(profile.instagram) || 'usuario')}</div>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-gray-500">Nombre</dt>
            <dd className="col-span-2">{profile.nombre || '—'}</dd>
            <dt className="text-gray-500">Apellidos</dt>
            <dd className="col-span-2">{profile.apellido || '—'}</dd>
            <dt className="text-gray-500">Edad</dt>
            <dd className="col-span-2">{calcAge(profile.fecha_nacimiento, profile.edad) ?? '—'}</dd>
            <dt className="text-gray-500">Instagram</dt>
            <dd className="col-span-2">
              {profile.instagram ? (
                <a className="underline" href={normalizeUrl(profile.instagram)} target="_blank" rel="noreferrer">
                  @{stripAt(handleFromUrl(profile.instagram))}
                </a>
              ) : '—'}
            </dd>
            <dt className="text-gray-500">TikTok</dt>
            <dd className="col-span-2">
              {profile.tiktok ? (
                <a className="underline" href={normalizeUrl(profile.tiktok)} target="_blank" rel="noreferrer">
                  @{stripAt(handleFromUrl(profile.tiktok))}
                </a>
              ) : '—'}
            </dd>
          </dl>
        </div>
      )}
    </ModalBase>
  );
}

function InfoGateModal({ open, onClose }: { open: boolean; onClose: () => void; }) {
  return (
    <ModalBase open={open} onClose={onClose} title="Información restringida">
      <p className="text-sm">Para ver la información de este usuario pídele conectar contigo.</p>
      <div className="mt-3 flex justify-end">
        <button className="px-3 py-1.5 rounded-full text-sm border border-[var(--line)]" onClick={onClose}>Cerrar</button>
      </div>
    </ModalBase>
  );
}

/* ========= Subcomponentes ========= */
function Avatar({ u, size = 40 }: { u: PublicProfile; size?: number }) {
  const label = initials(u.nombre, u.apellido);
  if (u.avatar_url) {
    return (
      <img
        src={u.avatar_url}
        alt={label}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function FriendRow({
  u,
  isFriend,
  canAccept,
  onConnect,
  onUserClick,
  disabled,
}: {
  u: PublicProfile;
  isFriend: boolean;
  canAccept?: boolean; // no usado en UI principal, reservado
  onConnect: () => void;
  onUserClick: () => void;
  disabled: boolean;
}) {
  const username = u.username || handleFromUrl(u.instagram) || 'usuario';
  return (
    <li className="flex items-center justify-between py-3">
      <button className="flex items-center gap-3 min-w-0 text-left" onClick={onUserClick} aria-label={`Abrir ${username}`}>
        <Avatar u={u} />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{u.nombre || '—'} {u.apellido || ''}</div>
          <div className="text-xs text-gray-500 truncate">@{stripAt(username)}</div>
        </div>
      </button>
      {isFriend ? (
        <span className="px-3 py-1.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-[var(--line)]">Amigo ✓</span>
      ) : (
        <button
          className="px-3 py-1.5 rounded-full text-sm bg-black text-white disabled:opacity-50"
          onClick={onConnect}
          disabled={disabled}
        >
          Conectar
        </button>
      )}
    </li>
  );
}

/* ========= Página ========= */
export default function AmigosPage() {
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
  const [pendingIn, setPendingIn] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const [showReqs, setShowReqs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [profileSel, setProfileSel] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      const { data: users } = await supabase
        .from('public_profiles')
        .select('*')
        .returns<PublicProfile[]>();
      if (!alive) return;
      const map: Record<string, PublicProfile> = {};
      (users ?? []).forEach((u) => { if (u.user_id) map[u.user_id] = u; });
      setDir(map);

      if (!userId) { setPendingIn([]); setFriends([]); return; }

      const { data: pendIn } = await supabase
        .from('friendships')
        .select('requester')
        .eq('addressee', userId)
        .eq('status', 'pending')
        .returns<FriendReqRow[]>();
      if (!alive) return;
      setPendingIn((pendIn || []).map((r) => r.requester));

      const { data: acceptedAsReq } = await supabase
        .from('friendships')
        .select('addressee')
        .eq('requester', userId)
        .eq('status', 'accepted')
        .returns<FriendAddRow[]>();
      const { data: acceptedAsAdd } = await supabase
        .from('friendships')
        .select('requester')
        .eq('addressee', userId)
        .eq('status', 'accepted')
        .returns<FriendReqRow[]>();
      if (!alive) return;
      const ids = [
        ...(acceptedAsReq || []).map((r) => r.addressee),
        ...(acceptedAsAdd || []).map((r) => r.requester),
      ];
      setFriends(ids);
    }
    loadAll();
    return () => { alive = false; };
  }, [userId]);

  const disabled = !userId;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const arr = Object.values(dir).filter((u) => u.user_id !== userId);
    if (!term) return arr;
    return arr.filter((u) => {
      const name = (u.nombre || '').toLowerCase();
      const last = (u.apellido || '').toLowerCase();
      const user = (u.username || '').toLowerCase();
      return (
        name.includes(term) ||
        last.includes(term) ||
        user.includes(term)
      );
    });
  }, [dir, q, userId]);

  async function sendRequest(targetId: string) {
    if (!userId || friends.includes(targetId)) return;
    await supabase.from('friendships').upsert({ requester: userId, addressee: targetId, status: 'pending' });
  }

  async function acceptRequest(fromId: string) {
    if (!userId) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', fromId).eq('addressee', userId);
    setPendingIn((prev) => prev.filter((x) => x !== fromId));
    setFriends((prev) => [...prev, fromId]);
  }

  async function rejectRequest(fromId: string) {
    if (!userId) return;
    await supabase.from('friendships').update({ status: 'rejected' }).eq('requester', fromId).eq('addressee', userId);
    setPendingIn((prev) => prev.filter((x) => x !== fromId));
  }

  function openUser(u: PublicProfile) {
    if (friends.includes(u.user_id)) {
      setProfileSel(u);
      setShowProfile(true);
    } else {
      setShowGate(true);
    }
  }

  const pendingCount = pendingIn.length;

  return (
    <main>
      {/* Top bar estilo Instagram */}
      <div className="h-12 bg-white flex items-center justify-between px-4 border-b border-[var(--line)]">
        <Link href="/" className="text-sm">Inicio</Link>
        <h1 className="text-base font-semibold">Amigos</h1>
        <div className="w-10" />
      </div>

      {/* Buscador */}
      <div className="px-4 py-3 border-b border-[var(--line)] bg-white sticky top-12 z-10">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o usuario…"
          className="w-full h-10 rounded-full border border-[var(--line)] px-4 text-[16px] outline-none"
        />
      </div>

      {/* Banner solicitudes */}
      {pendingCount > 0 && (
        <div className="px-4 py-2 bg-white border-b border-[var(--line)]">
          <button
            className="w-full text-sm text-left px-3 py-2 rounded-xl bg-gray-50 border border-[var(--line)]"
            onClick={() => setShowReqs(true)}
          >
            {pendingCount === 1 ? '1 usuario quiere ser tu amigo' : `${pendingCount} usuarios quieren ser tu amigo`}{' '}
            <span className="underline">(Ver solicitudes)</span>
          </button>
        </div>
      )}

      {/* Lista de usuarios */}
      <ul className="divide-y divide-[var(--line)] bg-white">
        {list.map((u) => (
          <FriendRow
            key={u.user_id}
            u={u}
            isFriend={friends.includes(u.user_id)}
            onConnect={() => sendRequest(u.user_id)}
            onUserClick={() => openUser(u)}
            disabled={disabled}
          />
        ))}
        {list.length === 0 && (
          <li className="p-4 text-sm text-gray-500">Sin resultados</li>
        )}
      </ul>

      {/* Modales */}
      <RequestsModal
        open={showReqs}
        onClose={() => setShowReqs(false)}
        ids={pendingIn}
        dir={dir}
        onAccept={acceptRequest}
        onReject={rejectRequest}
        disabled={disabled}
      />

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} profile={profileSel} />
      <InfoGateModal open={showGate} onClose={() => setShowGate(false)} />
    </main>
  );
}
