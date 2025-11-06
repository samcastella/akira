// src/app/mizona/checks/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
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

  const hasAny =
    programsToday.length > 0 || challengesToday.length > 0 || habitsToday.length > 0;

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

  return (
    <div className="py-6 space-y-6">
      {!hasAny && (
        <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600 bg-white">
          Todavía no has comenzado ninguno
        </div>
      )}

      {/* Programas activos */}
      {programsToday.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Programas activos</h3>
          {programsToday.map((prog) => (
            <div key={prog.slug} className="space-y-2">
              <div className="text-sm font-medium">{prog.title}</div>
              {prog.tasks.map((t) => (
                <CreateHabitBar
                  key={t.id}
                  variant="task"
                  label={t.label}
                  checked={t.done}
                  color={prog.color}
                  onToggle={() => toggleProgramTask(prog.slug, prog.day, t.id)}
                  onInfo={() =>
                    openInfo(
                      `${prog.title} · ${t.label}`,
                      findTaskDetail(prog.slug, prog.day, t.id)
                    )
                  }
                  showInfoButton={true}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Retos con amigos (placeholder) */}
      {challengesToday.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Retos con amigos</h3>
          {challengesToday.map((ch) => (
            <div key={ch.id} className="space-y-2">
              <div className="text-sm font-medium">{ch.title}</div>
              {ch.tasks.map((t) => (
                <CreateHabitBar
                  key={t.id}
                  variant="task"
                  label={t.label}
                  checked={t.done}
                  color="#111"
                  onToggle={t.onToggle ?? (() => {})}
                  onInfo={() => openInfo(`${ch.title} · ${t.label}`, undefined)}
                  showInfoButton={true}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Hábitos personalizados (placeholder) */}
      {habitsToday.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Hábitos personalizados</h3>
          {habitsToday.map((h) => (
            <div key={h.id} className="space-y-2">
              <div className="text-sm font-medium">{h.name}</div>
              <CreateHabitBar
                variant="task"
                label="Check de hoy"
                checked={!!h.done}
                color={h.color || '#111'}
                onToggle={h.onToggle ?? (() => {})}
                onInfo={() => openInfo(`${h.name} · Check de hoy`, undefined)}
                showInfoButton={true}
              />
            </div>
          ))}
        </section>
      )}

      {/* Modal de detalles */}
      <InfoModal open={infoOpen} title={infoTitle} detail={infoDetail} onClose={closeInfo} />
    </div>
  );
}
