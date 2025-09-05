'use client';

import React, { useEffect, useState } from 'react';
import CreateHabitBar from '@/components/habits/CreateHabitBar';
import HabitForm, { HabitMaster } from '@/components/habits/HabitForm';
import HabitsCreatedList from '@/components/habits/HabitsCreatedList';

/* ===========================
   Claves de almacenamiento
   =========================== */
const LS_HABITS_MASTER = 'akira_habits_master_v1';

/* ===========================
   Helpers almacenamiento
   =========================== */
function loadMasterHabits(): HabitMaster[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_HABITS_MASTER);
    return raw ? (JSON.parse(raw) as HabitMaster[]) : [];
  } catch {
    return [];
  }
}
function saveMasterHabits(list: HabitMaster[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_HABITS_MASTER, JSON.stringify(list));
}

/* ===========================
   Modal base
   =========================== */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-[92%] max-w-lg rounded-2xl border border-black/10 bg-white shadow-lg">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4">
          <h2 className="text-lg font-semibold">{title ?? 'Selecciona una opción'}</h2>
          <button onClick={onClose} className="rounded-full border border-black/10 px-3 py-1 text-sm hover:bg-black/5" aria-label="Cerrar">
            Cerrar
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ===========================
   Opciones iniciales (selector)
   =========================== */
const PRESET_OPTIONS: { key: 'custom' | 'ejercicio' | 'paseo' | 'correr' | 'agua' | 'planning' | 'dientes' | 'casa'; label: string; icon: string }[] = [
  { key: 'custom', label: 'Crear hábito personalizado', icon: '✨' },
  { key: 'ejercicio', label: 'Hacer ejercicio', icon: '🏋️‍♂️' },
  { key: 'paseo', label: 'Paseo diario', icon: '🚶' },
  { key: 'correr', label: 'Correr', icon: '🏃' },
  { key: 'agua', label: 'Beber 1,5 litros de agua', icon: '💧' },
  { key: 'planning', label: 'Hacer mi planning del día', icon: '🗒️' },
  { key: 'dientes', label: 'Cepillarme los dientes', icon: '🪥' },
  { key: 'casa', label: 'Arreglar y ordenar la casa', icon: '🧹' },
];

/* ===========================
   Página
   =========================== */
export default function CrearHabitosPage() {
  const [openSelector, setOpenSelector] = useState(false);

  // Form modal state
  const [openForm, setOpenForm] = useState(false);
  const [formPreset, setFormPreset] = useState<('custom' | 'ejercicio' | 'paseo' | 'correr' | 'agua' | 'planning' | 'dientes' | 'casa')>('custom');
  const [editTarget, setEditTarget] = useState<HabitMaster | null>(null);

  const [habits, setHabits] = useState<HabitMaster[]>([]);

  useEffect(() => {
    setHabits(loadMasterHabits());
  }, []);

  function handleSelectPreset(key: typeof formPreset) {
    setOpenSelector(false);
    setFormPreset(key);
    setEditTarget(null);
    setOpenForm(true);
  }

  function handleCreateOrUpdate(h: HabitMaster) {
    setHabits((prev) => {
      const idx = prev.findIndex(x => x.id === h.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = h;
        saveMasterHabits(updated);
        return updated;
      } else {
        const next = [h, ...prev];
        saveMasterHabits(next);
        return next;
      }
    });
    setOpenForm(false);
    setEditTarget(null);
  }

  function openEdit(h: HabitMaster) {
    setEditTarget(h);
    setFormPreset((h.presetKey as any) ?? 'custom');
    setOpenForm(true);
  }

  function handleDelete(id: string) {
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id);
      saveMasterHabits(next);
      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Intro */}
      <p className="mb-5 text-sm leading-relaxed text-black/70">
        En esta sección podrás crear hábitos personalizados para poderlos incorporar a la sección de
        <span className="font-semibold"> Mis hábitos </span>
        en <span className="font-semibold">Mi Zona</span>.
      </p>

      {/* Barra (+) Crear hábito */}
      <CreateHabitBar onClick={() => setOpenSelector(true)} />

      {/* Modal selector de tipo de hábito */}
      <Modal open={openSelector} onClose={() => setOpenSelector(false)} title="¿Qué tipo de hábito quieres crear?">
        <div className="flex flex-col">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleSelectPreset(opt.key)}
              className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left hover:bg-black/5"
            >
              <span className="flex items-center gap-3">
                <span className="text-xl">{opt.icon}</span>
                <span className="text-[15px]">{opt.label}</span>
              </span>
              <span aria-hidden className="text-black/40">›</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Modal formulario */}
      <Modal
        open={openForm}
        onClose={() => { setOpenForm(false); setEditTarget(null); }}
        title={editTarget ? 'Editar hábito' : 'Crear hábito'}
      >
        <HabitForm
          mode={editTarget ? 'edit' : 'create'}
          presetKey={formPreset}
          initial={editTarget ?? undefined}
          onCancel={() => { setOpenForm(false); setEditTarget(null); }}
          onSave={handleCreateOrUpdate}
        />
      </Modal>

      {/* Hábitos creados */}
      <section className="mt-8">
        <h3 className="mb-3 text-base font-semibold">Hábitos creados</h3>

        <HabitsCreatedList
          habits={habits}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </section>
    </main>
  );
}