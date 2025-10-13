// src/app/amigos/page.tsx
'use client';

import Link from 'next/link';

export default function ComunidadHome() {
  const inscritosMock = 284; // placeholder

  return (
    <main className="space-y-6">
      {/* Reto comunidad */}
      <section className="overflow-hidden rounded-2xl bg-black text-white">
        <div
          aria-hidden
          className="h-40 w-full bg-center bg-cover"
          style={{ backgroundImage: 'url(/images/community/san-silvestre.jpg)' }}
        />
        <div className="p-4 bg-white text-black">
          <div className="text-[11px] tracking-wide uppercase text-neutral-500">Reto de la comunidad</div>
          <h2 className="text-2xl font-extrabold leading-tight mt-1">Corre 10 km en la San Silvestre</h2>
          <div className="mt-2 text-sm text-neutral-600">{inscritosMock} personas ya se han unido</div>
          <div className="mt-3">
            <button className="btn">Unirse</button>
          </div>
        </div>
      </section>

      {/* Tus retos activos */}
      <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Tus retos activos</h3>
          <Link href="/amigos/retos/mis-retos" className="text-sm underline">Ver todos</Link>
        </div>
        <p className="text-xs muted mt-1">Accede a los retos en los que participas con amigos o comunidad.</p>
      </section>

      {/* Ranking */}
      <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Tu ranking actual</h3>
          <Link href="/amigos/ranking" className="text-sm underline">Ver ranking</Link>
        </div>
        <p className="text-xs muted mt-1">Estás en el puesto <b>#128</b> este mes.</p>
      </section>
    </main>
  );
}
