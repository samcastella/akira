'use client';

import type { FC } from 'react';
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
  Play,
} from 'lucide-react';

/* === Unificación almacenamiento local (programas activos) === */
import {
  loadActive,
  saveActive,
  migrateCompat,
  type LocalStore,
  type LocalProgram,
} from '@/lib/programsLocal';

/* === Sync con Supabase (write-through / pull) === */
import { pushStartProgram, pushResetProgram, pullUserPrograms } from '@/lib/programSync';

/* === Usuario (para saber si hay sesión antes de hacer pulls) === */
import { useAuthUserId } from '@/lib/user';

/* ✅ Realtime */
import { supabase } from '@/lib/supabaseClient';

/* === Puntuación (RPC helpers) === */
import {
  fetchProgramPoints,
  fetchProgramPointsByDay,
  type ProgramPointsTotals,
  type ProgramPointsByDayRow,
} from '@/lib/programService';

/* === UI barras estilo CreateHabitBar === */
import CreateHabitBar from '@/components/habits/CreateHabitBar';

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

/* === helpers fecha === */
function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function startOfDayMs(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function daysBetweenFromMs(startMs: number, endISOyyyyMmDd: string) {
  const a = startOfDayMs(new Date(startMs));
  const b = startOfDayMs(new Date(`${endISOyyyyMmDd}T00:00:00`));
  return Math.floor((b - a) / 86_400_000);
}

/* ---------- Mini-render Markdown seguro ---------- */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderLightMarkdown(input: string) {
  let html = escapeHtml(input ?? '');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}
const MD: FC<{ children: string; className?: string }> = ({ children, className }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: renderLightMarkdown(children) }} />
);

/* ===== Tabs ===== */
const TABS = ['Resumen', 'Check del día', 'Puntuación'] as const;
type Tab = typeof TABS[number];

/* ===== Colores por programa (para la barra) ===== */
const PROGRAM_COLORS: Record<string, string> = {
  'lectura-30': '#111111',
  'detox-tecnologico-30': '#0a7cff',
};

/* ===== Badge files por programa ===== */
const BADGE_FILES: Record<string, string> = {
  'lectura-30': '/images/badges/superlector.png',
  'detox-tecnologico-30': '/images/badges/detox-tecnologico.png',
};

type Props = {
  slug: string;
  imageSrc?: string;
  title: string;
  shortDescription: string; // oculto aquí
  howItWorks: string;
};

export default function ProgramDetail({
  slug,
  imageSrc,
  title,
  shortDescription: _shortDescription,
  howItWorks,
}: Props) {
  const router = useRouter();
  const uid = useAuthUserId();

  const [data, setData] = useState<ProgramJson | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [activeMap, setActiveMap] = useState<LocalStore>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  // modal detalle de tarea
  const [taskInfoOpen, setTaskInfoOpen] = useState<null | { label: string; detail?: string }>(null);

  const [openAcc, setOpenAcc] = useState<{ do: boolean; get: boolean; use: boolean }>({
    do: false,
    get: false,
    use: false,
  });
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({});

  // Estados de acción
  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');

  // Puntuación
  const [pointsTotals, setPointsTotals] = useState<ProgramPointsTotals | null>(null);
  const [pointsByDay, setPointsByDay] = useState<ProgramPointsByDayRow[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  // cargar JSON
  useEffect(() => {
    let cancelled = false;
    const loader = DATA_LOADERS[slug];
    setLoadingData(true);
    if (!loader) {
      if (!cancelled) {
        setData(null);
        setLoadingData(false);
      }
      return;
    }
    loader()
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setOpenAcc({ do: false, get: false, use: false });
        setOpenTasks({});
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // migrar legacy y cargar progreso + listeners
  useEffect(() => {
    migrateCompat();
    setActiveMap(loadActive());

    const onProgramsUpdated = () => setActiveMap(loadActive());
    window.addEventListener('storage', onProgramsUpdated);
    window.addEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    return () => {
      window.removeEventListener('storage', onProgramsUpdated);
      window.removeEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    };
  }, []);

  // pull al montar si uid
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!uid) return;
        await pullUserPrograms();
      } finally {
        if (!cancelled) setActiveMap(loadActive());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // rehidratar en foco/online
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const rehydrate = async () => {
      try {
        await pullUserPrograms();
      } catch {}
      if (!cancelled) setActiveMap(loadActive());
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') void rehydrate();
    };
    const onOnline = () => void rehydrate();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
  }, [uid]);

  /* ✅ Realtime */
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    const channel = supabase
      .channel(`rt-program-tasks-${slug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_program_tasks',
          filter: `user_id=eq.${uid}`,
        },
        async (payload: any) => {
          try {
            const row = (payload?.new ?? payload?.old) as { program_slug?: string } | undefined;
            if (!row || row.program_slug !== slug) return;
            await pullUserPrograms();
            if (!cancelled) setActiveMap(loadActive());
          } catch {}
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [uid, slug]);

  const active: LocalProgram | null = activeMap[slug] ?? null;
  const started = Boolean(active?.startedAt);

  // UX: si iniciado, arrancamos en "Check del día"
  useEffect(() => {
    setActiveTab(started ? 'Check del día' : 'Resumen');
  }, [started]);

  const totalDays = useMemo(() => data?.durationDays ?? data?.days?.length ?? 0, [data]);

  const currentDay = useMemo(() => {
    if (!active?.startedAt || totalDays <= 0) return 1;
    const delta = daysBetweenFromMs(active.startedAt, todayKey());
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

  // Progress shape: LocalProgram.progress → { [dayNum]: { [taskId]: boolean } }
  function getDayProgressMap(dayNum: number): Record<string, boolean> {
    const entry = activeMap[slug];
    if (!entry) return {};
    const raw = (entry.progress ?? {})[dayNum] as any;
    if (!raw) return {};
    if (Array.isArray(raw)) {
      // migración antigua
      const migrated: Record<string, boolean> = {};
      const dayTasks =
        data?.days.find((d) => d.day === dayNum)?.tasks ?? data?.days[dayNum - 1]?.tasks ?? [];
      dayTasks.forEach((t, i) => {
        const id = t.id ?? `task_${i}`;
        migrated[id] = Boolean(raw[i]);
      });

      const next: LocalStore = { ...activeMap };
      const lp: LocalProgram = {
        ...(entry as LocalProgram),
        progress: {
          ...(entry.progress ?? {}),
          [dayNum]: migrated,
        },
        updatedAt: Date.now(),
      };
      next[slug] = lp;
      saveActive(next);
      setActiveMap(next);
      return migrated;
    }
    return raw as Record<string, boolean>;
  }
  const dayProgressMap = getDayProgressMap(viewedDay);

  const progressPct = useMemo(() => {
    if (!active?.startedAt || totalDays === 0) return 0;
    const passed = Math.min(totalDays, Math.max(0, daysBetweenFromMs(active.startedAt, todayKey()) + 1));
    return Math.round((passed / totalDays) * 100);
  }, [active?.startedAt, totalDays]);

  /* ======== Acciones ======== */
  async function handleStartProgram() {
    setErrorMsg(null);
    setStarting(true);
    try {
      await pushStartProgram(slug);
      await pullUserPrograms();
      setActiveMap(loadActive());
    } catch (e: any) {
      console.error('[ProgramDetail] pushStartProgram error', e);
      setErrorMsg('No se pudo iniciar el programa. Inténtalo de nuevo.');
    } finally {
      setStarting(false);
    }
  }

  function requestReset() {
    setConfirmOpen(true);
  }
  async function confirmReset() {
    setErrorMsg(null);
    setResetting(true);
    try {
      await pushResetProgram(slug, { deleteTasks: true });
      await pullUserPrograms();
      setActiveMap(loadActive());
      setOpenTasks({});
      setViewedDay(1);
      setConfirmOpen(false);
    } catch (e: any) {
      console.error('[ProgramDetail] pushResetProgram error', e);
      setErrorMsg('No se pudo reiniciar el programa. Inténtalo de nuevo.');
    } finally {
      setResetting(false);
    }
  }
  function cancelReset() {
    setConfirmOpen(false);
  }

  /** Marcar/Desmarcar un check dentro del programa (optimista + write-through) */
  async function toggleTaskDone(dayNum: number, taskId: string) {
    // Estado actual
    const prev = Boolean((getDayProgressMap(dayNum) as any)[taskId]);
    const next = !prev;

    // 1) Actualiza LOCAL optimista
    const entry = activeMap[slug];
    const progress = { ...(entry?.progress ?? {}) };
    const mapForDay = { ...(progress[dayNum] as any || {}) };
    mapForDay[taskId] = next;
    progress[dayNum] = mapForDay;

    const updated: LocalProgram = {
      ...(entry as LocalProgram),
      startedAt: entry?.startedAt ?? Date.now(),
      progress,
      updatedAt: Date.now(),
    };

    const newStore: LocalStore = { ...activeMap, [slug]: updated };
    saveActive(newStore);
    setActiveMap(newStore);

    // 2) Confeti si se marca
    if (next) {
      try { window.dispatchEvent(new CustomEvent('akira:celebrate')); } catch {}
    }

    // 3) Persistencia remota (best-effort)
    try {
      if (!uid) return;
      await supabase.from('user_program_tasks').upsert({
        user_id: uid,
        program_slug: slug,
        day_index: dayNum,
        task_id: taskId,
        done: next,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,program_slug,day_index,task_id' as any });
    } catch (e) {
      // si falla, dejamos el local tal cual y ya se rehidratará al volver a foco
      console.warn('[toggleTaskDone] upsert fallo', e);
    }
  }

  /* ====== Carga de puntuación si iniciado ====== */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid || !started) {
        setPointsTotals(null);
        setPointsByDay([]);
        return;
      }
      setLoadingPoints(true);
      try {
        const [tot, byDay] = await Promise.all([
          fetchProgramPoints(uid, slug),
          fetchProgramPointsByDay(uid, slug),
        ]);
        if (!alive) return;
        setPointsTotals(tot);
        setPointsByDay(byDay);
      } catch {
        if (!alive) return;
        setPointsTotals(null);
        setPointsByDay([]);
      } finally {
        if (alive) setLoadingPoints(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, slug, started]);

  /* ===== Render ===== */
  if (!loadingData && !data) {
    return (
      <div className="px-4 pb-24 bg-white">
        <div className="py-10 text-center text-sm text-neutral-600">
          Este programa todavía no está disponible.
        </div>
      </div>
    );
  }

  const programColor = PROGRAM_COLORS[slug] ?? '#111111';
  const badgeSrc = BADGE_FILES[slug] ?? '/images/badges/generic-badge.png';

  return (
    <div className="px-4 pb-24 bg-white">
      {/* Hero */}
      {imageSrc && (
        <div className="-mx-4 mb-5 relative">
          <div className="relative w-full aspect-[16/9]">
            <Image src={imageSrc} alt={title} fill className="object-cover" priority />
          </div>
          <div className="absolute top-3 right-3">
            <button
              onClick={() => {
                try {
                  router.back();
                } catch {
                  location.href = '/habitos';
                }
              }}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-full border border-neutral-300 bg-white/85 backdrop-blur-md shadow-md hover:bg-white active:scale-[0.98]"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Título */}
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      {data?.durationDays ? (
        <div className="mt-1 inline-flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
            Duración: {data.durationDays} días
          </span>
        </div>
      ) : null}

      {/* CTA */}
      <div className="mt-4">
        {errorMsg && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {errorMsg}
          </div>
        )}
        {!loadingData && (
          <div className="mt-2 flex items-center gap-2">
            {!started ? (
              <button
                onClick={handleStartProgram}
                disabled={starting || loadingData || !uid}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold bg-black text-white shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                {starting ? 'Iniciando…' : 'Empezar programa'}
              </button>
            ) : (
              <button
                onClick={requestReset}
                disabled={resetting || !uid}
                className="inline-flex items-center gap-2 justify-center rounded-xl px-3.5 py-2.5 text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                title="Reiniciar programa"
              >
                <RotateCcw className="w-4 h-4" />
                {resetting ? 'Reiniciando…' : 'Reiniciar'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* TABS */}
      <nav className="border-b bg-white sticky top-[48px] z-10 -mt-px mt-6">
        <div className="container mx-auto flex justify-between px-0 overflow-x-auto">
          {TABS.map((tab) => {
            const locked = (tab === 'Check del día' || tab === 'Puntuación') && !started;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative py-3 px-3 text-sm whitespace-nowrap transition ${
                  isActive
                    ? 'font-semibold text-black after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[2px] after:bg-black'
                    : 'text-neutral-500 hover:text-black'
                } ${locked ? 'opacity-60' : ''}`}
                title={locked ? 'Bloqueado hasta que empieces el programa' : tab}
              >
                {tab}
                {locked && <Lock className="inline ml-1 h-4 w-4 align-text-bottom" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* CONTENIDO */}
      <section className="container mx-auto px-0 py-6 space-y-6">
        {/* ===== Resumen ===== */}
        {activeTab === 'Resumen' && (
          <>
            {!loadingData && (
              <div className="space-y-4">
                {howItWorks ? (
                  <MD className="text-[13px] text-neutral-800 leading-relaxed">{howItWorks}</MD>
                ) : null}

                {(data?.accordions?.whatYouWillDo?.length ||
                  data?.accordions?.whatYouWillGet?.length ||
                  data?.accordions?.howToUse?.length) && (
                  <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
                    {data?.accordions?.whatYouWillDo?.length ? (
                      <div className="p-4">
                        <ARow
                          label="¿Qué vas a hacer?"
                          open={openAcc.do}
                          onClick={() => setOpenAcc((s) => ({ ...s, do: !s.do }))}
                        />
                        {openAcc.do && (
                          <ul className="pl-4 list-disc text-[13px] text-neutral-800 space-y-1">
                            {data!.accordions!.whatYouWillDo!.map((li, i) => (
                              <li key={`do_${i}`}>
                                <MD className="text-[13px] leading-relaxed">{li}</MD>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}

                    {data?.accordions?.whatYouWillGet?.length ? (
                      <div className="p-4">
                        <ARow
                          label="¿Qué vas a conseguir?"
                          open={openAcc.get}
                          onClick={() => setOpenAcc((s) => ({ ...s, get: !s.get }))}
                        />
                        {openAcc.get && (
                          <ul className="pl-4 list-disc text-[14px] text-neutral-900 space-y-1">
                            {data!.accordions!.whatYouWillGet!.map((li, i) => (
                              <li key={`get_${i}`}>
                                <MD className="text-[14px] leading-relaxed">{li}</MD>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}

                    {data?.accordions?.howToUse?.length ? (
                      <div className="p-4">
                        <ARow
                          label="¿Cómo se usa?"
                          open={openAcc.use}
                          onClick={() => setOpenAcc((s) => ({ ...s, use: !s.use }))}
                        />
                        {openAcc.use && (
                          <ul className="pl-4 list-disc text-[13px] text-neutral-800 space-y-1">
                            {data!.accordions!.howToUse!.map((li, i) => (
                              <li key={`use_${i}`}>
                                <MD className="text-[13px] leading-relaxed">{li}</MD>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {started && totalDays > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">
                        Progreso: Día {Math.min(currentDay, totalDays)} / {totalDays}
                      </div>
                      <div className="text-sm text-neutral-500">{progressPct}%</div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                      <div className="h-full bg-black transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                )}

                <p className="text-xs text-neutral-500">
                  * El plan se revela día a día. Los checks se realizan en <strong>Mi Zona</strong>.
                </p>
              </div>
            )}
          </>
        )}

        {/* ===== Check del día ===== */}
        {activeTab === 'Check del día' && (
          <>
            {!started && (
              <div className="rounded-2xl border p-4 bg-neutral-50 text-neutral-600" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2 font-medium mb-2">
                  <Lock className="h-4 w-4" />
                  Bloqueado hasta empezar el programa
                </div>
                <p className="text-sm mb-3">Puedes ver un ejemplo del <strong>Día 1</strong> (lectura en gris):</p>
                <div className="opacity-60 pointer-events-none">
                  <PreviewDayOne data={data} />
                </div>
              </div>
            )}

            {started && data && totalDays > 0 && (
              <>
                <p className="text-sm text-neutral-700">
                  <strong>Estos son los retos que tienes que completar hoy</strong>, cuando los hayas hecho márcalos para ver tu progreso en este programa.
                </p>

                {/* Progreso simple */}
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full bg-black transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                {/* Navegación por días */}
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setViewedDay((d) => Math.max(1, d - 1))}
                    disabled={viewedDay <= 1}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${
                      viewedDay <= 1
                        ? 'text-neutral-400 border-neutral-200 cursor-not-allowed'
                        : 'text-neutral-700 border-neutral-300 hover:bg-neutral-50'
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
                      viewedDay >= currentDay
                        ? 'text-neutral-400 border-neutral-200 cursor-not-allowed'
                        : 'text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                    }`}
                    aria-label="Día siguiente"
                    title={
                      viewedDay >= currentDay
                        ? 'El plan se revela día a día. Se desbloquea mañana.'
                        : 'Ir al siguiente día'
                    }
                  >
                    {viewedDay >= currentDay ? (
                      <>Bloqueado <Lock className="w-4 h-4" /></>
                    ) : (
                      <>Siguiente <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>

                {/* Lista de tareas como barras CreateHabitBar (marcables aquí) */}
                <TaskBarsList
                  tasks={tasks}
                  day={viewedDay}
                  dayProgressMap={dayProgressMap}
                  programColor={programColor}
                  onOpenInfo={(payload) => setTaskInfoOpen(payload)}
                  onToggle={(taskId) => toggleTaskDone(viewedDay, taskId)}
                />
              </>
            )}
          </>
        )}

        {/* ===== Puntuación ===== */}
        {activeTab === 'Puntuación' && (
          <>
            {!started && (
              <div className="rounded-2xl border p-4 bg-neutral-50 text-neutral-600" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2 font-medium">
                  <Lock className="h-4 w-4" />
                  Bloqueado hasta empezar el programa
                </div>
                <p className="text-sm mt-2">Cuando inicies, verás tus puntos: <b>+5</b> por check y <b>+10</b> por día completo.</p>
              </div>
            )}

            {started && (
              <div className="space-y-6">
                {/* Cabecera tipo "Actividad" */}
                <div className="text-center">
                  <div className="text-[56px] leading-none font-extrabold tabular-nums">
                    {pointsTotals?.total_points ?? 0}
                  </div>
                  <div className="text-sm text-neutral-600 mt-1">Puntos ganados con este programa</div>
                  <div className="mt-4 text-lg font-semibold">
                    {pointsTotals?.days_completed ?? 0} días completando tus retos
                  </div>
                </div>

                {/* Reglas */}
                <div className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'var(--line)' }}>
                  <div className="text-sm font-semibold mb-2">Reglas de puntuación</div>
                  <ul className="text-sm text-neutral-700 list-disc pl-5 space-y-1">
                    <li><b>+5</b> puntos por cada check completado.</li>
                    <li><b>+10</b> puntos por completar <i>todas</i> las tareas del día.</li>
                  </ul>
                </div>

                {/* Desglose por día */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
                  <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Desglose por día</div>
                  {loadingPoints ? (
                    <div className="p-4">
                      <div className="animate-pulse space-y-2">
                        <div className="h-3 w-full bg-neutral-200 rounded" />
                        <div className="h-3 w-5/6 bg-neutral-200 rounded" />
                        <div className="h-3 w-4/6 bg-neutral-200 rounded" />
                      </div>
                    </div>
                  ) : pointsByDay.length === 0 ? (
                    <div className="p-4 text-sm text-neutral-500">Sin datos aún.</div>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {pointsByDay.map((r) => (
                        <li key={r.day_index} className="px-4 py-3 text-sm flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="font-medium">Día {r.day_index}</div>
                            <div className="text-[12px] text-neutral-600">
                              {r.tasks_done}/{r.tasks_total} checks — {r.day_completed ? 'Completo (+10)' : 'Parcial'}
                            </div>
                          </div>
                          <div className="font-semibold tabular-nums">{r.day_points} pts</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Divider */}
                <hr className="border-neutral-200" />

                {/* Insignia */}
                <div className="rounded-2xl border p-4 bg-white flex items-center gap-4" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold">Insignia</div>
                    <p className="text-sm text-neutral-600">
                      Consigue esta insignia al completar el reto (deberás haber completado el <b>90%</b> de los retos).
                    </p>
                  </div>
                  <div className="w-24 h-24 relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
                    <Image
                      src={badgeSrc}
                      alt="Insignia del programa"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Modal confirmación reinicio */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg">
            <h3 className="text-lg font-semibold">¿Estás seguro?</h3>
            <p className="text-sm text-neutral-600 mt-2">Esto dejará el programa como no iniciado.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={cancelReset}
                className="rounded-xl border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReset}
                disabled={resetting || !uid}
                className="rounded-xl bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resetting ? 'Reiniciando…' : 'Reiniciar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up detalle de reto */}
      {taskInfoOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg relative">
            <button
              onClick={() => setTaskInfoOpen(null)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-neutral-100"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="text-[15px] font-semibold text-neutral-900">{taskInfoOpen.label}</h4>
            {taskInfoOpen.detail ? (
              <MD className="block mt-2 text-[13px] text-neutral-700">{taskInfoOpen.detail}</MD>
            ) : (
              <p className="mt-2 text-[13px] text-neutral-600">Sin descripción adicional.</p>
            )}
            <p className="mt-4 text-xs text-neutral-500">
              * Los checks se hacen en <strong>Mi Zona</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======= Subcomponentes ======= */

function TaskBarsList({
  tasks,
  day,
  dayProgressMap,
  programColor,
  onOpenInfo,
  onToggle,
}: {
  tasks: JsonTask[];
  day: number;
  dayProgressMap: Record<string, boolean>;
  programColor: string;
  onOpenInfo: (payload: { label: string; detail?: string }) => void;
  onToggle: (taskId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="text-sm text-neutral-600 border border-dashed border-neutral-300 rounded-2xl p-4">
        Hoy desconectas de la app. Disfruta tu día sin móvil.
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4">
      {tasks.map((t, i) => {
        const id = t.id ?? `task_${i}`;
        const done = Boolean((dayProgressMap as any)[id]);
        return (
          <CreateHabitBar
            key={`${day}_${id}`}
            variant="task"
            label={t.label}
            checked={done}
            color={programColor}
            onToggle={() => onToggle(id)}
            onInfo={() => onOpenInfo({ label: t.label, detail: t.detail })}
            ariaLabel={t.label}
          />
        );
      })}
    </div>
  );
}

function DayTasksList({
  tasks,
  dayProgressMap,
  openTasks,
  toggleTaskOpen,
}: {
  tasks: JsonTask[];
  dayProgressMap: Record<string, boolean>;
  openTasks: Record<string, boolean>;
  toggleTaskOpen: (t: JsonTask, i: number) => void;
}) {
  // (Se mantiene para el preview del Día 1 si no has empezado)
  return tasks.length === 0 ? (
    <div className="text-sm text-neutral-600 border border-dashed border-neutral-300 rounded-2xl p-4">
      Hoy desconectas de la app. Disfruta tu día sin móvil.
    </div>
  ) : (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
      {tasks.map((t, i) => {
        const id = t.id ?? `task_${i}`;
        const done = Boolean((dayProgressMap as any)[id]);
        const isOpen = Boolean(openTasks[id]);
        const detailId = `task_detail_${id}`;
        return (
          <div key={id} className="bg-white">
            <div className="w-full px-4 py-2">
              <div className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-neutral-400" />
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => toggleTaskOpen(t, i)}
                  aria-expanded={isOpen}
                  aria-controls={detailId}
                  className="flex-1 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-neutral-50 active:scale-[0.99] transition flex items-center justify-between"
                >
                  <span className="text-[15px] text-neutral-900">
                    <MD className="text-[15px]">{t.label}</MD>
                  </span>
                  {t.detail ? (
                    isOpen ? (
                      <ChevronUp className="w-4 h-4 shrink-0 text-neutral-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0 text-neutral-500" />
                    )
                  ) : null}
                </button>
              </div>
              {t.detail && isOpen && (
                <div id={detailId} className="mt-2 ml-9 pr-2">
                  <MD className="text-[13px] text-neutral-700">{t.detail}</MD>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewDayOne({ data }: { data: ProgramJson | null }) {
  const first = data?.days?.[0] ?? null;
  if (!first) {
    return (
      <div className="text-sm text-neutral-600 border border-dashed border-neutral-300 rounded-2xl p-4">
        Aún no hay contenido para el Día 1.
      </div>
    );
  }
  return (
    <DayTasksList
      tasks={first.tasks ?? []}
      dayProgressMap={{}}
      openTasks={{}}
      toggleTaskOpen={() => {}}
    />
  );
}

const ARow: FC<{ label: string; open: boolean; onClick: () => void }> = ({
  label,
  open,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between py-3"
    aria-expanded={open}
  >
    <span className="text-[15px] font-semibold text-neutral-900">{label}</span>
    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
  </button>
);
