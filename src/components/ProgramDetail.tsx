// src/components/ProgramDetail.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  RotateCcw,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  X,
} from 'lucide-react';

type JsonTask = { id?: string; label: string; detail?: string; tags?: string[] };
type JsonDay = { day: number; tasks: JsonTask[] };
type ProgramJson = {
  slug: string;
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  accordions?: {
    whatYouWillDo?: string[];
    whatYouWillGet?: string[];
    howToUse?: string[];
  };
  days: JsonDay[];
};

type DayProgressV2 = Record<number, Record<string, boolean>>;
type ActiveProgram = { startedAt: string; progress: DayProgressV2 };

const LS_ACTIVE = 'akira_programs_active_v1';
const LS_ACTIVE_COMPAT = 'akira_program_active'; // usado por ProgramService/Mi Zona

const DATA_LOADERS: Record<string, () => Promise<ProgramJson>> = {
  'lectura-30': async () => {
    const m = await import('@/data/programs/lectura-30.json');
    return (m as any).default ?? (m as any);
  },
  'detox-tecnologico-30': async () => {
    const m = await import('@/data/programs/detox-tecnologico-30.json');
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
  slug: string;
  imageSrc?: string;
  title: string;
  shortDescription: string; // se oculta en esta vista
  howItWorks: string;
};

export default function ProgramDetail({
  slug,
  imageSrc,
  title,
  shortDescription: _shortDescription, // oculto aquí
  howItWorks,
}: Props) {
  const router = useRouter();

  const [data, setData] = useState<ProgramJson | null>(null);
  const [activeMap, setActiveMap] = useState<Record<string, ActiveProgram>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [openAcc, setOpenAcc] = useState<{ do: boolean; get: boolean; use: boolean }>({
    do: false,
    get: false,
    use: false,
  });
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loader = DATA_LOADERS[slug];
    if (!loader) return;
    loader()
      .then((payload) => {
        setData(payload);
        setOpenAcc({ do: false, get: false, use: false });
        setOpenTasks({});
      })
      .catch(() => setData(null));
  }, [slug]);

  useEffect(() => {
    setActiveMap(loadActive());
  }, []);

  const active = activeMap[slug] ?? null;
  const started = Boolean(active?.startedAt);

  const totalDays = useMemo(
    () => data?.durationDays ?? data?.days?.length ?? 0,
    [data]
  );

  const currentDay = useMemo(() => {
    if (!active?.startedAt || totalDays <= 0) return 1;
    const delta = daysBetween(active.startedAt, todayKey());
    return Math.min(totalDays, Math.max(1, delta + 1));
  }, [active?.startedAt, totalDays]);

  const [viewedDay, setViewedDay] = useState<number>(1);
  useEffect(() => {
    setViewedDay(currentDay || 1);
  }, [currentDay]);

  const dayData = useMemo(() => {
    if (!data || totalDays === 0) return null;
    return data.days.find((d) => d.day === viewedDay) ?? data.days[viewedDay - 1] ?? null;
  }, [data, viewedDay, totalDays]);

  const tasks: JsonTask[] = dayData?.tasks ?? [];

  function getDayProgressMap(dayNum: number): Record<string, boolean> {
    const entry = activeMap[slug];
    if (!entry) return {};
    const raw = entry.progress?.[dayNum] as any;
    if (!raw) return {};
    if (Array.isArray(raw)) {
      const migrated: Record<string, boolean> = {};
      const dayTasks =
        data?.days.find((d) => d.day === dayNum)?.tasks ?? data?.days[dayNum - 1]?.tasks ?? [];
      dayTasks.forEach((t, i) => {
        const id = t.id ?? `task_${i}`;
        migrated[id] = Boolean(raw[i]);
      });
      const next = { ...activeMap };
      next[slug] = { ...entry, progress: { ...entry.progress, [dayNum]: migrated } };
      saveActive(next);
      setActiveMap(next);
      return migrated;
    }
    return raw as Record<string, boolean>;
  }
  const dayProgressMap = getDayProgressMap(viewedDay);

  const progressPct = useMemo(() => {
    if (!active?.startedAt || totalDays === 0) return 0;
    const passed = Math.min(totalDays, Math.max(0, daysBetween(active.startedAt, todayKey()) + 1));
    return Math.round((passed / totalDays) * 100);
  }, [active?.startedAt, totalDays]);

  function startProgram() {
    setActiveMap((prev) => {
      const next = { ...prev, [slug]: { startedAt: todayKey(), progress: {} } };
      saveActive(next);
      // mantener compat limpio
      try { localStorage.removeItem(LS_ACTIVE_COMPAT); } catch {}
      return next;
    });
  }

  function requestReset() {
    setConfirmOpen(true);
  }
  function confirmReset() {
    // Reinicia desde hoy y limpia cualquier caché compatible
    setActiveMap((prev) => {
      const next = { ...prev, [slug]: { startedAt: todayKey(), progress: {} } };
      saveActive(next);
      try { localStorage.removeItem(LS_ACTIVE_COMPAT); } catch {}
      return next;
    });
    setOpenTasks({});
    setViewedDay(1);
    setConfirmOpen(false);
  }
  function cancelReset() {
    setConfirmOpen(false);
  }

  function toggleTaskOpen(task: JsonTask, index: number) {
    const taskId = task.id ?? `task_${index}`;
    setOpenTasks((p) => ({ ...p, [taskId]: !p[taskId] }));
  }

  const ARow: React.FC<{ label: string; open: boolean; onClick: () => void }> = ({
    label,
    open,
    onClick,
  }) => (
    <button onClick={onClick} className="w-full flex items-center justify-between py-3" aria-expanded={open}>
      <span className="text-[15px] font-medium">{label}</span>
      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="px-4 pb-24 pt-4 bg-white">
      {/* Top bar: botón Volver */}
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={() => { try { router.back(); } catch { location.href = '/habitos'; } }}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50"
        >
          Volver
        </button>
      </div>

      {/* Hero 16:9 full-bleed */}
      {imageSrc && (
        <div className="-mx-4 mb-4">
          <div className="relative w-full aspect-[16/9]">
            <Image src={imageSrc} alt={title} fill className="object-cover" priority />
          </div>
        </div>
      )}

      {/* Título y chip */}
      <h1 className="text-2xl font-semibold">{title}</h1>
      {data?.durationDays ? (
        <div className="mt-1 inline-flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
            Duración: {data.durationDays} días
          </span>
        </div>
      ) : null}

      {/* Introducción (sin borde ni título) */}
      <div className="mt-2">
        <p className="text-[14px] text-neutral-700 mt-1 leading-relaxed">{howItWorks}</p>

        {(data?.accordions?.whatYouWillDo?.length ||
          data?.accordions?.whatYouWillGet?.length ||
          data?.accordions?.howToUse?.length) && (
          <div className="mt-3 divide-y divide-neutral-200">
            {data?.accordions?.whatYouWillDo?.length ? (
              <div className="py-2">
                <ARow label="¿Qué vas a hacer?" open={openAcc.do} onClick={() => setOpenAcc((s) => ({ ...s, do: !s.do }))} />
                {openAcc.do && (
                  <ul className="pl-4 list-disc text-[14px] text-neutral-700 space-y-1">
                    {data!.accordions!.whatYouWillDo!.map((li, i) => <li key={`do_${i}`}>{li}</li>)}
                  </ul>
                )}
              </div>
            ) : null}

            {data?.accordions?.whatYouWillGet?.length ? (
              <div className="py-2">
                <ARow label="¿Qué vas a conseguir?" open={openAcc.get} onClick={() => setOpenAcc((s) => ({ ...s, get: !s.get }))} />
                {openAcc.get && (
                  <ul className="pl-4 list-disc text-[14px] text-neutral-700 space-y-1">
                    {data!.accordions!.whatYouWillGet!.map((li, i) => <li key={`get_${i}`}>{li}</li>)}
                  </ul>
                )}
              </div>
            ) : null}

            {data?.accordions?.howToUse?.length ? (
              <div className="py-2">
                <ARow label="¿Cómo se usa?" open={openAcc.use} onClick={() => setOpenAcc((s) => ({ ...s, use: !s.use }))} />
                {openAcc.use && (
                  <ul className="pl-4 list-disc text-[14px] text-neutral-700 space-y-1">
                    {data!.accordions!.howToUse!.map((li, i) => <li key={`use_${i}`}>{li}</li>)}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-4 flex items-center gap-2">
        {!started ? (
          <button
            onClick={startProgram}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-black text-white active:scale-[0.98] transition"
          >
            Empezar programa
          </button>
        ) : (
          <button
            onClick={requestReset}
            className="inline-flex items-center gap-2 justify-center rounded-xl px-3 py-2 text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition"
            title="Reiniciar programa"
          >
            <RotateCcw className="w-4 h-4" />
            Reiniciar
          </button>
        )}
      </div>

      {/* Modal confirmación reinicio */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg">
            <h3 className="text-lg font-semibold">¿Estás seguro?</h3>
            <p className="text-sm text-neutral-600 mt-2">Esto borrará todos los avances hechos hasta ahora.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={cancelReset} className="rounded-xl border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50">Cancelar</button>
              <button onClick={confirmReset} className="rounded-xl bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700">Reiniciar</button>
            </div>
          </div>
        </div>
      )}

      {/* Progreso + Navegación: solo si iniciado */}
      {started && data && totalDays > 0 && (
        <>
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Progreso: Día {Math.min(currentDay, totalDays)} / {totalDays}</div>
              <div className="text-sm text-neutral-500">{progressPct}%</div>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
              <div className="h-full bg-black transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setViewedDay((d) => Math.max(1, d - 1))}
              disabled={viewedDay <= 1}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${
                viewedDay <= 1 ? 'text-neutral-400 border-neutral-200 cursor-not-allowed' : 'text-neutral-700 border-neutral-300 hover:bg-neutral-50'
              }`}
              aria-label="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            <div className="text-[15px] font-semibold">Día {viewedDay}</div>

            <button
              onClick={() => setViewedDay((d) => Math.min(currentDay, d + 1))}
              disabled={viewedDay >= currentDay}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${
                viewedDay >= currentDay ? 'text-neutral-400 border-neutral-200 cursor-not-allowed' : 'text-neutral-700 border-neutral-300 hover:bg-neutral-50'
              }`}
              aria-label="Día siguiente"
              title={viewedDay >= currentDay ? 'El plan se revela día a día. Se desbloquea mañana.' : 'Ir al siguiente día'}
            >
              {viewedDay >= currentDay ? <>Bloqueado <Lock className="w-4 h-4" /></> : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </>
      )}

      {/* Lista de tareas: solo si iniciado */}
      {started && data && totalDays > 0 && (
        <div className="mt-3">
          {tasks.length === 0 ? (
            <div className="text-sm text-neutral-600 border border-dashed border-neutral-300 rounded-2xl p-4">
              Hoy desconectas de la app. Disfruta tu día sin móvil.
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
              {tasks.map((t, i) => {
                const id = t.id ?? `task_${i}`;
                const done = Boolean(dayProgressMap[id]);
                const isOpen = Boolean(openTasks[id]);
                return (
                  <div key={id} className="bg-white">
                    <div className="w-full text-left px-4 py-3 flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setInfoOpen(true)}
                        className="shrink-0 mt-0.5"
                        aria-label="Los checks se hacen en Mi Zona"
                        title="Los checks se hacen en Mi Zona"
                      >
                        {done ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5 text-neutral-400" />}
                      </button>

                      <div className="flex-1">
                        <div className="text-[15px]">{t.label}</div>
                        {t.detail && (
                          <button
                            onClick={() => toggleTaskOpen(t, i)}
                            className="mt-1 inline-flex items-center gap-1 text-[13px] text-neutral-700 hover:underline"
                          >
                            {isOpen ? <>Ocultar <ChevronUp className="w-3 h-3" /></> : <>Ver detalle <ChevronDown className="w-3 h-3" /></>}
                          </button>
                        )}
                        {t.detail && isOpen && (
                          <div className="text-[13px] text-neutral-600 mt-1">{t.detail}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-neutral-500 mt-2">
            * Los checks se hacen en <strong>Mi Zona</strong>. Aquí puedes revisar tu progreso. El plan se revela día a día.
          </p>
        </div>
      )}

      {/* Pop-up informativo */}
      {infoOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg relative">
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-neutral-100"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-[15px] text-neutral-800">
              Los checks se hacen en <strong>Mi Zona</strong>. Aquí puedes revisar tu progreso. El plan se revela día a día.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
