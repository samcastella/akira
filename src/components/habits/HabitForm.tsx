'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* ===========================
   Tipos esperados desde la página
   =========================== */
export type HabitMaster = {
  id: string;
  name: string;
  presetKey?: string;                 // ej: 'agua', 'ejercicio', 'custom'
  icon?: string;                      // emoji por ahora
  color?: string;                     // hex pastel
  textColor?: 'black' | 'white';
  startDate?: string;                 // yyyy-mm-dd
  endDate?: string;                   // yyyy-mm-dd
  weekend?: boolean;                  // incluye fines de semana (true = incluye S y D)
  perDay?: Record<string, { name?: string }>; // personalización por día
};

type Props = {
  mode: 'create' | 'edit';
  presetKey: 'custom' | 'ejercicio' | 'paseo' | 'correr' | 'agua' | 'planning' | 'dientes' | 'casa';
  initial?: HabitMaster | null;       // para editar
  onCancel: () => void;
  onSave: (habit: HabitMaster) => void;
};

/* ===========================
   Paleta de 20 colores pastel
   =========================== */
const PASTEL_COLORS = [
  '#A8DADC','#BDE0FE','#CDEAC0','#FFE5B4','#FFD6E0',
  '#D7E3FC','#E2F0CB','#FDE2E4','#E4F1FE','#FFF1BF',
  '#D1F7C4','#E8EAF6','#F1F8E9','#FFF3E0','#F3E5F5',
  '#E0F7FA','#F0F4C3','#D7CCC8','#ECEFF1','#FBE9E7',
] as const;

/* ===========================
   Presets (icono + color sugerido)
   =========================== */
const PRESETS: Record<string, { label: string; icon: string; color: string; textColor: 'black' | 'white' }> = {
  custom:   { label: 'Crear hábito personalizado', icon: '✨', color: '#BDE0FE', textColor: 'black' },
  ejercicio:{ label: 'Hacer ejercicio',            icon: '🏋️‍♂️', color: '#E2F0CB', textColor: 'black' },
  paseo:    { label: 'Paseo diario',               icon: '🚶',    color: '#FDE2E4', textColor: 'black' },
  correr:   { label: 'Correr',                      icon: '🏃',    color: '#FFF1BF', textColor: 'black' },
  agua:     { label: 'Beber 1,5 litros de agua',   icon: '💧',    color: '#A8DADC', textColor: 'black' },
  planning: { label: 'Hacer mi planning del día',  icon: '🗒️',    color: '#D7E3FC', textColor: 'black' },
  dientes:  { label: 'Cepillarme los dientes',     icon: '🪥',    color: '#E4F1FE', textColor: 'black' },
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

      {/* Fin de semana */}
      <div className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3">
        <div className="text-sm">
          <div className="font-medium">¿Incluir fines de semana?</div>
          <div className="text-black/60">Si desactivas, solo contará de Lunes a Viernes.</div>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={weekend}
            onChange={(e) => setWeekend(e.target.checked)}
          />
          <span className="h-6 w-11 rounded-full bg-black/20 transition peer-checked:bg-black" />
          <span className="ml-2 text-sm">{weekend ? 'Sí' : 'No'}</span>
        </label>
      </div>

      {/* Color + color de texto (solo custom) */}
      {isCustom && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Color del hábito</label>
            <div className="grid grid-cols-10 gap-2">
              {PASTEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={[
                    'h-8 w-full rounded-lg border',
                    color === c ? 'border-black' : 'border-black/20',
                  ].join(' ')}
                  style={{ background: c }}
                  aria-label={`Elegir color ${c}`}
                  title={c}
                />
              ))}
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
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={personalizePerDay}
                  onChange={(e) => setPersonalizePerDay(e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-black/20 transition peer-checked:bg-black" />
                <span className="ml-2 text-sm">{personalizePerDay ? 'Sí' : 'No'}</span>
              </label>
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
