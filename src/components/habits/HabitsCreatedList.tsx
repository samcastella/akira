'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { HabitMaster } from '@/components/habits/HabitForm';

type Props = {
  habits: HabitMaster[];
  onEdit: (habit: HabitMaster) => void;
  onDelete?: (id: string) => void;
};

export default function HabitsCreatedList({ habits, onEdit, onDelete }: Props) {
  if (!habits || habits.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/20 px-4 py-6 text-center text-sm text-black/50">
        Aún no has creado hábitos. Pulsa en <span className="font-medium">“Crear hábito”</span> para empezar.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {habits.map((h) => (
        <li
          key={h.id}
          className="rounded-2xl border border-black/20 bg-white px-4 py-3"
        >
          {/* Barra visual del hábito (no clicable) */}
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              {/* Icono */}
              <span className="text-xl shrink-0">{h.icon ?? '🧩'}</span>
              {/* Nombre */}
              <span className="truncate text-sm">
                {h.name}
              </span>
            </span>

            {/* Preview de color + círculo de check desactivado */}
            <span className="flex items-center gap-3 shrink-0">
              {h.color && (
                <span
                  className="h-4 w-4 rounded-full border border-black/20"
                  style={{ background: h.color }}
                  aria-hidden
                  title={`Color ${h.color}`}
                />
              )}
              <span
                className="grid h-6 w-6 place-items-center rounded-full border border-black/40 bg-white text-black/30"
                title="Check (solo desde Mis hábitos)"
                aria-hidden
              />
            </span>
          </div>

          {/* Fila inferior: “Editar” pequeñito + eliminar (opcional) */}
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => onEdit(h)}
              className="text-[11px] text-black/60 underline underline-offset-2 hover:text-black"
              aria-label={`Editar hábito ${h.name}`}
              title="Editar"
            >
              Editar
            </button>

            {!!onDelete && (
              <button
                onClick={() => onDelete(h.id)}
                className="rounded-full border border-black/10 p-2 text-black/60 hover:bg-black/5"
                aria-label={`Eliminar hábito ${h.name}`}
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
