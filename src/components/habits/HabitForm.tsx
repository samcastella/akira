'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ===========================
   Tipos expuestos al exterior
   =========================== */
export type HabitPerDayItem = {
  id: string;
  name?: string;
  description?: string;
};

export type HabitMaster = {
  id: string;
  name: string;
  presetKey?:
    | 'custom' | 'ejercicio' | 'paseo' | 'correr'
    | 'agua'   | 'planning'  | 'dientes' | 'casa'
    | 'fruta';
  icon?: string;                      // emoji (1 char)
  color?: string;                     // hex
  textColor?: 'black' | 'white';
  startDate?: string;                 // yyyy-mm-dd
  endDate?: string;                   // yyyy-mm-dd
  weekend?: boolean;                  // true = incluye S y D

  /** Personalización por día (compatible con versión anterior) */
  perDay?: Record<string, { items: HabitPerDayItem[] }>;

  // Opcionales
  time?: string;                      // HH:MM
  place?: string;                     // texto libre
};

type Props = {
  mode: 'create' | 'edit';
  presetKey:
    | 'custom' | 'ejercicio' | 'paseo' | 'correr'
    | 'agua'   | 'planning'  | 'dientes' | 'casa'
    | 'fruta';
  initial?: HabitMaster | null;
  onCancel: () => void;
  onSave: (habit: HabitMaster) => void;
};

/* ===========================
   Constantes UI
   =========================== */
const PASTEL_COLORS = [
  '#FDE68A', // amarillo suave
  '#FFE6B3', // naranja pastel
  '#BFEBD6', // verde menta
  '#C7E2FF', // azul pastel
  '#E9D5FF', // lila
  '#FAD9E6', // rosa pastel
  '#FECACA', // rojo muy suave
  '#E8EAF6', // indigo muy suave
  '#F0F0F0', // gris claro
] as const;

const PRESETS: Record<string, { label: string; icon: string; color: string; textColor: 'black' | 'white' }> = {
  custom:   { label: 'Crear hábito personalizado', icon: '✨', color: '#C7E2FF', textColor: 'black' },
  fruta:    { label: 'Comer 1 pieza de fruta',     icon: '🍎', color: '#FDE68A', textColor: 'black' },
  ejercicio:{ label: 'Hacer ejercicio',            icon: '🏋️‍♂️', color: '#BFEBD6', textColor: 'black' },
  paseo:    { label: 'Paseo diario',               icon: '🚶',    color: '#FAD9E6', textColor: 'black' },
  correr:   { label: 'Correr',                      icon: '🏃',    color: '#FFE6B3', textColor: 'black' },
  agua:     { label: 'Beber 1,5 litros de agua',   icon: '💧',    color: '#C7E2FF', textColor: 'black' },
  planning: { label: 'Hacer mi planning del día',  icon: '🗒️',    color: '#E9D5FF', textColor: 'black' },
  dientes:  { label: 'Cepillarme los dientes',     icon: '🪥',    color: '#FECACA', textColor: 'black' },
  casa:     { label: 'Arreglar y ordenar la casa', icon: '🧹',    color: '#E8EAF6', textColor: 'black' },
};

const WEEK_DAYS = [
  { key: 'monday',    label: 'Lunes' },
  { key: 'tuesday',   label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday',  label: 'Jueves' },
  { key: 'friday',    label: 'Viernes' },
  { key: 'saturday',  label: 'Sábado' },
  { key: 'sunday',    label: 'Domingo' },
];

/* ===========================
   Utils
   =========================== */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* Label + asterisco si es requerido */
function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium">
      {children}{required ? <span className="text-red-600">*</span> : null}
    </label>
  );
}

/* Fila con label a la izquierda e input a la derecha, bien alineado */
function LabeledRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px,1fr] items-center gap-3">
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

/* Switch estilo iOS */
function IOSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 select-none"
    >
      {label ? <span className="text-sm">{label}</span> : null}
      <span
        className="relative inline-block h-6 w-11 rounded-full transition-colors"
        style={{ background: checked ? '#16a34a' : '#e5e7eb', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: `translateX(${checked ? '1.0rem' : '0'})` }}
        />
      </span>
    </button>
  );
}

export default function HabitForm({
  mode,
  presetKey,
  initial,
  onCancel,
  onSave,
}: Props) {
  const isCustom = presetKey === 'custom';
  const preset = PRESETS[presetKey];

  // ===== Estado del formulario =====
  const [name, setName] = useState<string>(initial?.name ?? (isCustom ? '' : preset.label));
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState<string>(initial?.endDate ?? '');
  const [weekend, setWeekend] = useState<boolean>(initial?.weekend ?? true);
  const [color, setColor] = useState<string>(initial?.color ?? preset.color);
  const [textColor, setTextColor] = useState<'black'|'white'>(initial?.textColor ?? preset.textColor);
  const [icon, setIcon] = useState<string>(initial?.icon ?? preset.icon);

  // Per-day (compatibilidad con versión anterior)
  const [personalizePerDay, setPersonalizePerDay] = useState<boolean>(!!initial?.perDay && Object.keys(initial.perDay).length > 0);
  const [perDay, setPerDay] = useState<Record<string, { items: HabitPerDayItem[] }>>(() => {
    // Adaptar si venía con { name } plano
    if (initial?.perDay) {
      const adapted: Record<string, { items: HabitPerDayItem[] }> = {};
      for (const [dayKey, val] of Object.entries(initial.perDay)) {
        const items = (val as any).items
          ? (val as any).items as HabitPerDayItem[]
          : (val as any).name
            ? [{ id: uid(), name: (val as any).name }]
            : [];
        adapted[dayKey] = { items };
      }
      return adapted;
    }
    return {};
  });

  // NUEVO: hora/lugar
  const [time, setTime] = useState<string>(initial?.time ?? '');
  const [place, setPlace] = useState<string>(initial?.place ?? '');

  // Color picker oculto para el botón "+"
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCustom) {
      setName(preset.label);
      setColor(initial?.color ?? preset.color);
      setTextColor(initial?.textColor ?? preset.textColor);
      setIcon(initial?.icon ?? preset.icon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey]);

  // ===== Validaciones =====
  const errors = useMemo(() => {
    const e: string[] = [];
    if (isCustom && !name.trim()) e.push('El nombre del hábito es obligatorio.');
    if (!startDate) e.push('La fecha de inicio es obligatoria.');
    if (!endDate) e.push('La fecha de fin es obligatoria.');
    if (startDate && endDate && startDate > endDate) e.push('La fecha de inicio no puede ser posterior a la de fin.');
    return e;
  }, [isCustom, name, startDate, endDate]);

  // ===== Handlers per-day =====
  function ensureDay(dayKey: string) {
    setPerDay(prev => {
      if (prev[dayKey]) return prev;
      return { ...prev, [dayKey]: { items: [] } };
    });
  }
  function addDayItem(dayKey: string) {
    setPerDay(prev => {
      const current = prev[dayKey]?.items ?? [];
      const next = [...current, { id: uid(), name: '', description: '' }];
      return { ...prev, [dayKey]: { items: next } };
    });
  }
  function removeDayItem(dayKey: string, itemId: string) {
    setPerDay(prev => {
      const current = prev[dayKey]?.items ?? [];
      const next = current.filter(i => i.id !== itemId);
      return { ...prev, [dayKey]: { items: next } };
    });
  }
  function updateDayItem(dayKey: string, itemId: string, patch: Partial<HabitPerDayItem>) {
    setPerDay(prev => {
      const current = prev[dayKey]?.items ?? [];
      const next = current.map(i => i.id === itemId ? { ...i, ...patch } : i);
      return { ...prev, [dayKey]: { items: next } };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (errors.length) return;

    const cleanPerDay = personalizePerDay
      ? Object.fromEntries(
          WEEK_DAYS
            .map(d => d.key)
            .filter(k => perDay[k]?.items?.length)
            .map(k => [k, { items: perDay[k].items.map(it => ({
              id: it.id,
              name: it.name?.trim() || undefined,
              description: it.description?.trim() || undefined,
            })) }])
        )
      : undefined;

    const base: HabitMaster = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      presetKey,
      icon: (icon || '').trim().slice(0, 2), // mantener un emoji (algunos son 2 code units)
      color,
      textColor,
      startDate,
      endDate,
      weekend,
      perDay: cleanPerDay,
      time: time || undefined,
      place: place.trim() ? place.trim() : undefined,
    };

    onSave(base);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nota: todos los inputs usan text-base para evitar zoom en iOS al enfocar */}
      {/* Encabezado preset */}
      <div className="flex items-center gap-3">
        <span className="text-xl">{preset.icon}</span>
        <div className="text-sm">
          <div className="font-medium">{preset.label}</div>
          <div className="text-black/60">{isCustom ? 'Personaliza todos los campos' : 'Este hábito viene preconfigurado'}</div>
        </div>
      </div>

      {/* Nombre (solo custom) */}
      {isCustom && (
        <LabeledRow label="Nombre del hábito" required>
          <input
            type="text"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Ej. Recoger a los niños del cole"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </LabeledRow>
      )}

      {/* Hora & Lugar */}
      <div className="grid gap-4">
        <LabeledRow label="Hora">
          <input
            type="time"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </LabeledRow>
        <LabeledRow label="Lugar">
          <input
            type="text"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Calle, gimnasio…"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </LabeledRow>
      </div>

      {/* Fechas */}
      <div className="grid gap-4">
        <LabeledRow label="Fecha de inicio" required>
          <input
            type="date"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </LabeledRow>
        <LabeledRow label="Fecha de fin" required>
          <input
            type="date"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </LabeledRow>
      </div>

      {/* Fines de semana */}
      <div className="rounded-xl border border-black/10 bg-white px-4 py-3">
        <div className="grid grid-cols-[160px,1fr] items-center gap-3">
          <FieldLabel>¿Incluir fines de semana?</FieldLabel>
          <div className="flex items-center justify-between">
            <div className="text-sm text-black/60">Si desactivas, solo contará de Lunes a Viernes.</div>
            <IOSwitch checked={weekend} onChange={setWeekend} />
          </div>
        </div>
      </div>

      {/* Colores + Emoji */}
      <div className="space-y-4">
        <LabeledRow label="Color del hábito">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            {PASTEL_COLORS.map((c) => {
              const selected = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="relative shrink-0"
                  aria-label={`Elegir color ${c}`}
                  title={c}
                >
                  <span
                    className="block rounded-full"
                    style={{
                      width: 28,
                      height: 28,
                      background: c,
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)',
                      border: selected ? '2px solid #111' : '2px solid transparent',
                    }}
                  />
                </button>
              );
            })}

            {/* Botón "+" para color personalizado */}
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/20 text-sm"
              aria-label="Elegir color personalizado"
              title="Elegir color personalizado"
            >
              +
            </button>
            <input
              ref={colorInputRef}
              type="color"
              className="hidden"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </LabeledRow>

        <LabeledRow label="Emoji">
          <input
            type="text"
            className="w-full max-w-[120px] rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Ej. ✨"
            value={icon}
            onChange={(e) => setIcon(e.target.value.slice(0, 2))}
            inputMode="text"
            aria-label="Emoji"
          />
        </LabeledRow>

        <LabeledRow label="Color del texto">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="textColor"
                checked={textColor === 'black'}
                onChange={() => setTextColor('black')}
              />
              Negro
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="textColor"
                checked={textColor === 'white'}
                onChange={() => setTextColor('white')}
              />
              Blanco
            </label>
          </div>
        </LabeledRow>
      </div>

      {/* Personalización por día */}
      <div className="space-y-3">
        <div className="grid grid-cols-[160px,1fr] items-center gap-3">
          <FieldLabel>Personalizar por día</FieldLabel>
          <div className="flex items-center gap-3">
            <IOSwitch checked={personalizePerDay} onChange={setPersonalizePerDay} />
            <span className="text-sm text-black/70">{personalizePerDay ? 'Sí' : 'No'}</span>
          </div>
        </div>

        {personalizePerDay && (
          <div className="mt-1 space-y-5">
            {WEEK_DAYS.map((d) => {
              const items = perDay[d.key]?.items ?? [];
              return (
                <div key={d.key} className="rounded-xl border border-black/10 bg-white p-3">
                  <div className="mb-3 text-sm font-medium">Hábito para {d.label}</div>

                  {/* Lista de items (nombre + descripción) */}
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,1fr,auto] sm:items-center">
                        <input
                          type="text"
                          className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
                          placeholder="Nombre del hábito"
                          value={it.name ?? ''}
                          onChange={(e) => updateDayItem(d.key, it.id, { name: e.target.value })}
                        />
                        <input
                          type="text"
                          className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/10"
                          placeholder="Descripción (aparecerá en el +)"
                          value={it.description ?? ''}
                          onChange={(e) => updateDayItem(d.key, it.id, { description: e.target.value })}
                        />
                        <div className="flex gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => removeDayItem(d.key, it.id)}
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5"
                            aria-label="Eliminar"
                            title="Eliminar"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => { ensureDay(d.key); addDayItem(d.key); }}
                      className="rounded-xl border border-black bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Añadir hábito adicional
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Errores */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ul className="list-disc space-y-1 pl-4">
            {errors.map((er, i) => <li key={i}>{er}</li>)}
          </ul>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {mode === 'edit' ? 'Guardar cambios' : 'Finalizar'}
        </button>
      </div>
    </form>
  );
}
