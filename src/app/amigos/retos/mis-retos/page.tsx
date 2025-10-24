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
  cover_url?: string | null; // si guardaste portada en metadata
};

type MemberIdRow = { challenge_id: string };
type MemberRow = { challenge_id: string; user_id: string };

/** (Opcional) si existe una vista o función con puntuaciones/ranking */
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

/** Progreso simple por fechas (inspiración visual, sustituible por checks reales) */
function progressByDates(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return 0;
  const now = Date.now();
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  const pct = ((now - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, pct));
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

/** Color de fondo del bloque (puedes ajustar a tu paleta) */
const BLOCK_BG = 'linear-gradient(135deg, #111 0%, #2a2a2a 100%)';

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

  const [list, setList] = useState<
    (ChallengeRow & {
      members_count: number;
      my_score?: number;
      my_rank?: number;
    })[]
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

      // 2) Datos de los retos (añadimos cover_url si existe en la tabla)
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
      (members ?? []).forEach((m) => { counts[m.challenge_id] = (counts[m.challenge_id] ?? 0) + 1; });

      // 4) (Opcional) puntuación/ranking: intenta leer de una vista si existe
      let scoreMap: Record<string, { score: number; rank: number }> = {};
      try {
        const { data: scores } = await supabase
          .from('challenge_member_scores') // ⚠️ si no existe, se ignora
          .select('challenge_id, user_id, score, rank_position')
          .eq('user_id', userId)
          .in('challenge_id', ids)
          .returns<ScoreRow[]>();
        (scores ?? []).forEach(s => {
          scoreMap[s.challenge_id] = { score: s.score, rank: s.rank_position };
        });
      } catch {
        // vista no existe — seguimos sin romper
      }

      setList((challenges ?? []).map((c) => ({
        ...c,
        members_count: counts[c.id] ?? 1,
        my_score: scoreMap[c.id]?.score,
        my_rank: scoreMap[c.id]?.rank,
      })));
    })();
  }, [userId]);

  if (!userId) {
    return (
      <main className="container mx-auto px-4 py-4 text-sm space-y-4">
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
    <main className="container mx-auto px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Retos con amigos</h2>
        <Link href="/amigos/retos" className="btn secondary">Volver</Link>
      </div>

      {!list.length ? (
        <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
          <p className="text-xs muted">Aún no tienes retos. Crea uno o únete con un código.</p>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-4">
          {list.map((ch) => (
            <li key={ch.id}>
              <Link
                href={`/amigos/retos/${ch.id}`}
                className="block overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-black"
              >
                {/* Card */}
                <div
                  className="relative rounded-2xl border"
                  style={{ borderColor: 'var(--line)', background: BLOCK_BG }}
                >
                  {/* Imagen de portada (opcional) */}
                  <div className="relative h-40 w-full overflow-hidden rounded-t-2xl">
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
                          if (el) el.innerHTML = '<div class="absolute inset-0 bg-black/30"></div>';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-black/30" />
                    )}
                    {/* Gradiente para legibilidad */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    {/* Etiqueta “Reto con amigos” */}
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-white/90">
                        Reto con amigos
                      </span>
                    </div>
                    {/* Fechas arriba derecha */}
                    <div className="absolute right-3 top-3 text-[11px] text-white/90">
                      {fmtDate(ch.start)} — {fmtDate(ch.end)}
                    </div>
                    {/* Título sobre imagen, bottom */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-white text-[15px] font-semibold drop-shadow-sm line-clamp-2">
                        {ch.title}
                      </h3>
                    </div>
                  </div>

                  {/* Contenido bajo la imagen */}
                  <div className="p-3 sm:p-4">
                    {/* Barra de progreso (sustituible por progreso real de checks) */}
                    <ProgressBar percent={progressByDates(ch.start, ch.end)} />

                    {/* Métricas dentro del bloque */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Metric label="Participantes" value={String(ch.members_count)} />
                      <Metric label="Puntuación" value={typeof ch.my_score === 'number' ? String(ch.my_score) : '—'} />
                      <Metric label="Ranking" value={typeof ch.my_rank === 'number' ? `#${ch.my_rank}` : '—'} />
                    </div>

                    {/* Código + Compartir */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-white/80">
                        Código: <b>{ch.code}</b>
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
    <div className="w-full rounded-full h-2 bg-[var(--line)] overflow-hidden">
      <div
        className="h-2 rounded-full"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #16a34a, #22c55e)', // verde agradable
          transition: 'width .4s ease',
        }}
        aria-label={`Progreso ${pct}%`}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border px-2 py-2 bg-white"
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-900">{value}</div>
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
    // Evita que el click dispare la navegación del <Link> padre
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
