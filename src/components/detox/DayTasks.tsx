'use client';

import { CheckCircle2, Circle, Plus } from 'lucide-react';
import type { DetoxTask } from '@/lib/detox';

type Props = {
  day: number;                       // 1..N
  tasks: DetoxTask[];                // tareas del día
  checked?: Record<string, boolean>; // mapa taskId -> hecho
  onToggle?: (taskId: string) => void;
  onOpenForm?: (taskId: string) => void; // abrirá DetoxDailyForm más adelante
  accentClass?: string;              // opcional: color de programa (border/bg)
};

export default function DayTasks({
  day,
  tasks,
  checked = {},
  onToggle,
  onOpenForm,
  accentClass = 'border-gray-200',
}: Props) {
  if (!tasks?.length) {
    return (
      <div className="text-sm text-gray-500">
        No hay tareas definidas para el día {day}.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const isDone = !!checked[t.id];
        return (
          <div
            key={t.id}
            className={`flex items-center justify-between rounded-xl border p-3 ${accentClass} bg-white`}
          >
            <button
              type="button"
              aria-label={isDone ? 'Desmarcar' : 'Marcar'}
              onClick={() => onToggle?.(t.id)}
              className="flex items-center gap-3"
            >
              {isDone ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <Circle className="w-6 h-6" />
              )}
              <span className="text-sm font-medium">{t.title}</span>
            </button>

            <button
              type="button"
              aria-label="Abrir detalles"
              onClick={() => onOpenForm?.(t.id)}
              className="p-2"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
