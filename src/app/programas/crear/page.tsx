'use client';

import React, { useEffect, useState } from 'react';
import SubHeaderTabs from '@/components/nav/SubHeaderTabs';
import CreateHabitBar from '@/components/habits/CreateHabitBar';
import HabitForm, { HabitMaster } from '@/components/habits/HabitForm';
import { queueMasterUpsert } from '@/lib/useHabitsSupabaseSync';
import { Trash2 } from 'lucide-react';

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
const nowIso = () => new Date().toISOString();

/* ===========================
   Modal base (con scroll interno)
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-[92%] max-w-lg rounded-2xl border border-black/10 bg-white shadow-lg max-h-[85svh] flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4 shrink-0">
          <h2 className="text-lg font-semibold">
            {title ?? 'Selecciona una opción'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 px-3 py-1 text-sm hover:bg-black/5"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
        <div
          className="px-5 py-4 overflow-y-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Opciones iniciales (selector)
   =========================== */
type PresetKey =
  | 'custom'
  | 'ejercicio'
  | 'paseo'
  | 'correr'
  | 'agua'
  | 'planning'
  | 'dientes'
  | 'casa'
  | 'fruta';

const PRESET_OPTIONS: { key: PresetKey; label: string; icon: string }[] = [
  { key: 'custom', label: 'Crear hábito personalizado', icon: '✨' },
  { key: 'fruta', label: 'Comer 1 pieza de fruta', icon: '🍎' },
  { key: 'ejercicio', label: 'Hacer ejercicio', icon: '🏋️‍♂️' },
  { key: 'paseo', label: 'Paseo diario', icon: '🚶' },
  { key: 'correr', label: 'Correr', icon: '🏃' },
  { key: 'agua', label: 'Beber 1,5 litros de agua', icon: '💧' },
  { key: 'planning', label: 'Hacer mi planning del día', icon: '🗒️' },
  { key: 'dientes', label: 'Cepillarme los dientes', icon: '🪥' },
  { key: 'casa', label: 'Arreglar y ordenar la casa', icon: '🧹' },
];

/* ===========================
   Página principal
   =========================== */
export default function CrearProgramaPage() {
  const [openSelector, setOpenSelector] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [formPreset, setFormPreset] = useState<PresetKey>('custom');
  const [editTarget, setEditTarget] = useState<HabitMaster | null>(null);
  const [habits, setHabits] = useState<HabitMaster[]>([]);

  useEffect(() => {
    const all = loadMasterHabits();
    setHabits(all.filter((h: any) => !h?.deleted_at));
  }, []);

  function handleSelectPreset(key: PresetKey) {
    setOpenSelector(false);
    setFormPreset(key);
    setEditTarget(null);
    setOpenForm(true);
  }

  function handleCreateOrUpdate(h: HabitMaster) {
    const enriched = { ...(h as any), updated_at: nowIso() } as HabitMaster;

    setHabits((prev) => {
      const prevAll = loadMasterHabits();
      const idx = prevAll.findIndex((x) => x.id === enriched.id);
      let nextAll: HabitMaster[];
      if (idx >= 0) {
        nextAll = [...prevAll];
        nextAll[idx] = enriched;
      } else {
        nextAll = [enriched, ...prevAll];
      }
      saveMasterHabits(nextAll);
      return nextAll.filter((x: any) => !x?.deleted_at);
    });

    try {
      queueMasterUpsert(enriched as any);
    } catch {}
    setOpenForm(false);
    setEditTarget(null);
  }

  function openEdit(h: HabitMaster) {
    setEditTarget(h);
    setFormPreset(((h as any).presetKey as PresetKey) ?? 'custom');
    setOpenForm(true);
  }

  function handleDelete(id: string) {
    const ts = nowIso();
    const all = loadMasterHabits();
    const idx = all.findIndex((h) => h.id === id);
    if (idx >= 0) {
      const tomb = { ...(all[idx] as any), deleted_at: ts, updated_at: ts };
      all[idx] = tomb as HabitMaster;
      saveMasterHabits(all);
      try {
        queueMasterUpsert(tomb as any);
      } catch {}
    }
    setHabits(all.filter((h: any) => !h?.deleted_at));
  }

  return (
    <div className="bg-white">
      <SubHeaderTabs
        tabs={[
          { href: '/programas', label: 'Programas' },
          { href: '/herramientas', label: 'Herramientas' },
          { href: '/programas/crear', label: 'Crear programa' },
        ]}
      />
      <main className="container mx-auto px-4 py-6">
        <h2 className="page-title mb-3">Crear programa</h2>
        <p className="muted mb-6 text-black/70">
          Crea tus propios hábitos y programas personalizados para que aparezcan
          en <span className="font-semibold">Mi actividad</span>.
        </p>

        {/* Barra (+) Crear hábito */}
        <CreateHabitBar onClick={() => setOpenSelector(true)} />

        {/* Modal selector de tipo de hábito */}
        <Modal
          open={openSelector}
          onClose={() => setOpenSelector(false)}
          title="¿Qué tipo de hábito quieres crear?"
        >
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
          onClose={() => {
            setOpenForm(false);
            setEditTarget(null);
          }}
          title={editTarget ? 'Editar hábito' : 'Crear hábito'}
        >
          <HabitForm
            mode={editTarget ? 'edit' : 'create'}
            presetKey={formPreset}
            initial={editTarget ?? undefined}
            onCancel={() => {
              setOpenForm(false);
              setEditTarget(null);
            }}
            onSave={handleCreateOrUpdate}
          />
        </Modal>

        {/* Hábitos creados */}
        <section className="mt-8">
          <h3 className="mb-3 text-base font-semibold">Hábitos creados</h3>

          {habits.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Todavía no has creado ningún hábito. Empieza con el botón de arriba.
            </p>
          ) : (
            <div className="space-y-3">
              {habits.map((h) => {
                const label =
                  (h as any).name ??
                  (h as any).title ??
                  (h as any).label ??
                  'Hábito';
                const icon =
                  (h as any).icon ??
                  (h as any).emoji ??
                  '✨';

                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{icon}</span>
                      <span className="text-[15px] font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(h)}
                        className="text-sm underline text-black/70 hover:text-black"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white hover:bg-black/5 active:scale-95 transition"
                        aria-label="Eliminar hábito"
                      >
                        <Trash2 className="h-4 w-4 text-black/70" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
