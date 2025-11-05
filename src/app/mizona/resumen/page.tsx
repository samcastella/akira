// src/app/mizona/resumen/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import TodayWheel from '@/components/mizona/TodayWheel';
import CalendarLite from '@/components/mizona/CalendarLite';
import StreakCard from '@/components/mizona/StreakCard';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import { useUserProfile } from '@/lib/user';

export default function MiActividadResumen() {
  const { totalGoal, totalDone } = useTodayActivity();
  const pct = totalGoal ? Math.round((totalDone / totalGoal) * 100) : 0;

  const user = useUserProfile();
  const name =
    (user?.nombre && user.nombre.trim()) ||
    (user?.username && user.username.trim()) ||
    'Tú';

  return (
    <div className="py-6 space-y-8">
      {/* Rueda de “CHECKS PARA HOY” */}
      <section>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Checks para hoy</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Completa tus retos de hoy (programas, retos con amigos y hábitos personalizados).
        </p>
        <TodayWheel value={pct} label={`${totalDone}/${totalGoal}`} />
      </section>

      {/* Racha (verde + confeti) */}
      <StreakCard />

      {/* Tarjeta perfil (avatar debe cubrir el círculo) */}
      <section className="rounded-2xl border border-neutral-200 p-4 flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-neutral-100">
          <Image
            src={user?.foto || '/images/avatars/default.png'}
            alt="Tu perfil"
            fill
            className="object-cover"
            sizes="64px"
            priority
          />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-neutral-900">{name}</div>
          <div className="text-sm text-neutral-600">Sigue así, ¡vas genial!</div>
        </div>
        <Link
          href="/mizona/perfil"
          className="text-sm font-medium px-3 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-50"
        >
          Editar
        </Link>
      </section>

      {/* Programas activos (imagen circular full-cover). Al terminar, desaparecen (se filtra) */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Programas activos</h3>
        <ActiveProgramsStrip />
      </section>

      {/* Calendario (flechas corregidas, no solapan) */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Calendario</h3>
        <p className="text-sm text-neutral-600 mb-3">Selecciona calendario</p>
        <CalendarLite />
      </section>

      {/* CTA Crear hábito */}
      <section className="rounded-2xl border border-dashed border-neutral-300 p-4">
        <h3 className="text-lg font-semibold">Crear hábito</h3>
        <p className="text-sm text-neutral-600">Crea tu propio hábito personalizado</p>
        <Link
          href="/mizona/crear-habito"
          className="inline-block mt-3 px-4 py-2 rounded-2xl bg-black text-white text-sm font-semibold active:scale-[0.98]"
        >
          Empezar
        </Link>
      </section>
    </div>
  );
}

/* ======= Helpers UI ======= */
import { loadActive, type LocalStore, type LocalProgram } from '@/lib/programsLocal';
import { useMemo } from 'react';

function ActiveProgramsStrip() {
  const activeMap = useMemo(() => loadActive(), []);
  const entries = Object.entries(activeMap)
    .filter(([, p]) => {
      const prog = p as any;
      // validamos que tenga fecha de inicio y que no esté marcado como completado
      const started = !!prog?.startedAt;
      const completed = !!prog?.completedAt;
      return started && !completed;
    })
    .slice(0, 12);

  if (!entries.length) {
    return <div className="text-sm text-neutral-600">No tienes programas activos.</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-12 pl-1">
      {entries.map(([slug]) => (
        <Link
          key={slug}
          href={`/programas/${slug}`}
          className="group inline-flex flex-col items-center gap-2"
        >
          <div className="relative w-20 h-20 rounded-full overflow-hidden ring-1 ring-neutral-200">
            <Image
              src={`/images/programs/${slug.replace('-30', '')}-hero.jpg`}
              alt={slug}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
          <span className="text-xs text-neutral-800 text-center max-w-[8rem] line-clamp-2 capitalize">
            {slug.replaceAll('-', ' ')}
          </span>
        </Link>
      ))}
    </div>
  );
}
