'use client';

import React, { useEffect, useRef } from 'react';
import { Check, Plus } from 'lucide-react';

/* ========= Tipos ========= */
type BaseProps = {
  label?: string;
  className?: string;
  ariaLabel?: string;
};

type CreateVariant = BaseProps & {
  variant?: 'create';
  onClick: () => void;
};

type TaskVariant = BaseProps & {
  variant: 'task';
  checked: boolean;
  color?: string;
  onToggle: () => void;
  onInfo?: () => void;
  showInfoButton?: boolean;
  rightSlot?: React.ReactNode;
};

type Props = CreateVariant | TaskVariant;

/* ========= Utils ========= */
function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

function addAlpha(hexOrCss: string, alpha: number) {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexOrCss)) {
    return 'rgba(17,17,17,0.08)'; // fallback suave
  }
  const hex = hexOrCss.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function isDark(hex: string): boolean {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) return false;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum < 0.5;
}

/* ========= confeti ========= */
let confettiInstance: any | null = null;
let confettiCanvas: HTMLCanvasElement | null = null;

async function getShooter() {
  const { default: confetti } = await import('canvas-confetti');
  if (!confettiCanvas) {
    confettiCanvas = document.createElement('canvas');
    Object.assign(confettiCanvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '2147483647',
      background: 'transparent',
    });
    document.body.appendChild(confettiCanvas);
  }
  if (!confettiInstance) {
    confettiInstance = confetti.create(confettiCanvas, { resize: true, useWorker: true });
  }
  return confettiInstance;
}

async function boomAt(x?: number, y?: number) {
  if (typeof window === 'undefined') return;
  try {
    const prefersReduced =
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

/* ========= markdown inline simple ========= */
function renderInlineMarkdown(text?: string) {
  const t = text ?? '';
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m.index > i) parts.push(t.slice(i, m.index));
    parts.push(
      <strong key={`b-${m.index}`} className="font-semibold">
        {m[1]}
      </strong>
    );
    i = m.index + m[0].length;
  }
  if (i < t.length) parts.push(t.slice(i));
  return parts;
}

/* ========= Componente principal ========= */
export default function CreateHabitBar(props: Props) {
  const {
    label = props.variant === 'task' ? 'Tarea' : 'Crear hábito',
    className = '',
    ariaLabel = label,
  } = props;

  /* ==== Variante TAREA ==== */
  if (props.variant === 'task') {
    const { checked, onToggle, onInfo, color, showInfoButton, rightSlot } = props;
    const theme = color || '#F5F5F5';

    // Fondo SIEMPRE tintado con el color del programa (compacto y legible)
    const bg = addAlpha(theme, 0.14);
    const border = addAlpha(theme, 0.45);
    const text = '#111';

    const lastXY = useRef<{ x?: number; y?: number }>({});
    const prev = useRef<boolean>(checked);

    useEffect(() => {
      if (!prev.current && checked) {
        const globalXY = (window as any).__akiraLastXY || {};
        const x = lastXY.current.x ?? globalXY.x;
        const y = lastXY.current.y ?? globalXY.y;
        void boomAt(x, y);
        requestAnimationFrame(() => void boomAt(x, y));
      }
      prev.current = checked;
    }, [checked]);

    const shouldShowInfo = showInfoButton ?? Boolean(onInfo);

    return (
      <div
        className={cn(
          // ⬇️ Compacto (~65% altura): menos padding, icono 32px, tipografía text-sm
          'flex w-full items-center gap-2.5 px-3 py-2 transition rounded-full',
          'focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2 focus-within:ring-offset-white',
          className
        )}
        style={{ background: bg, color: text, border: `1px solid ${border}` }}
        role="group"
        aria-label={ariaLabel}
      >
        {/* Círculo de check: verde si marcado (el fondo general NO cambia) */}
        <button
          onMouseDown={(e) => {
            lastXY.current = { x: e.clientX, y: e.clientY };
            (window as any).__akiraLastXY = { x: e.clientX, y: e.clientY };
          }}
          onTouchStart={(e) => {
            const t = e.touches?.[0];
            if (t) {
              lastXY.current = { x: t.clientX, y: t.clientY };
              (window as any).__akiraLastXY = { x: t.clientX, y: t.clientY };
            }
          }}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full border shrink-0 transition active:scale-95 focus-visible:outline-none',
            checked
              ? 'bg-green-500 border-green-600 text-white'
              : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'
          )}
          title={checked ? 'Desmarcar' : 'Marcar'}
          aria-label={checked ? `Desmarcar ${label}` : `Marcar ${label}`}
          aria-pressed={checked}
        >
          {checked && <Check size={16} aria-hidden />}
        </button>

        {/* Texto: asegurar que SIEMPRE cabe dentro (truncate) */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-snug">
            {renderInlineMarkdown(label)}
          </div>
        </div>

        {/* Botón info opcional */}
        {shouldShowInfo && (
          <button
            onClick={onInfo}
            className="grid h-8 w-8 place-items-center rounded-full border shrink-0 transition hover:bg-white active:scale-95 focus-visible:outline-none"
            title="Ver detalles"
            aria-label={`Ver detalles de ${label}`}
            style={{ background: 'white', borderColor: '#11111133' }}
          >
            <Plus size={16} aria-hidden />
          </button>
        )}

        {/* Slot derecho (por ejemplo, botón de subir foto en Retos) */}
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    );
  }

  /* ==== Variante CREAR ==== */
  const { onClick } = props as CreateVariant;
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-2xl border border-black/15 bg-white px-3 py-2 text-left transition hover:shadow-sm active:scale-[0.99]',
        className
      )}
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-full bg-black text-white transition group-hover:scale-[1.03]"
      >
        <Plus size={16} />
      </span>
      <span className="text-sm font-medium leading-snug truncate">
        {renderInlineMarkdown(label)}
      </span>
    </button>
  );
}
