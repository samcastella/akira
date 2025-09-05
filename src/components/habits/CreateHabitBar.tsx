'use client';

import React from 'react';

type Props = {
  onClick: () => void;
  label?: string;
  className?: string;
  ariaLabel?: string;
};

export default function CreateHabitBar({
  onClick,
  label = 'Crear hábito',
  className = '',
  ariaLabel = 'Crear hábito',
}: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        'group flex w-full items-center gap-3 rounded-2xl',
        'border border-black/20 bg-white px-4 py-3 text-left transition hover:shadow-sm',
        className,
      ].join(' ')}
    >
      {/* Círculo con + a la izquierda */}
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-full bg-black text-white transition group-hover:scale-[1.03]"
      >
        +
      </span>

      {/* Texto */}
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}
