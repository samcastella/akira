'use client';

import React, { useEffect, useRef } from 'react';
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
  color?: string;       // color del programa (hex o css var)
  onToggle: () => void; // click del check (API se mantiene)
  onInfo?: () => void;  // click del +
};

type Props = CreateVariant | TaskVariant;

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

/* ========= confeti (canvas propio) ========= */
let confettiInstance: any | null = null;
let confettiCanvas: HTMLCanvasElement | null = null;

async function getShooter() {
  const { default: confetti } = await import('canvas-confetti');
  if (!confettiCanvas) {
    confettiCanvas = document.createElement('canvas');
    Object.assign(confettiCanvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '9999',
    });
    document.body.appendChild(confettiCanvas);
  }
  if (!confettiInstance) {
    confettiInstance = confetti.create(confettiCanvas, { resize: true, useWorker: true });
  }
  return confettiInstance;
}

async function boomAt(x?: number, y?: number) {
  try {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const shoot = await getShooter();
    const ox = Math.min(Math.max((x ?? window.innerWidth / 2) / window.innerWidth, 0), 1);
    const oy = Math.min(Math.max((y ?? window.innerHeight / 2) / window.innerHeight, 0), 1);

    shoot({
      particleCount: 90,
      spread: 70,
      startVelocity: 38,
      ticks: 220,
      gravity: 0.9,
      origin: { x: ox, y: oy },
      scalar: 0.95,
    });
  } catch {}
}

/* ========= markdown inline muy simple (para quitar ** **) ========= */
function renderInlineMarkdown(text?: string) {
  const t = text ?? '';
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m.index > i) parts.push(t.slice(i, m.index));
    parts.push(<strong key={`b-${m.index}`} className="font-semibold">{m[1]}</strong>);
    i = m.index + m[0].length;
  }
  if (i < t.length) parts.push(t.slice(i));
  return parts;
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

    // ---- Confeti desde la propia píldora ----
    const lastXY = useRef<{ x?: number; y?: number }>({});
    const prev = useRef<boolean>(checked);
    useEffect(() => {
      if (!prev.current && checked) {
        void boomAt(lastXY.current.x, lastXY.current.y);
        requestAnimationFrame(() => void boomAt(lastXY.current.x, lastXY.current.y));
      }
      prev.current = checked;
    }, [checked]);

    return (
      <div
        className={cn('flex w-full items-center justify-between px-4 py-3 transition', className)}
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
          onMouseDown={(e) => { lastXY.current = { x: e.clientX, y: e.clientY }; }}
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
          <div className="truncate text-base font-medium">{renderInlineMarkdown(label)}</div>
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
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-full bg-black text-white transition group-hover:scale-[1.03]"
      >
        <Plus size={16} />
      </span>
      <span className="text-base font-medium">{renderInlineMarkdown(label)}</span>
    </button>
  );
}

/* =========================
   Utils
   ========================= */
/** Convierte #RRGGBB a rgba con alpha. Si recibe var() o nombres CSS, devuelve un alpha fijo gris. */
function addAlpha(hexOrCss: string, alpha: number) {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexOrCss)) {
    return 'rgba(17,17,17,0.25)';
  }
  const hex = hexOrCss.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
