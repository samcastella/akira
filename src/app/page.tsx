// src/app/page.tsx
'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useUserProfile } from '@/lib/user';

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

  return (
    <div className="h-12 bg-white border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full overflow-hidden border bg-neutral-100">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-[10px] text-neutral-500">
              🙂
            </div>
          )}
        </div>
        <span className="text-sm font-medium">Hola, {displayName}</span>
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

/* ========= Hero vídeo San Silvestre (1:1) ========= */
function SanSilvestreHero() {
  return (
    <div className="relative w-full max-w-[720px] mx-auto aspect-square overflow-hidden rounded-2xl border mt-4">
      <video
        className="h-full w-full object-cover"
        // ➜ coloca aquí tu vídeo de 5s:
        src="/videos/sansilvestre.mp4"
        // ➜ usamos tu imagen como poster:
        poster="/images/programs/san-silvestre.png"
        muted
        playsInline
        autoPlay
        loop
        preload="metadata"
      />
      {/* Texto incrustado abajo */}
      <div className="absolute inset-x-0 bottom-0 p-4 pointer-events-none">
        <div className="rounded-xl bg-black/50 backdrop-blur px-4 py-3 text-white">
          <div className="text-base font-semibold">Corre 10 km en la San Silvestre</div>
          <div className="mt-0.5 text-sm/5 opacity-90">Duración: 60 días</div>
        </div>
      </div>
      {/* Botón clickable independiente */}
      <Link
        href="/programas/sansilvestre"
        className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow"
      >
        <span>Ver programa</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </Link>
    </div>
  );
}

/* ========= Tarjeta de programa ========= */
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
    <Link href={href} className="block rounded-2xl border overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={title} className="w-full aspect-[16/9] object-cover" />
      <div className="p-4">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-neutral-600 mt-1">Duración: {days} días</div>
        <div className="mt-3 inline-block text-sm font-medium underline">Ver programa</div>
      </div>
    </Link>
  );
}

/* ========= Página ========= */
export default function HomePage() {
  return (
    <main className="container" style={{ paddingBottom: 16 }}>
      {/* Top bar: avatar + hola + rueda */}
      <HomeTopBar />

      {/* Hero de vídeo San Silvestre */}
      <SanSilvestreHero />

      {/* Programas destacados (Detox y Club 5am) */}
      <div className="mt-5 grid gap-4">
        <ProgramCard
          title="Aprende a controlar la tecnología"
          days={30}
          href="/programas/detox-tecnologico"
          img="/images/programs/controla-tecnología.png"
        />

        <ProgramCard
          title="Club de las 5 am"
          days={30}
          href="/programas/club-5am"
          // de momento usamos meditation.jpg como acordamos
          img="/images/meditation.jpg"
        />
      </div>

      {/* CTA final para ver todos */}
      <div className="mt-6 rounded-2xl border p-4 text-center">
        <p className="text-sm text-neutral-600">
          ¿Te gustaría ver todos nuestros programas?
        </p>
        <Link
          href="/programas"
          className="mt-3 inline-block rounded-full border px-4 py-2 text-sm font-medium"
        >
          Ver todos los programas
        </Link>
      </div>
    </main>
  );
}
