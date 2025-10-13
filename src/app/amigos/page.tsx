// src/app/amigos/page.tsx
'use client';

import Link from 'next/link';

export default function ComunidadHome() {
  const inscritosMock = 284; // placeholder
  const videoSrc = '/videos/san-silvestre.mp4'; // servido desde /public
  const videoPoster = '/images/community/san-silvestre.jpg'; // opcional

  return (
    <main className="space-y-8">
      {/* ===== HERO video a ancho del contenido, sin márgenes laterales ===== */}
      <section className="-mx-4 overflow-x-hidden">
        <div className="overflow-hidden">
          <video
            className="block w-full h-[220px] sm:h-[300px] object-cover"
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

        {/* Contenido del reto debajo del vídeo */}
        <div className="px-4 py-4 bg-white">
          <div className="text-[11px] tracking-wide uppercase text-neutral-500">
            Reto de la comunidad
          </div>
          <h2 className="text-2xl font-extrabold leading-tight mt-1">
            Corre 10 km en la San Silvestre
          </h2>
          <div className="mt-2 text-sm text-neutral-600">
            {inscritosMock} personas ya se han unido
          </div>
          <div className="mt-3">
            <Link href="/amigos/retos/unirse" className="btn">Unirse</Link>
          </div>
        </div>
      </section>

      {/* ===== Tus retos activos ===== */}
      <section aria-labelledby="titulo-retos" className="space-y-2">
        <h2 id="titulo-retos" className="text-xl font-semibold">
          Tus retos activos
        </h2>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Resumen</h3>
            <Link href="/amigos/retos/mis-retos" className="text-sm underline">
              Ver todos
            </Link>
          </div>
          <p className="text-xs muted mt-1">
            Accede a los retos en los que participas con amigos o la comunidad.
          </p>
        </div>
      </section>

      {/* ===== Ranking ===== */}
      <section aria-labelledby="titulo-ranking" className="space-y-2">
        <h2 id="titulo-ranking" className="text-xl font-semibold">
          Ranking
        </h2>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Tu posición actual</h3>
            <Link href="/amigos/ranking" className="text-sm underline">
              Ver ranking
            </Link>
          </div>
          <p className="text-xs muted mt-1">
            Estás en el puesto <b>#128</b> este mes.
          </p>
        </div>
      </section>
    </main>
  );
}
