'use client';

import React from 'react';
import { Check, Plus } from 'lucide-react';

type BaseProps = {
  label?: string;
  className?: string;
  ariaLabel?: string;
};

/** Variante por defecto: barra de creación */
type CreateVariant = BaseProps & {
  variant?: 'create';
  onClick: () => void;
};

/** Variante de tarea: píldora con check + botón info */
type TaskVariant = BaseProps & {
  variant: 'task';
  checked: boolean;
  color?: string;         // color del programa (hex o css var)
  onToggle: () => void;   // click del check
  onInfo?: () => void;    // click del +
};

type Props = CreateVariant | TaskVariant;

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

export default function CreateHabitBar(props: Props) {
  const {
    label = props.variant === 'task' ? 'Tarea' : 'Crear hábito',
    className = '',
    ariaLabel = label,
  } = props;

  if (props.variant === 'task') {
    const { checked, onToggle, onInfo, color } = props;

    // Estilos de la píldora
    const theme = color || '#F5F5F5';
    const bg = checked ? theme : '#ffffff';
    const border = checked ? '#00000080' : addAlpha(theme, 0.4); // borde suave
    const text = '#111111';

    return (
      <div
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 transition',
          className
        )}
        style={{
          background: bg,
          color: text,
          border: `1px solid ${border}`,
          borderRadius: 9999,
        }}
        role="group"
        aria-label={ariaLabel}
      >
        {/* Izquierda: botón check */}
        <button
          onClick={onToggle}
          className="grid h-9 w-9 place-items-center rounded-full border shrink-0"
          title={checked ? 'Desmarcar' : 'Marcar'}
          aria-label={checked ? `Desmarcar ${label}` : `Marcar ${label}`}
          aria-pressed={checked}
          style={
            checked
              ? { background: '#22c55e', color: 'white', borderColor: '#16a34a' }
              : { background: 'white', borderColor: '#11111140' }
          }
        >
          {checked ? <Check size={16} /> : null}
        </button>

        {/* Centro: label */}
        <div className="mx-3 min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{label}</div>
        </div>

        {/* Derecha: info "+" */}
        <button
          onClick={onInfo}
          className="grid h-9 w-9 place-items-center rounded-full border shrink-0"
          title="Ver detalles"
          aria-label={`Ver detalles de ${label}`}
          style={{ background: 'white', borderColor: '#11111140' }}
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  // ===== Variante por defecto: barra de crear hábito =====
  const { onClick } = props as CreateVariant;
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl',
        'border border-black/20 bg-white px-4 py-3 text-left transition hover:shadow-sm',
        className
      )}
    >
      {/* Círculo con + a la izquierda */}
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-full bg-black text-white transition group-hover:scale-[1.03]"
      >
        <Plus size={16} />
      </span>

      {/* Texto */}
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}

/* =========================
   Utils
   ========================= */
/** Convierte #RRGGBB a rgba con alpha. Si recibe var() o nombres CSS, devuelve un alpha fijo gris. */
function addAlpha(hexOrCss: string, alpha: number) {
  // Si no es hex simple, devolvemos un borde neutro con alpha
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexOrCss)) {
    return 'rgba(17,17,17,0.25)';
  }
  const hex = hexOrCss.replace('#', '');
  const full =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
