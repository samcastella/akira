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
        <div className="h-9 w-9 rounded-full overflow-hidden bg-neutral-100 relative">
          {avatarUrl && imgOk ? (
            // usamos <img> + onError para evitar el "interrogante" si falla la carga
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
              onError={() => setImgOk(false)}
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

/* ========= Hero vídeo San Silvestre (full-bleed) ========= */
function SanSilvestreHero() {
  return (
    <section className="mt-4 -mx-4">
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl">
        <video
          className="h-full w-full object-cover"
          // ✅ en Next, los assets de /public se referencian sin "public"
          src="/videos/san-silvestre.mp4"
          poster="/images/programs/san-silvestre.png"
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
        />
        {/* Texto incrustado abajo */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="rounded-xl bg-black/55 backdrop-blur px-4 py-3 text-white">
            <div className="text-base font-semibold">Corre 10 km en la San Silvestre</div>
            <div className="mt-0.5 text-sm/5 opacity-90">Duración: 60 días</div>
          </div>
        </div>
        {/* Botón clickable independiente */}
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

/* ========= Tarjeta de programa estilo “inspo” ========= */
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
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl">
        {/* Imagen full-bleed */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={title} className="w-full h-full object-cover" />

        {/* Texto + meta en la parte baja */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="rounded-xl bg-black/55 backdrop-blur px-4 py-3 text-white">
            <div className="text-base font-extrabold leading-tight">{title}</div>
            <div className="mt-0.5 text-[13px] opacity-90">Duración: {days} días</div>
          </div>
        </div>

        {/* Botón pill blanco, como el inspo */}
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

      {/* Hero de vídeo San Silvestre */}
      <SanSilvestreHero />

      {/* Programas destacados (full-bleed, sin márgenes entre ellos) */}
      <section className="mt-4 -mx-4 space-y-4">
        <div className="px-4">
          <ProgramCard
            title="Aprende a controlar la tecnología"
            days={30}
            href="/programas/detox-tecnologico"
            // ✅ sin "public" y sin tilde en el nombre de archivo
            img="/images/programs/controla-tecnologia.png"
            cta="Empieza ahora"
          />
        </div>

        <div className="px-4">
          <ProgramCard
            title="Club de las 5 am"
            days={30}
            href="/programas/club-5am"
            img="/meditation.jpg"
            cta="Únete al club"
          />
        </div>
      </section>

      {/* CTA final (copy adaptado a programas de hábitos) */}
      <section className="mt-8 px-4 text-center">
        <h2 className="text-xl font-extrabold leading-tight">
          ¿Listo para construir hábitos que se quedan?
          <br />
          Explora todos nuestros programas.
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
