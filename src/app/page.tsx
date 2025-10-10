'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useUserProfile } from '@/lib/user';
import { useState } from 'react';

/* ========= Helpers saludo/avatar ========= */
function useDisplayUser() {
  const user = useUserProfile(); // reactivo
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
        <div className="h-9 w-9 rounded-full overflow-hidden bg-neutral-100">
          {avatarUrl && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-full w-full object-cover object-center"
              onError={() => setImgOk(false)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-[12px] text-neutral-500">
              🙂
            </div>
          )}
        </div>
        {/* sin coma después de Hola */}
        <span className="text-sm font-medium">Hola {displayName}</span>
      </div>

      <Link
        href="/mizona/perfil"
        className="p-1 rounded hover:bg-black/5"
        aria-label="Abrir perfil"
      >
        <Settings size={18} />
      </Link>
    </div>
  );
}

/* ========= Hero vídeo San Silvestre (full-bleed 4:5, sin bordes redondeados) ========= */
function SanSilvestreHero() {
  return (
    <section className="mt-3 -mx-4">
      <div className="relative w-full aspect-[4/5]">
        <video
          className="h-full w-full object-cover object-center"
          src="/videos/san-silvestre.mp4"
          poster="/images/programs/san-silvestre.png"
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
        />
        {/* Gradiente estilo Nike + título potente */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/60" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-white">
            <h1 className="text-2xl font-black leading-tight tracking-tight">
              Corre 10 km en la San Silvestre
            </h1>
            <p className="mt-1 text-sm/5 opacity-90">Duración: 60 días</p>
          </div>
        </div>
        {/* Botón pill blanco */}
        <Link
          href="/programas/sansilvestre"
          className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow"
        >
          <span>Ver programa</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

/* ========= Tarjeta de programa estilo Nike (4:5, full-bleed, sin bordes) ========= */
function ProgramCard({
  title,
  days,
  href,
  img,
  cta = 'Ver programa',
}: {
  title: string;
  days: number;
  href: string;
  img: string;
  cta?: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="relative w-full aspect-[4/5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={title} className="h-full w-full object-cover object-center" />

        {/* overlay + título grande */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/60" />
        <div className="absolute left-0 right-0 bottom-0 p-4">
          <div className="text-white">
            <div className="text-xl font-black leading-tight tracking-tight">
              {title}
            </div>
            <div className="mt-1 text-[13px] opacity-90">Duración: {days} días</div>
          </div>
        </div>

        {/* CTA pill blanco */}
        <div className="absolute left-4 bottom-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow">
            {cta}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ========= Página ========= */
export default function HomePage() {
  return (
    <main className="container" style={{ paddingBottom: 16 }}>
      {/* Top bar */}
      <HomeTopBar />

      {/* Hero 4:5 */}
      <SanSilvestreHero />

      {/* Programas destacados: full-bleed sin márgenes entre tarjetas */}
      <section className="mt-0 -mx-4 space-y-0">
        <ProgramCard
          title="Aprende a controlar la tecnología"
          days={30}
          href="/programas/detox-tecnologico"
          img="/images/programs/controla-tecnologia.png"
          cta="Empieza ahora"
        />

        <ProgramCard
          title="Club de las 5 am"
          days={30}
          href="/programas/club-5am"
          img="/meditation.jpg"
          cta="Únete al club"
        />
      </section>

      {/* CTA final adaptada a programas de hábitos */}
      <section className="mt-6 px-4 text-center">
        <h2 className="text-xl font-extrabold leading-tight">
          ¿Listo para diseñar tu mejor versión?
          <br />
          Elige un programa y empieza hoy.
        </h2>
        <Link
          href="/programas"
          className="mt-4 inline-block rounded-full px-6 py-3 text-sm font-semibold bg-black text-white"
        >
          Ver todos los programas
        </Link>
      </section>
    </main>
  );
}
