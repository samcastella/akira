// src/app/mizona/checks/page.tsx
'use client';

import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import CreateHabitBar from '@/components/habits/CreateHabitBar';

export default function MiActividadChecks() {
  const {
    programsToday,
    challengesToday,
    habitsToday,
    toggleProgramTask,
  } = useTodayActivity();

  const hasAny =
    programsToday.length > 0 || challengesToday.length > 0 || habitsToday.length > 0;

  const handleInfo = (progTitle: string, taskLabel: string) => {
    // Placeholder: sustituiremos por modal bonito
    alert(`${progTitle}\n\n${taskLabel}`);
  };

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
                  onInfo={() => handleInfo(prog.title, t.label)}
                  showInfoButton={true}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Retos con amigos */}
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
                  onInfo={() => handleInfo(ch.title, t.label)}
                  showInfoButton={true}
                />
              ))}
            </div>
          ))}
        </section>
      )}

      {/* Hábitos personalizados */}
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
                onInfo={() => handleInfo(h.name, 'Check de hoy')}
                showInfoButton={true}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
