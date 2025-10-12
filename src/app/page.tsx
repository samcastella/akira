'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useUserProfile } from '@/lib/user';
import { useState } from 'react';

/* ========= Helpers saludo/avatar ========= */
function useDisplayUser() {
  const user = useUserProfile();
  const name =
    (user?.nombre && user.nombre.trim()) ||
    (user?.username && user.username.trim()) ||
    undefined;

  const displayName = name ? name : 'usuari@';
  const avatarUrl = user?.foto || undefined;
  return { displayName, avatarUrl };
}

/* ========= Top bar ========= */
function HomeTopBar() {
  const { displayName, avatarUrl } = useDisplayUser();
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className="h-12 bg-white flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden bg-neutral-100 aspect-square [clip-path:circle()]">
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
            <div className="h-full w-full grid place-items-center text-[12px] text-neutral-500">
              🙂
            </div>
          )}
        </div>
        <span className="text-sm font-medium">Hola {displayName}</span>
      </div>

      <Link
        href="/mizona/perfil"
        className="p-1 rounded hover:bg-black/5 transition"
        aria-label="Abrir perfil"
      >
        <Settings size={18} />
      </Link>
    </div>
  );
}

/* ========= Hero (igual) ========= */
function SanSilvestreHero() {
  return (
    <section className="mt-3">
      <div className="relative w-full">
        <video
          className="block w-full h-auto object-cover object-center"
          src="/videos/san-silvestre.mp4"
          poster="/images/programs/san-silvestre.png"
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
        </div>
        <Link
          href="/programas/sansilvestre"
          className="shrink-0 inline-flex items-center rounded-full bg-black text-white px-4 py-2 text-sm font-semibold transition active:scale-95 hover:opacity-90"
        >
          Unirse
        </Link>
      </div>
    </section>
  );
}

/* ========= Card programa: CTA agrupada con texto y margen inferior ========= */
function ProgramCard({
  title,
  days,
  href,
  img,
}: {
  title: string;
  days: number;
  href: string;
  img: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="relative w-full aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={title} className="block h-full w-full object-cover object-center" />

        {/* overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/60" />

        {/* zona inferior: duración + título + CTA juntos */}
        <div className="absolute inset-x-0 bottom-0 p-4 pb-6 z-10">
          <div className="text-white">
            <div className="text-[12px] opacity-90">Duración: {days} días</div>
            <div className="mt-0.5 text-2xl sm:text-3xl font-black leading-tight tracking-[-0.02em]">
              {title}
            </div>

            {/* CTA agrupada (texto negro explícito) */}
            <div className="mt-3">
              <span className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow transition active:scale-95 text-black">
                <span>Ver programa</span>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" fill="black" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ========= Página ========= */
export default function HomePage() {
  return (
    <main className="pb-4">
      <div className="safe-top" />
      <HomeTopBar />
      <SanSilvestreHero />

      <section className="mt-0 space-y-0">
        <ProgramCard
          title="Aprende a controlar la tecnología"
          days={30}
          href="/programas/detox-tecnologico"
          img="/images/programs/controla-tecnologia.png"
        />
        <ProgramCard
          title="Club de las 5 am"
          days={30}
          href="/programas/club-5am"
          img="/meditation.jpg"
        />
      </section>

      <section className="mt-6 px-4 text-center">
        <h2 className="text-xl font-extrabold leading-tight tracking-[-0.01em]">
          ¿Listo para diseñar tu mejor versión?
          <br />
          Elige un programa y empieza hoy.
        </h2>
        <Link
          href="/programas"
          className="mt-4 inline-block rounded-full px-6 py-3 text-sm font-semibold bg-black text-white transition active:scale-95 hover:opacity-90"
        >
          Ver todos los programas
        </Link>
      </section>
    </main>
  );
}
