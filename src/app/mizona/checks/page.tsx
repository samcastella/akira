// src/app/mizona/checks/page.tsx
'use client';

import React, { useMemo, useState, useCallback } from 'react';
import CreateHabitBar from '@/components/habits/CreateHabitBar';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';

/* === Helpers para leer detalles desde el JSON del programa === */
function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}

function findTaskDetail(slug: string, day: number, taskId: string): string | undefined {
  const json = tryGetProgramJson(slug);
  if (!json?.days) return undefined;
  const dayDef = json.days.find((d: any) => d.day === day) ?? json.days[day - 1];
  const t = (dayDef?.tasks ?? []).find((x: any, i: number) => (x.id ?? `task_${i}`) === taskId);
  return t?.detail ?? t?.description ?? undefined;
}

/* === Modal ligero con soporte **negritas** === */
function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) parts.push(text.slice(i, m.index));
    parts.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>);
    i = m.index + m[0].length;
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}

function InfoModal({
  open,
  title,
  detail,
  onClose,
}: {
  open: boolean;
  title: string;
  detail?: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet / Modal */}
      <div className="relative z-[2001] w-full sm:max-w-md sm:rounded-2xl bg-white border border-neutral-200 p-4 sm:p-5 shadow-xl">
        <div className="text-sm text-neutral-500 mb-1">Detalle</div>
        <div className="text-lg font-semibold mb-2">{title}</div>
        <div className="text-[15px] leading-relaxed text-neutral-800 whitespace-pre-wrap">
          {detail ? <InlineMarkdown text={detail} /> : 'Sin detalles.'}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MiActividadChecks() {
  const {
    programsToday,
    challengesToday,
    habitsToday,
    toggleProgramTask,
  } = useTodayActivity();

  /* === Filtro defensivo: ocultar programas completados ===
     Considera varias banderas/estados que pueden existir en la app */
  const visiblePrograms = useMemo(() => {
    return (programsToday ?? []).filter((p: any) => {
      const isCompleted =
        p?.completed === true ||
        p?.isCompleted === true ||
        (typeof p?.progress === 'number' && typeof p?.totalDays === 'number' && p.progress >= p.totalDays) ||
        (typeof p?.day === 'number' && typeof p?.totalDays === 'number' && p.day > p.totalDays);

      const hasTasks = Array.isArray(p?.tasks) && p.tasks.length > 0;
      return !isCompleted && hasTasks;
    });
  }, [programsToday]);

  // Secciones vacías
  const hasPrograms = visiblePrograms.length > 0;
  const hasChallenges = (challengesToday ?? []).length > 0;
  const hasHabits = (habitsToday ?? []).length > 0;

  // Estado del modal
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoDetail, setInfoDetail] = useState<string | undefined>(undefined);

  const openInfo = (title: string, detail?: string) => {
    setInfoTitle(title);
    setInfoDetail(detail);
    setInfoOpen(true);
  };
  const closeInfo = () => setInfoOpen(false);

  // Wrapper para toggle que notifica a otras vistas que deben refrescar puntos
  const handleToggleProgramTask = useCallback(async (slug: string, day: number, taskId: string) => {
    try {
      await toggleProgramTask(slug, day, taskId);
    } finally {
      // Evento global para refrescar puntuaciones en Resumen/Estadísticas de forma inmediata
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('akira:points:refresh', { detail: { source: 'checks' } }));
      }
    }
  }, [toggleProgramTask]);

  const nothingAtAll = !hasPrograms && !hasChallenges && !hasHabits;

  return (
    <div className="py-6 space-y-6">
      {nothingAtAll && (
        <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600 bg-white">
          Todavía no hay nada creado
        </div>
      )}

      {/* Programas activos */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Programas activos</h3>
        {!hasPrograms && (
          <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>
        )}
        {hasPrograms && visiblePrograms.map((prog: any) => (
          <div key={prog.slug} className="space-y-2">
            <div className="text-sm font-medium">{prog.title}</div>
            {prog.tasks.map((t: any) => {
              const detail = findTaskDetail(prog.slug, prog.day, t.id);
              const showInfo = Boolean(detail);
              return (
                <CreateHabitBar
                  key={t.id}
                  variant="task"
                  label={t.label}
                  checked={t.done}
                  color={prog.color}
                  onToggle={() => handleToggleProgramTask(prog.slug, prog.day, t.id)}
                  onInfo={showInfo ? (() => openInfo(`${prog.title} · ${t.label}`, detail)) : undefined}
                  showInfoButton={showInfo}
                />
              );
            })}
          </div>
        ))}
      </section>

      {/* Retos con amigos */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Retos con amigos</h3>
        {!hasChallenges && (
          <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>
        )}
        {hasChallenges && challengesToday.map((ch: any) => (
          <div key={ch.id} className="space-y-2">
            <div className="text-sm font-medium">{ch.title}</div>
            {ch.tasks.map((t: any) => (
              <CreateHabitBar
                key={t.id}
                variant="task"
                label={t.label}
                checked={t.done}
                color={ch.color || '#111'}
                onToggle={t.onToggle ?? (() => {})}
                onInfo={t.detail ? (() => openInfo(`${ch.title} · ${t.label}`, t.detail)) : undefined}
                showInfoButton={Boolean(t.detail)}
              />
            ))}
          </div>
        ))}
      </section>

      {/* Hábitos personalizados */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Hábitos personalizados</h3>
        {!hasHabits && (
          <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>
        )}
        {hasHabits && habitsToday.map((h: any) => (
          <div key={h.id} className="space-y-2">
            <div className="text-sm font-medium">{h.name}</div>
            <CreateHabitBar
              variant="task"
              label="Check de hoy"
              checked={!!h.done}
              color={h.color || '#111'}
              onToggle={h.onToggle ?? (() => {})}
              onInfo={h.detail ? (() => openInfo(`${h.name} · Check de hoy`, h.detail)) : undefined}
              showInfoButton={Boolean(h.detail)}
            />
          </div>
        ))}
      </section>

      {/* Modal de detalles */}
      <InfoModal open={infoOpen} title={infoTitle} detail={infoDetail} onClose={closeInfo} />
    </div>
  );
}
