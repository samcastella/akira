// src/app/amigos/page.tsx
'use client';

import Link from 'next/link';
import { useUserProfile } from '@/lib/user';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ChevronRight } from 'lucide-react';

function useDisplayUser() {
  const user = useUserProfile();
  const name =
    (user?.nombre && user.nombre.trim()) ||
    (user?.username && user.username.trim()) ||
    undefined;

  const displayName = name ? name : 'usuari@';
  const firstSurname = useMemo(() => {
    const ap = (user?.apellido || '').trim();
    return ap ? ap.split(/\s+/)[0] : '';
  }, [user?.apellido]);

  const avatarUrl = user?.foto || undefined;
  return { displayName, firstSurname, avatarUrl };
}

// Banner 16:9 sin bordes ni márgenes internos
function ImageBanner({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block w-full h-auto aspect-[16/9] object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}

/* =========================
   Helpers de fechas/progreso
========================= */
function diffDays(aISO: string, bISO: string) {
  const a = new Date(aISO + 'T00:00:00');
  const b = new Date(bISO + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ===== Tipos de datos ===== */
type ChallengeCard = {
  id: string;
  title: string;
  cover_url: string | null;
  start: string; // ISO fecha
  end: string;   // ISO fecha
  totalDays: number;
  todayIdx: number; // día actual dentro del reto (clamp 1..totalDays)
};

export default function ComunidadHome() {
  const inscritosMock = 284;
  const videoSrc = '/videos/san-silvestre.mp4';
  const videoPoster = '/images/programs/san-silvestre.png';

  const { displayName, firstSurname, avatarUrl } = useDisplayUser();
  const [imgOk, setImgOk] = useState(true);

  // ===== Retos en los que participo (para "Tus retos activos")
  const [uid, setUid] = useState<string | null>(null);
  const [myChallenges, setMyChallenges] = useState<ChallengeCard[] | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!uid) { setMyChallenges([]); return; }
    let alive = true;
    (async () => {
      // ids de retos donde soy miembro
      const { data: memberRows, error: mErr } = await supabase
        .from('challenge_members')
        .select('challenge_id')
        .eq('user_id', uid);
      if (mErr) { console.error(mErr); if (alive) setMyChallenges([]); return; }
      const ids = (memberRows ?? []).map(r => r.challenge_id);
      if (!ids.length) { if (alive) setMyChallenges([]); return; }

      // datos base del reto
      const { data: chRows, error: cErr } = await supabase
        .from('challenges')
        .select('id, title, start, end, cover_url')
        .in('id', ids)
        .order('start', { ascending: false });
      if (cErr) { console.error(cErr); if (alive) setMyChallenges([]); return; }

      const tISO = todayISO();
      const cards: ChallengeCard[] = (chRows ?? []).map((c: any) => {
        const total = Math.max(1, diffDays(c.start, c.end) + 1);
        const idx = clamp(diffDays(c.start, tISO) + 1, 1, total);
        return {
          id: c.id,
          title: c.title,
          cover_url: c.cover_url ?? null,
          start: c.start,
          end: c.end,
          totalDays: total,
          todayIdx: idx,
        };
      });
      if (alive) setMyChallenges(cards);
    })();
    return () => { alive = false; };
  }, [uid]);

  const hasActiveChallenges = !!(myChallenges && myChallenges.length);

  return (
    <main className="pb-4">
      {/* ===== Hero (full-bleed como en Home) ===== */}
      <section className="mt-0">
        <div className="relative w-full">
          <video
            className="block w-full h-auto object-cover object-center"
            src={videoSrc}
            poster={videoPoster}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
          />
        </div>

        <div className="w-full bg-white py-3 px-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] uppercase tracking-wide text-neutral-600">
              Reto de la comunidad
            </div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight tracking-[-0.02em]">
              Corre 10 km en la San Silvestre
            </h1>
            <div className="mt-1 text-sm text-neutral-600">
              {inscritosMock} personas ya se han unido
            </div>
          </div>

          <Link
            href="/amigos/retos/unirse"
            className="shrink-0 inline-flex items-center rounded-full bg-black text-white px-4 py-2 text-sm font-semibold transition active:scale-95 hover:opacity-90"
          >
            Unirse
          </Link>
        </div>
      </section>

      {/* ===== Contenido ===== */}
      <div className="px-4 space-y-8">
        {/* --- Banner 1: amigos en reto (full-bleed) --- */}
        <section className="-mx-4 overflow-x-hidden">
          <ImageBanner
            src="/images/community/friends-challenge.jpg"
            alt="Amigos preparando un reto de hábitos juntos"
          />
        </section>

        {/* ---- Tus retos activos ---- */}
        <section aria-labelledby="titulo-retos" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="titulo-retos" className="text-xl font-semibold">
              Tus retos activos
            </h2>
            <Link href="/amigos/retos/mis-retos" className="text-sm underline">
              Ver todos
            </Link>
          </div>

          {!myChallenges
            ? <p className="text-xs muted">Cargando…</p>
            : !hasActiveChallenges
              ? <p className="text-xs muted">No tienes ningún reto actualmente activo</p>
              : (
                <ul className="space-y-4">
                  {myChallenges.map(card => (
                    <li key={card.id}>
                      <ChallengeCompactCard card={card} />
                    </li>
                  ))}
                </ul>
              )}
        </section>

        {/* --- Banner 2: rachas compartidas (full-bleed) --- */}
        <section className="-mx-4 overflow-x-hidden">
          <ImageBanner
            src="/images/community/group-streak.jpg"
            alt="Varios móviles mostrando rachas de hábitos completadas"
          />
        </section>

        {/* ---- Ranking ---- */}
        <section aria-labelledby="titulo-ranking" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="titulo-ranking" className="text-xl font-semibold">
              Ranking
            </h2>
            <Link href="/amigos/ranking" className="text-sm underline">
              Ver ranking
            </Link>
          </div>

          <RankingMe displayName={displayName} firstSurname={firstSurname} avatarUrl={avatarUrl} onImgFail={() => setImgOk(false)} imgOk={imgOk} />
        </section>
      </div>
    </main>
  );
}

/* ====== Subcomponentes UI ====== */

function ProgressLine({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
      <div
        className="h-3 rounded-full"
        style={{
          width: `${pct}%`,
          background: '#f4d24d', // amarillo suave tipo captura
          transition: 'width .35s ease',
        }}
        aria-label={`Progreso ${pct}%`}
      />
    </div>
  );
}

function ChallengeCompactCard({ card }: { card: ChallengeCard }) {
  const pct = Math.round((card.todayIdx / card.totalDays) * 100);

  return (
    <Link
      href={`/amigos/retos/${card.id}`}
      className="block rounded-[28px] bg-white px-4 py-4 shadow-sm border hover:shadow transition focus:outline-none focus:ring-2 focus:ring-black"
      style={{ borderColor: 'var(--line)' }}
    >
      <div className="flex items-center gap-4">
        {/* avatar/portada circular */}
        <div className="h-16 w-16 rounded-full overflow-hidden bg-neutral-100 shrink-0 border" style={{ borderColor: 'var(--line)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {card.cover_url
            ? <img src={card.cover_url} alt="" className="h-full w-full object-cover" />
            : <div className="h-full w-full" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-neutral-500">Reto</div>
          <div className="text-[18px] font-semibold leading-snug line-clamp-2">{card.title}</div>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              <ProgressLine percent={pct} />
            </div>
            <div className="w-16 text-right text-[15px] font-semibold tabular-nums">
              {card.todayIdx}/{card.totalDays}
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-400 shrink-0" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function RankingMe({
  displayName,
  firstSurname,
  avatarUrl,
  imgOk,
  onImgFail,
}: {
  displayName: string;
  firstSurname: string;
  avatarUrl?: string;
  imgOk: boolean;
  onImgFail: () => void;
}) {
  return (
    <div
      className="rounded-[28px] p-3 pl-3 pr-4 flex items-center justify-between shadow-sm"
      style={{ background: 'linear-gradient(180deg, #F8E68A 0%, #F2D767 100%)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-neutral-100 aspect-square [clip-path:circle()]">
          {avatarUrl && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Avatar"
              className="block h-full w-full object-cover object-center align-middle"
              onError={onImgFail}
              draggable={false}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-[12px] text-neutral-600">
              🙂
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {displayName} {firstSurname}
          </div>
          <div className="text-xs opacity-80 truncate">Mes actual</div>
        </div>
      </div>

      <div className="text-base font-bold tabular-nums shrink-0">128º</div>
    </div>
  );
}
