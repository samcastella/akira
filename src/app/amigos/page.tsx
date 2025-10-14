// src/app/amigos/page.tsx
'use client';

import Link from 'next/link';
import { Camera } from 'lucide-react';

export default function ComunidadHome() {
  const inscritosMock = 284; // placeholder
  const hasActiveChallenges = false; // ← cámbialo cuando conectemos a datos reales
  const videoSrc = '/videos/san-silvestre.mp4';
  const videoPoster = '/images/community/san-silvestre.jpg';

  return (
    <main className="space-y-8">
      {/* ===== HERO vídeo full-bleed (a sangre) ===== */}
      <section className="overflow-x-hidden">
        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
          <video
            className="block w-screen h-[220px] sm:h-[300px] object-cover"
            src={videoSrc}
            poster={videoPoster}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>

        {/* Contenido del reto debajo del vídeo (dentro del container) */}
        <div className="pt-4">
          <div className="text-[11px] tracking-wide uppercase text-neutral-500">
            Reto de la comunidad
          </div>
          <h1 className="text-2xl font-extrabold leading-tight mt-1">
            Corre 10 km en la San Silvestre
          </h1>
          <div className="mt-2 text-sm text-neutral-600">
            {inscritosMock} personas ya se han unido
          </div>
          <div className="mt-3">
            <Link href="/amigos/retos/unirse" className="btn">Unirse</Link>
          </div>
        </div>
      </section>

      {/* ===== Tus retos activos ===== */}
      <section aria-labelledby="titulo-retos">
        <div className="flex items-baseline justify-between">
          <h2 id="titulo-retos" className="text-xl font-semibold">Tus retos activos</h2>
          <Link href="/amigos/retos/mis-retos" className="text-sm underline">Ver todos</Link>
        </div>
        <p className="text-xs muted mt-1">
          {hasActiveChallenges
            ? 'Accede a los retos en los que participas con amigos o la comunidad.'
            : 'No tienes ningún reto actualmente activo'}
        </p>
      </section>

      {/* ===== Ranking ===== */}
      <section aria-labelledby="titulo-ranking" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="titulo-ranking" className="text-xl font-semibold">Ranking</h2>
          <Link href="/amigos/ranking" className="text-sm underline">Ver ranking</Link>
        </div>

        {/* Tarjeta dorada con icono, nombre y puesto */}
        <div
          className="rounded-2xl p-3 flex items-center justify-between"
          style={{
            background:
              'linear-gradient(180deg, #F8E68A 0%, #F2D767 100%)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-white/70 flex items-center justify-center shrink-0">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Samuel Castellá</div>
              <div className="text-xs opacity-80 truncate">Mes actual</div>
            </div>
          </div>
          <div className="text-base font-bold tabular-nums shrink-0">128º</div>
        </div>
      </section>
    </main>
  );
}
