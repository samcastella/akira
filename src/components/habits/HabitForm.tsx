'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* ===========================
   Tipos esperados desde la página
   =========================== */
export type HabitMaster = {
  id: string;
  name: string;
  presetKey?: string;                 // ej: 'agua', 'ejercicio', 'custom', 'fruta'
  icon?: string;                      // emoji por ahora
  color?: string;                     // hex pastel
  textColor?: 'black' | 'white';
  startDate?: string;                 // yyyy-mm-dd
  endDate?: string;                   // yyyy-mm-dd
  weekend?: boolean;                  // incluye fines de semana (true = incluye S y D)
  perDay?: Record<string, { name?: string }>; // personalización por día

  // NUEVO
  time?: string;                      // HH:MM (opcional)
  place?: string;                     // texto libre (opcional)
};

type Props = {
  mode: 'create' | 'edit';
  presetKey:
    | 'custom' | 'ejercicio' | 'paseo' | 'correr'
    | 'agua'   | 'planning'  | 'dientes' | 'casa'
    | 'fruta';
  initial?: HabitMaster | null;       // para editar
  onCancel: () => void;
  onSave: (habit: HabitMaster) => void;
};

/* ===========================
   Paleta de colores (pasteles + suaves, en círculos)
   =========================== */
const PASTEL_COLORS = [
  '#FDE68A', // amarillo suave
  '#FFE6B3', // naranja pastel
  '#BFEBD6', // verde menta
  '#C7E2FF', // azul pastel
  '#E9D5FF', // lila
  '#FAD9E6', // rosa pastel
  '#FECACA', // rojo muy suave
  '#E8EAF6', // indigo muy suave (compat)
  '#F0F0F0', // gris claro
] as const;

/* ===========================
   Presets (icono + color sugerido)
   =========================== */
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

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ===========================
   Switch estilo iOS
   =========================== */
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
  const [weekend, setWeekend] = useState<boolean>(initial?.weekend ?? true); // true = incluye S/D
  const [color, setColor] = useState<string>(initial?.color ?? preset.color);
  const [textColor, setTextColor] = useState<'black'|'white'>(initial?.textColor ?? preset.textColor);
  const [personalizePerDay, setPersonalizePerDay] = useState<boolean>(!!initial?.perDay && Object.keys(initial.perDay).length > 0);
  const [perDay, setPerDay] = useState<Record<string, { name?: string }>>(
    initial?.perDay ?? {}
  );

  // NUEVO: hora/lugar (opcionales)
  const [time, setTime] = useState<string>(initial?.time ?? '');
  const [place, setPlace] = useState<string>(initial?.place ?? '');

  useEffect(() => {
    if (!isCustom) {
      setName(preset.label);
      setColor(initial?.color ?? preset.color);
      setTextColor(initial?.textColor ?? preset.textColor);
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

  function handlePerDayNameChange(dayKey: string, val: string) {
    setPerDay(prev => ({ ...prev, [dayKey]: { name: val || undefined } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (errors.length) return;

    const base: HabitMaster = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      presetKey,
      icon: preset.icon,
      color,
      textColor,
      startDate,
      endDate,
      weekend,              // true = incluye sábado y domingo
      perDay: personalizePerDay ? perDay : undefined,
      time: time || undefined,
      place: place.trim() ? place.trim() : undefined,
    };

    onSave(base);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo de hábito seleccionado */}
      <div className="flex items-center gap-3">
        <span className="text-xl">{preset.icon}</span>
        <div className="text-sm">
          <div className="font-medium">{preset.label}</div>
          <div className="text-black/60">{isCustom ? 'Personaliza todos los campos' : 'Este hábito viene preconfigurado'}</div>
        </div>
      </div>

      {/* Nombre (solo custom) */}
      {isCustom && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre del hábito</label>
          <input
            type="text"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Ej. Recoger a los niños del cole"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}

      {/* Hora & Lugar (opcionales para todos los presets) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Hora (opcional)</label>
          <input
            type="time"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Lugar (opcional)</label>
          <input
            type="text"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Calle, gimnasio…"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Fecha de inicio</label>
          <input
            type="date"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Fecha de fin</label>
          <input
            type="date"
            className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Fin de semana (switch iOS) */}
      <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3">
        <div className="text-sm">
          <div className="font-medium">¿Incluir fines de semana?</div>
          <div className="text-black/60">Si desactivas, solo contará de Lunes a Viernes.</div>
        </div>
        <IOSwitch checked={weekend} onChange={setWeekend} />
      </div>

      {/* Color (ahora en circunferencias) + color de texto (solo custom) */}
      {isCustom && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Color del hábito</label>
            <div className="flex flex-wrap gap-10">
              {PASTEL_COLORS.map((c) => {
                const selected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="relative"
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
            </div>
            <div className="mt-2 text-xs text-black/60">
              Consejo: usa colores claros tipo pastel para mantener la estética uniforme.
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Color del texto</label>
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
          </div>

          {/* Personalización por día */}
          <div className="space-y-2">
            <label className="text-sm font-medium">¿Quieres personalizar el hábito de cada día?</label>
            <div className="flex items-center gap-3">
              <IOSwitch checked={personalizePerDay} onChange={setPersonalizePerDay} />
              <span className="text-sm text-black/70">{personalizePerDay ? 'Sí' : 'No'}</span>
            </div>

            {personalizePerDay && (
              <div className="mt-3 space-y-2">
                {WEEK_DAYS.map((d) => (
                  <div key={d.key} className="grid grid-cols-[110px,1fr] items-center gap-3">
                    <span className="text-sm text-black/70">{d.label}</span>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                      placeholder={`Nombre para ${d.label} (opcional)`}
                      value={perDay?.[d.key]?.name ?? ''}
                      onChange={(e) => handlePerDayNameChange(d.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
