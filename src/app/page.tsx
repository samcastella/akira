'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useUserProfile } from '@/lib/user';
import { useEffect, useState } from 'react';

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

/* ========= Tarjeta de programa (todo dentro de la imagen, 1:1) ========= */
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
        {/* Imagen cuadrada full-bleed */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={title}
          className="block h-full w-full object-cover object-center"
          draggable={false}
        />

        {/* Overlay con gradiente */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/60" />

        {/* Zona inferior con duración, título y CTA todo junto */}
        <div className="absolute inset-x-0 bottom-0 p-4 z-10">
          <div className="text-white">
            <div className="text-[12px] opacity-90">Duración: {days} días</div>
            <div className="mt-0.5 text-2xl sm:text-3xl font-black leading-tight tracking-[-0.02em]">
              {title}
            </div>

            {/* CTA debajo del título, agrupada */}
            <div className="mt-3">
              <span className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow transition active:scale-95">
                <span>Ver programa</span>
                {/* Triángulo negro (sin círculo) alineado a la derecha del texto */}
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

/* ========= Splash en carga (React) =========
   Nota: este splash ya no es responsable de "instante 0".
   Lo dejamos como refuerzo por si la página tarda en hidratar/renderizar partes. */
function SplashOverlay() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const done = () => setShow(false);
    if (document.readyState === 'complete') {
      const t = requestAnimationFrame(() => done());
      return () => cancelAnimationFrame(t);
    }
    window.addEventListener('load', done);
    const fallback = setTimeout(done, 2000);
    return () => {
      window.removeEventListener('load', done);
      clearTimeout(fallback);
    };
  }, []);
  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-400 ${
        show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        backgroundColor: '#000',
        backgroundImage: 'url(/splash.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

/* ========= Página ========= */
export default function HomePage() {
  return (
    <main className="pb-4">
      {/* Splash de refuerzo durante carga (el instantáneo lo ponemos en layout) */}
      <SplashOverlay />

      {/* Safe area top para evitar solape con la hora del iPhone */}
      <div className="safe-top" />

      {/* Top bar */}
      <HomeTopBar />

      {/* Hero (vídeo + bloque blanco) */}
      <SanSilvestreHero />

      {/* Programas */}
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
