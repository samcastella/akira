'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void; // cierra el modal (no acepta)
  programTitle?: string;
  defaultName?: string;
  context?: 'program' | 'community';
  onAccept: (data: {
    name: string;
    checks: string[];
    acceptedAt: number;
    version: number;
  }) => void;
  version?: number; // por si quieres forzarlo desde fuera; si no, 1
};

const POINTS = [
  {
    id: 'truth',
    label:
      'Juro decir la verdad, nada más que la verdad y marcar sólo los checks que realmente haya hecho',
  },
  { id: 'read', label: 'Leer atentamente cada reto propuesto del programa' },
  { id: 'best', label: 'Dar lo mejor de mi mismo' },
  { id: 'enjoy', label: 'Disfrutar del proceso' },
];

export default function CommitmentModal({
  open,
  onClose,
  programTitle, // seguimos aceptando la prop por compatibilidad, pero ya no la mostramos
  defaultName = '',
  context = 'program',
  onAccept,
  version = 1,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const nameInputId = useId();
  const descId = useId();

  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(POINTS.map((p) => [p.id, false])),
  );
  const [name, setName] = useState(defaultName);

  const allOk = POINTS.every((p) => checked[p.id]) && name.trim().length >= 2;

  // Cierre con ESC y enfoque inicial (sin abrir teclado)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // Enfocamos el botón de cerrar para accesibilidad, pero NO el input (evitamos teclado+zoom)
    closeBtnRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Evitar scroll del body al abrir
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-describedby={descId}
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div
        ref={dialogRef}
        className="relative z-[101] w-[min(520px,90vw)] max-h-[52vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
      >
        {/* Close */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <X size={18} />
        </button>

        <h2 className="mb-3 text-2xl font-semibold tracking-tight">
          Formulario de compromiso
        </h2>

        {/* Eliminado: título del programa debajo del heading */}
        {/*
        {programTitle && (
          <p className="mb-4 text-sm text-gray-600">
            Programa:{' '}
            <span className="font-medium text-gray-800">{programTitle}</span>
          </p>
        )}
        */}

        <p
          id={descId}
          className="mb-5 text-[15px] leading-relaxed text-gray-700"
        >
          Antes de empezar un programa es necesario que te comprometas contigo
          mismo a algunas cosas:
        </p>

        {/* Checks */}
        <ul className="mb-5 space-y-3">
          {POINTS.map((p) => (
            <li key={p.id}>
              <label className="group flex cursor-pointer select-none items-start gap-3">
                <span
                  className={[
                    'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px] border',
                    checked[p.id]
                      ? 'border-black bg-black text-white'
                      : 'border-gray-300 bg-white',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {checked[p.id] ? <Check size={14} /> : null}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!!checked[p.id]}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [p.id]: e.target.checked }))
                  }
                />
                <span className="text-[15px] leading-6 text-gray-900">
                  {p.label}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {/* Firma */}
        <div className="mb-6">
          <label
            htmlFor={nameInputId}
            className="mb-1 block text-sm font-medium text-gray-800"
          >
            Firma:{' '}
            <span className="font-normal text-gray-600">(tu nombre)</span>
          </label>
          <input
            id={nameInputId}
            name="signature"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Escribe tu nombre"
            autoComplete="name"
            aria-invalid={name.trim().length < 2 ? 'true' : 'false'}
            // text-base (16px) para evitar el auto-zoom de Safari al enfocar el input
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base outline-none placeholder:text-gray-400 focus:border-gray-500 focus:ring-0"
          />
          {name.trim().length < 2 && (
            <p className="mt-1 text-xs text-gray-500">
              Introduce al menos 2 caracteres.
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          disabled={!allOk}
          onClick={() =>
            onAccept({
              name: name.trim(),
              checks: POINTS.map((p) => p.id),
              acceptedAt: Date.now(),
              version,
            })
          }
          className={[
            'inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-semibold',
            allOk
              ? 'bg-black text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black'
              : 'bg-gray-200 text-gray-500',
          ].join(' ')}
        >
          Acepto el compromiso
        </button>
      </div>
    </div>
  );
}
