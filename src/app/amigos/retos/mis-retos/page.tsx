'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

/** Tipos base */
type ChallengeRow = {
  id: string;
  code: string;
  owner_id: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  cover_url?: string | null;
};

type MemberIdRow = { challenge_id: string };
type MemberRow = { challenge_id: string; user_id: string };

type ScoreRow = {
  challenge_id: string;
  user_id: string;
  score: number;
  rank_position: number;
};

/** =========================
 *  Helpers UI
 *  ========================= */
function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}

/** Progreso simple por fechas (placeholder visual) */
function progressByDates(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return 0;
  const now = Date.now();
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Sanitiza URL remota */
function safeUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    return url.href;
  } catch {
    return undefined;
  }
}

export default function MisRetosPage() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false); // evita mostrar "Inicia sesión" mientras resolvemos

  // Arranque + suscripción de auth para reaccionar instantáneo
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setUserId(data.session?.user?.id ?? undefined);
      setAuthReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUserId(session?.user?.id ?? undefined);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const [list, setList] = useState<
    (ChallengeRow & { members_count: number; my_score?: number; my_rank?: number })[]
  >([]);

  useEffect(() => {
    if (!userId) { setList([]); return; }
    (async () => {
      // 1) Retos en los que participo
      const { data: mems, error: eMems } = await supabase
        .from('challenge_members')
        .select('challenge_id')
        .eq('user_id', userId)
        .returns<MemberIdRow[]>();
      if (eMems) { console.error(eMems); setList([]); return; }

      const ids = (mems ?? []).map((m) => m.challenge_id);
      if (!ids.length) { setList([]); return; }

      // 2) Datos de retos
      const { data: challenges, error: eCh } = await supabase
        .from('challenges')
        .select('id, code, owner_id, title, start, end, cover_url')
        .in('id', ids)
        .order('start', { ascending: false })
        .returns<ChallengeRow[]>();
      if (eCh) { console.error(eCh); setList([]); return; }

      // 3) Contar miembros
      const { data: members, error: eMembers } = await supabase
        .from('challenge_members')
        .select('challenge_id, user_id')
        .in('challenge_id', ids)
        .returns<MemberRow[]>();
      if (eMembers) { console.error(eMembers); }

      const counts: Record<string, number> = {};
      (members ?? []).forEach((m) => {
        counts[m.challenge_id] = (counts[m.challenge_id] ?? 0) + 1;
      });

      // 4) (Opcional) puntuación/ranking
      let scoreMap: Record<string, { score: number; rank: number }> = {};
      try {
        const { data: scores } = await supabase
          .from('challenge_member_scores')
          .select('challenge_id, user_id, score, rank_position')
          .eq('user_id', userId)
          .in('challenge_id', ids)
          .returns<ScoreRow[]>();
        (scores ?? []).forEach(s => {
          scoreMap[s.challenge_id] = { score: s.score, rank: s.rank_position };
        });
      } catch {
        /* vista opcional */
      }

      setList((challenges ?? []).map((c) => ({
        ...c,
        members_count: counts[c.id] ?? 1,
        my_score: scoreMap[c.id]?.score,
        my_rank: scoreMap[c.id]?.rank,
      })));
    })();
  }, [userId]);

  // ===== Render =====

  // Skeletons mientras resolvemos la sesión
  if (!authReady) {
    return (
      <main className="container mx-auto px-4 py-4 space-y-4 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="page-title">Retos con amigos</h2>
          <span className="inline-block h-9 w-20 rounded-full bg-neutral-100 border" style={{ borderColor: 'var(--line)' }} />
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="container mx-auto px-4 py-4 text-sm space-y-4 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="page-title">Retos con amigos</h2>
          <Link href="/amigos/retos" className="btn secondary">Volver</Link>
        </div>
        <section className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'var(--line)' }}>
          <p className="text-xs text-neutral-500">
            Inicia sesión para ver tus retos.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-4 space-y-4 bg-white">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Retos con amigos</h2>
        <Link href="/amigos/retos" className="btn secondary">Volver</Link>
      </div>

      {!list.length ? (
        <section className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'var(--line)' }}>
          <p className="text-sm text-neutral-500">
            Aún no tienes retos. Crea uno o únete con un código.
          </p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {list.map((ch) => (
            <li key={ch.id}>
              <Link
                href={`/amigos/retos/${ch.id}`}
                className="block overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-black"
              >
                {/* Card blanca, limpia */}
                <div
                  className="relative rounded-2xl border bg-white shadow-sm"
                  style={{ borderColor: 'var(--line)' }}
                >
                  {/* Imagen de portada */}
                  <div className="relative h-44 w-full overflow-hidden rounded-t-2xl">
                    {safeUrl(ch.cover_url) ? (
                      <Image
                        src={safeUrl(ch.cover_url)!}
                        alt={ch.title}
                        fill
                        className="object-cover"
                        sizes="100vw"
                        priority={false}
                        unoptimized
                        onError={(e) => {
                          const el = (e.target as HTMLImageElement)?.parentElement;
                          if (el) el.innerHTML = '<div class="absolute inset-0 bg-neutral-200"></div>';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-white/95 border" style={{ borderColor: 'var(--line)' }}>
                        Reto con amigos
                      </span>
                    </div>
                    <div className="absolute right-3 top-3 text-[11px] text-white/90">
                      {fmtDate(ch.start)} — {fmtDate(ch.end)}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-white text-[16px] font-semibold drop-shadow-sm line-clamp-2">
                        {ch.title}
                      </h3>
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="p-4">
                    <ProgressBar percent={progressByDates(ch.start, ch.end)} />

                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <Metric label="Particip." titleLabel="Participantes" value={String(ch.members_count)} />
                      <Metric label="Puntuación" value={typeof ch.my_score === 'number' ? String(ch.my_score) : '—'} />
                      <Metric label="Ranking" value={typeof ch.my_rank === 'number' ? `#${ch.my_rank}` : '—'} />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-[12px] text-neutral-500">
                        Código: <b className="text-neutral-700">{ch.code}</b>
                      </div>
                      <ShareButton title={ch.title} code={ch.code} challengeId={ch.id} />
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** ====== Subcomponentes ====== */

function ProgressBar({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
      <div
        className="h-2 rounded-full"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #16a34a, #22c55e)',
          transition: 'width .35s ease',
        }}
        aria-label={`Progreso ${pct}%`}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  titleLabel,
}: {
  label: string;
  value: string;
  titleLabel?: string;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-2 bg-white"
      title={titleLabel || label}
      aria-label={titleLabel || label}
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-base font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

/** ===== Skeleton ===== */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-white shadow-sm" style={{ borderColor: 'var(--line)' }}>
      <div className="h-44 w-full rounded-t-2xl bg-neutral-200 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-2 w-full bg-neutral-200 rounded-full animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-12 bg-neutral-100 rounded-xl border animate-pulse" style={{ borderColor: 'var(--line)' }} />
          <div className="h-12 bg-neutral-100 rounded-xl border animate-pulse" style={{ borderColor: 'var(--line)' }} />
          <div className="h-12 bg-neutral-100 rounded-xl border animate-pulse" style={{ borderColor: 'var(--line)' }} />
        </div>
        <div className="h-4 w-40 bg-neutral-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

/** ===== Botón Compartir / Copiar ===== */
function ShareButton({
  title,
  code,
  challengeId,
}: {
  title: string;
  code: string;
  challengeId: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const msg =
    `Únete al reto ${title}. ` +
    `Descarga la app en https://akira-psi.vercel.app ` +
    `y ve a Comunidad > Retos > Unirse a reto. ` +
    `Código: ${code}`;

  async function share(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Reto: ${title}`,
          text: msg,
          url: `https://akira-psi.vercel.app/amigos/retos/${challengeId}`,
        });
        return;
      }
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      try {
        await navigator.clipboard.writeText(msg);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="text-[12px] px-3 py-1.5 rounded-full border bg-white hover:bg-neutral-50 active:bg-neutral-100 transition"
      style={{ borderColor: 'var(--line)' }}
      aria-label="Compartir reto"
    >
      {copied ? 'Copiado' : 'Compartir'}
    </button>
  );
}
