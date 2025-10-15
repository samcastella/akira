// src/app/amigos/page.tsx
'use client';

import Link from 'next/link';
import { useUserProfile } from '@/lib/user';
import { useMemo, useState } from 'react';

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

// Banner de imagen reutilizable (16:9, bordes redondeados)
function ImageBanner({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block w-full aspect-[16/9] object-cover rounded-2xl shadow-[0_1px_10px_rgba(0,0,0,0.05)]"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}

export default function ComunidadHome() {
  const inscritosMock = 284;                 // mock
  const hasActiveChallenges = false;         // conectar a supabase después
  const videoSrc = '/videos/san-silvestre.mp4';
  const videoPoster = '/images/programs/san-silvestre.png';

  const { displayName, firstSurname, avatarUrl } = useDisplayUser();
  const [imgOk, setImgOk] = useState(true);

  return (
    <main className="pb-4">
      {/* ===== Hero (mismo patrón que Home, sin márgenes ni scroll) ===== */}
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

      {/* ===== Contenido (padding lateral) ===== */}
      <div className="px-4 space-y-8">
        {/* --- Banner IDEA 2: streaks / rachas compartidas --- */}
        <ImageBanner
          src="/images/community/group-streak.jpg"
          alt="Varios móviles mostrando rachas de hábitos completadas"
        />

        {/* ---- Tus retos activos ---- */}
        <section aria-labelledby="titulo-retos">
          <div className="flex items-baseline justify-between">
            <h2 id="titulo-retos" className="text-xl font-semibold">
              Tus retos activos
            </h2>
            <Link href="/amigos/retos/mis-retos" className="text-sm underline">
              Ver todos
            </Link>
          </div>
          <p className="text-xs muted mt-1">
            {hasActiveChallenges
              ? 'Accede a los retos en los que participas con amigos o la comunidad.'
              : 'No tienes ningún reto actualmente activo'}
          </p>
        </section>

        {/* --- Banner IDEA 1: reto social entre amigos --- */}
        <ImageBanner
          src="/images/community/friends-challenge.jpg"
          alt="Amigos preparando un reto de hábitos juntos"
        />

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

          {/* Tarjeta dorada: bordes muy redondeados + avatar como en Home */}
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
                    onError={() => setImgOk(false)}
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
        </section>
      </div>
    </main>
  );
}
