'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { RotateCcw, CheckCircle2, XCircle } from 'lucide-react';

type JsonTask = { id?: string; label: string; detail?: string; tags?: string[] };
type JsonDay = { day: number; tasks: JsonTask[] };
type ProgramJson = {
  slug: string;
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  days: JsonDay[];
};

type DayProgressV2 = Record<number, Record<string, boolean>>; // day -> (taskId -> done)
type ActiveProgram = {
  startedAt: string; // YYYY-MM-DD
  progress: DayProgressV2;
};

const LS_ACTIVE = 'akira_programs_active_v1';

// Mapeo de loaders JSON (tu archivo actual)
const DATA_LOADERS: Record<string, () => Promise<ProgramJson>> = {
  'lectura-30': async () => {
    const m = await import('@/data/programs/lectura-30.json');
    return (m as any).default ?? (m as any);
  },
};

function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO + 'T00:00:00');
  const b = new Date(bISO + 'T00:00:00');
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
function loadActive(): Record<string, ActiveProgram> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_ACTIVE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveActive(obj: Record<string, ActiveProgram>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_ACTIVE, JSON.stringify(obj));
}

type Props = {
  /** Clave del data JSON, en tu caso: 'lectura-30' */
  slug: string;
  imageSrc?: string;
  title: string;
  shortDescription: string;
  howItWorks: string;
};

export default function ProgramDetail({
  slug,
  imageSrc,
  title,
  shortDescription,
  howItWorks,
}: Props) {
  const [data, setData] = useState<ProgramJson | null>(null);
  const [activeMap, setActiveMap] = useState<Record<string, ActiveProgram>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  // cargar JSON
  useEffect(() => {
    const loader = DATA_LOADERS[slug];
    if (!loader) return;
    loader().then(setData).catch(() => setData(null));
  }, [slug]);

  // cargar progreso
  useEffect(() => {
    setActiveMap(loadActive());
  }, []);

  const active = activeMap[slug] ?? null;
  const totalDays = useMemo(
    () => data?.durationDays ?? data?.days?.length ?? 0,
    [data]
  );

  // Día actual por fecha (1..totalDays)
  const currentDay = useMemo(() => {
    if (!active?.startedAt || totalDays <= 0) return 1;
    const delta = daysBetween(active.startedAt, todayKey()); // 0=primer día
    return Math.min(totalDays, Math.max(1, delta + 1));
  }, [active?.startedAt, totalDays]);

  // Datos del día actual
  const dayData = useMemo(() => {
    if (!data || totalDays === 0) return null;
    // el JSON ya trae "day": n, pero usamos índice seguro:
    return data.days.find((d) => d.day === currentDay) ?? data.days[currentDay - 1] ?? null;
  }, [data, currentDay, totalDays]);

  const tasks: JsonTask[] = dayData?.tasks ?? [];

  /** Lee (y migra si hace falta) el progreso del día actual como mapa taskId->done */
  function getDayProgressMap(): Record<string, boolean> {
    const entry = activeMap[slug];
    if (!entry) return {};
    const raw = entry.progress?.[currentDay] as any;
    if (!raw) return {};
    // Si fuera un array antiguo [true,false,...], migramos a por-id
    if (Array.isArray(raw)) {
      const migrated: Record<string, boolean> = {};
      tasks.forEach((t, i) => {
        const id = t.id ?? `task_${i}`;
        migrated[id] = Boolean(raw[i]);
      });
      // guardar migración
      const next = { ...activeMap };
      next[slug] = {
        ...entry,
        progress: { ...entry.progress, [currentDay]: migrated },
      };
      saveActive(next);
      setActiveMap(next);
      return migrated;
    }
    return raw as Record<string, boolean>;
  }

  const dayProgressMap = getDayProgressMap();

  // Progreso % por días transcurridos (como pediste)
  const progressPct = useMemo(() => {
    if (!active?.startedAt || totalDays === 0) return 0;
    const passed = Math.min(
      totalDays,
      Math.max(0, daysBetween(active.startedAt, todayKey()) + 1)
    );
    return Math.round((passed / totalDays) * 100);
  }, [active?.startedAt, totalDays]);

  function startProgram() {
    const next = { ...activeMap };
    if (!next[slug]) {
      next[slug] = { startedAt: todayKey(), progress: {} };
      saveActive(next);
      setActiveMap(next);
    }
  }

  function requestReset() {
    setConfirmOpen(true);
  }
  function confirmReset() {
    const next = { ...activeMap, [slug]: { startedAt: todayKey(), progress: {} } };
    saveActive(next);
    setActiveMap(next);
    setConfirmOpen(false);
  }
  function cancelReset() {
    setConfirmOpen(false);
  }

  function toggleTask(task: JsonTask, index: number) {
    const taskId = task.id ?? `task_${index}`;
    const entry = activeMap[slug] ?? { startedAt: todayKey(), progress: {} };
    const prevMap: Record<string, boolean> =
      (Array.isArray(entry.progress[currentDay])
        ? {} // si estuviera viejo array, partimos de limpio (migrará arriba)
        : entry.progress[currentDay]) || {};
    const nextMap = { ...prevMap, [taskId]: !prevMap[taskId] };
    const next = {
      ...activeMap,
      [slug]: {
        startedAt: entry.startedAt,
        progress: { ...entry.progress, [currentDay]: nextMap },
      },
    };
    saveActive(next);
    setActiveMap(next);
  }

  const started = Boolean(active?.startedAt);

  return (
    <div className="px-4 pb-24 pt-4 bg-white">
      {/* Hero */}
      {imageSrc && (
        <div className="w-full overflow-hidden rounded-2xl mb-4">
          <Image
            src={imageSrc}
            alt={title}
            width={1600}
            height={900}
            className="w-full h-48 object-cover"
            priority
          />
        </div>
      )}

      {/* Título y copy */}
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-neutral-600 mt-2 text-[15px] leading-relaxed">
        {shortDescription}
      </p>

      <div className="mt-4 p-4 rounded-2xl border border-neutral-200 bg-white">
        <h2 className="font-medium">Cómo funciona</h2>
        <p className="text-[14px] text-neutral-600 mt-1 leading-relaxed">
          {howItWorks}
        </p>
      </div>

      {/* CTA / Controles */}
      <div className="mt-4 flex items-center gap-2">
        {!started ? (
          <button
            onClick={startProgram}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-black text-white active:scale-[0.98] transition"
          >
            Comenzar programa
          </button>
        ) : (
          <button
            onClick={requestReset}
            className="inline-flex items-center gap-2 justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-red-600 text-white active:scale-[0.98] transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar programa
          </button>
        )}
      </div>

      {/* Modal confirmación reinicio */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg">
            <h3 className="text-lg font-semibold">¿Estás seguro?</h3>
            <p className="text-sm text-neutral-600 mt-2">
              ¿Estás seguro de reiniciar el programa? Esto borrará todos los
              avances hechos hasta ahora.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={cancelReset}
                className="rounded-xl border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReset}
                className="rounded-xl bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progreso + Tareas del día (si hay data y está iniciado) */}
      {started && totalDays > 0 && (
        <>
          {/* Barra de progreso (por días transcurridos) */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                Progreso: Día {currentDay} / {totalDays}
              </div>
              <div className="text-sm text-neutral-500">{progressPct}%</div>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
              <div
                className="h-full bg-black transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Tabla simple del Día actual + tareas */}
          <div className="mt-6">
            <div className="text-[15px] font-semibold mb-2">
              Día {currentDay}
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No hay tareas definidas para este día.
              </p>
            ) : (
              <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 overflow-hidden">
                {tasks.map((t, i) => {
                  const id = t.id ?? `task_${i}`;
                  const done = Boolean(dayProgressMap[id]);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleTask(t, i)}
                      className="w-full text-left bg-white hover:bg-neutral-50 active:scale-[0.995] transition"
                    >
                      <div className="flex items-start gap-3 px-4 py-3">
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="text-[15px]">{t.label}</div>
                          {t.detail && (
                            <div className="text-[13px] text-neutral-600 mt-0.5">
                              {t.detail}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-neutral-500 mt-2">
              * Marca cada tarea al completarla. El plan se revela día a día.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
