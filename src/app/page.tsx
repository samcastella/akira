// src/app/page.tsx
'use client';

import Link from 'next/link';
import { Settings, Play } from 'lucide-react';
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
        {/* Avatar perfectamente circular y cubierto */}
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

/* ========= Hero vídeo (alto nativo) + bloque blanco inferior ========= */
function SanSilvestreHero() {
  return (
    <section className="mt-3">
      {/* Vídeo full width, alto nativo */}
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

      {/* Bloque blanco con texto y botón a la derecha */}
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

/* ========= Tarjeta de programa (1:1, imagen + bloque info blanco debajo) ========= */
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
    <div className="w-full">
      <Link href={href} className="block">
        {/* Imagen cuadrada full-bleed */}
        <div className="relative w-full aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={title}
            className="block h-full w-full object-cover object-center"
            draggable={false}
          />
        </div>
      </Link>

      {/* Bloque informativo blanco */}
      <div className="bg-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] text-neutral-600">
            Duración: {days} días
          </div>
          <div className="text-2xl sm:text-3xl font-black leading-tight tracking-[-0.02em]">
            {title}
          </div>
        </div>

        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 text-sm font-semibold transition active:scale-95 hover:opacity-90"
        >
          <Play size={16} />
          Ver programa
        </Link>
      </div>
    </div>
  );
}

/* ========= Página ========= */
export default function HomePage() {
  return (
    // Full-bleed real: sin "container", sin padding lateral
    <main className="pb-4">
      {/* Top bar */}
      <HomeTopBar />

      {/* Hero (vídeo + bloque blanco) */}
      <SanSilvestreHero />

      {/* Programa 1 */}
      <section className="mt-0">
        <ProgramCard
          title="Aprende a controlar la tecnología"
          days={30}
          href="/programas/detox-tecnologico"
          img="/images/programs/controla-tecnologia.png"
        />
      </section>

      {/* Frase motivadora entre programas (negro, blanco) */}
      <section className="bg-black px-4 py-6">
        <p className="text-center text-[17px] italic font-semibold text-white">
          “No cambies lo que haces; empieza a cambiar quién eres.”
        </p>
      </section>

      {/* Programa 2 */}
      <section className="mt-0">
        <ProgramCard
          title="Club de las 5 am"
          days={30}
          href="/programas/club-5am"
          img="/meditation.jpg"
        />
      </section>

      {/* CTA final */}
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
