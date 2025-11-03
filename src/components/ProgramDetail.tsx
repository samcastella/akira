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

/* ✅ IMPORT NECESARIO PARA REALTIME */
import { supabase } from '@/lib/supabaseClient';

/* === Puntuación (RPC helpers) === */
import {
  fetchProgramPoints,
  fetchProgramPointsByDay,
  type ProgramPointsTotals,
  type ProgramPointsByDayRow,
} from '@/lib/programService';

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

/* === fechas/helpers === */
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

/* ---------- Mini-render Markdown seguro (negrita/cursiva/line breaks) ---------- */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderLightMarkdown(input: string) {
  let html = escapeHtml(input ?? '');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // **bold**
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');             // *italic*
  html = html.replace(/\n/g, '<br/>');                           // line breaks
  return html;
}
const MD: FC<{ children: string; className?: string }> = ({ children, className }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: renderLightMarkdown(children) }} />
);

type Props = {
  slug: string;
  imageSrc?: string;
  title: string;
  shortDescription: string; // oculto en esta vista
  howItWorks: string;
};

/* ===== Tabs (como en Retos) ===== */
const TABS = ['Resumen', 'Check del día', 'Puntuación'] as const;
type Tab = typeof TABS[number];

export default function ProgramDetail({
  slug,
  imageSrc,
  title,
  shortDescription: _shortDescription,
  howItWorks,
}: Props) {
  const router = useRouter();
  const uid = useAuthUserId(); // ⬅️ saber si hay sesión

  const [data, setData] = useState<ProgramJson | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [activeMap, setActiveMap] = useState<LocalStore>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

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
    return () => { cancelled = true; };
  }, [slug]);

  // migrar legacy y cargar progreso unificado + subscribirse a cambios externos
  useEffect(() => {
    migrateCompat(); // idempotente
    setActiveMap(loadActive());

    const onProgramsUpdated = () => setActiveMap(loadActive());
    window.addEventListener('storage', onProgramsUpdated);
    window.addEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    return () => {
      window.removeEventListener('storage', onProgramsUpdated);
      window.removeEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    };
  }, []);

  // ⬇️ Al montar/uid listo, hidrata desde server (por si entramos directo desde enlace)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!uid) return;               // evita pull sin sesión
        await pullUserPrograms();       // DB → local
      } finally {
        if (!cancelled) setActiveMap(loadActive());
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  // ⬇️ Al volver a foco / online, rehidratar (puede haber cambios)
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const rehydrate = async () => {
      try { await pullUserPrograms(); } catch {}
      if (!cancelled) setActiveMap(loadActive());
    };
    const onVis = () => { if (document.visibilityState === 'visible') void rehydrate(); };
    const onOnline = () => void rehydrate();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
  }, [uid]);

  /* ✅ Realtime: escucha cambios de tareas del usuario y filtra por slug en el callback. */
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
          filter: `user_id=eq.${uid}`, // 👈 solo por user; filtramos slug abajo
        },
        async (payload: any) => {
          try {
            const row = (payload?.new ?? payload?.old) as { program_slug?: string } | undefined;
            if (!row || row.program_slug !== slug) return; // 👈 filtrado por programa
            await pullUserPrograms();                       // DB -> local
            if (!cancelled) setActiveMap(loadActive());     // refresca estado local
          } catch {}
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [uid, slug]);

  const active: LocalProgram | null = activeMap[slug] ?? null;
  const started = Boolean(active?.startedAt);

  // Si el usuario ha iniciado el programa, por UX abrimos "Check del día" por defecto
  useEffect(() => {
    setActiveTab(started ? 'Check del día' : 'Resumen');
  }, [started]);

  const totalDays = useMemo(
    () => data?.durationDays ?? data?.days?.length ?? 0,
    [data]
  );

  const currentDay = useMemo(() => {
    if (!active?.startedAt || totalDays <= 0) return 1;
    const delta = daysBetweenFromMs(active.startedAt, todayKey());
    // clamp a [1, totalDays]
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
      // migración antigua [bool,bool,...] → {taskId: bool}
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

  /* ======== Acciones con sync Supabase ======== */
  async function handleStartProgram() {
    setErrorMsg(null);
    setStarting(true);
    try {
      await pushStartProgram(slug);   // server
      await pullUserPrograms();       // rehidrata desde server
      setActiveMap(loadActive());     // refresca estado local
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
      await pushResetProgram(slug, { deleteTasks: true }); // server
      await pullUserPrograms();                             // rehidrata
      setActiveMap(loadActive());                           // local
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

  function toggleTaskOpen(task: JsonTask, index: number) {
    const taskId = task.id ?? `task_${index}`;
    setOpenTasks((p) => ({ ...p, [taskId]: !p[taskId] }));
  }

  // Row de acordeón
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

  // ====== Carga de puntuación cuando el programa está iniciado ======
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
      } catch (e) {
        // Silencioso; la sección muestra placeholders
        if (!alive) return;
        setPointsTotals(null);
        setPointsByDay([]);
      } finally {
        if (alive) setLoadingPoints(false);
      }
    })();
    return () => { alive = false; };
  }, [uid, slug, started]);

  // Fallback si no hay loader/JSON
  if (!loadingData && !data) {
    return (
      <div className="px-4 pb-24 bg-white">
        <div className="py-10 text-center text-sm text-neutral-600">
          Este programa todavía no está disponible.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 bg-white">
      {/* Hero 16:9 full-bleed con botón Volver sobre la imagen */}
      {imageSrc && (
        <div className="-mx-4 mb-5 relative">
          <div className="relative w-full aspect-[16/9]">
            <Image src={imageSrc} alt={title} fill className="object-cover" priority />
          </div>

          {/* Botón Volver overlay (siempre claro) */}
          <div className="absolute top-3 right-3">
            <button
              onClick={() => { try { router.back(); } catch { location.href = '/habitos'; } }}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-full border border-neutral-300 bg-white/85 backdrop-blur-md shadow-md hover:bg-white active:scale-[0.98]"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
        </div>
      )}

      {/* Título y chip */}
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      {data?.durationDays ? (
        <div className="mt-1 inline-flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
            Duración: {data.durationDays} días
          </span>
        </div>
      ) : null}

      {/* Introducción */}
      <div className="mt-4">
        {/* Error (si lo hay) */}
        {errorMsg && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Skeleton breve mientras carga el JSON */}
        {loadingData && (
          <div className="animate-pulse">
            <div className="h-3 w-2/3 bg-neutral-200 rounded mb-2" />
            <div className="h-3 w-1/2 bg-neutral-200 rounded mb-2" />
            <div className="h-3 w-3/5 bg-neutral-200 rounded" />
          </div>
        )}

        {!loadingData && (
          <MD className="text-[13px] text-neutral-800 leading-relaxed">{howItWorks}</MD>
        )}

        {!loadingData && (data?.accordions?.whatYouWillDo?.length ||
          data?.accordions?.whatYouWillGet?.length ||
          data?.accordions?.howToUse?.length) && (
          <div className="mt-4 divide-y divide-neutral-200">
            {data?.accordions?.whatYouWillDo?.length ? (
              <div className="py-2">
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
              <div className="py-2">
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
              <div className="py-2">
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
      </div>

      {/* CTA */}
      <div className="mt-6 flex items-center gap-2">
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

      {/* ===== SUBMENÚ (Tabs) ===== */}
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

      {/* ===== CONTENIDO POR TAB ===== */}
      <section className="container mx-auto px-0 py-6 space-y-6">
        {/* ========== TAB: RESUMEN ========== */}
        {activeTab === 'Resumen' && (
          <>
            {/* Progreso (si iniciado) */}
            {started && data && totalDays > 0 && (
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

            {/* Texto guía */}
            <p className="text-xs text-neutral-500">
              * El plan se revela día a día. Los checks se realizan en <strong>Mi Zona</strong>.
            </p>
          </>
        )}

        {/* ========== TAB: CHECK DEL DÍA ========== */}
        {activeTab === 'Check del día' && (
          <>
            {!started && (
              <div className="rounded-2xl border p-4 bg-neutral-50 text-neutral-600" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center gap-2 font-medium mb-2">
                  <Lock className="h-4 w-4" />
                  Bloqueado hasta empezar el programa
                </div>
                <p className="text-sm mb-3">Puedes ver un ejemplo del <strong>Día 1</strong> (lectura en gris):</p>

                {/* Preview Día 1 (gris, sin interacción) */}
                <div className="opacity-60 pointer-events-none">
                  <PreviewDayOne data={data} />
                </div>
              </div>
            )}

            {started && data && totalDays > 0 && (
              <>
                {/* Progreso del día y navegación */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">
                      Día {Math.min(currentDay, totalDays)} / {totalDays}
                    </div>
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

                {/* Lista de tareas del día (informativo; checks reales en Mi Zona) */}
                <DayTasksList
                  tasks={tasks}
                  dayProgressMap={dayProgressMap}
                  openTasks={openTasks}
                  toggleTaskOpen={toggleTaskOpen}
                />

                <p className="text-xs text-neutral-500 mt-2">
                  * Los checks se hacen en <strong>Mi Zona</strong>. Aquí puedes revisar tu progreso. El plan se revela día a día.
                </p>
              </>
            )}
          </>
        )}

        {/* ========== TAB: PUNTUACIÓN ========== */}
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
              <div className="space-y-4">
                {/* Totales */}
                <div className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'var(--line)' }}>
                  <div className="text-sm font-semibold mb-2">Tus puntos</div>
                  {loadingPoints ? (
                    <div className="animate-pulse">
                      <div className="h-3 w-1/2 bg-neutral-200 rounded mb-2" />
                      <div className="h-3 w-1/3 bg-neutral-200 rounded" />
                    </div>
                  ) : (
                    <div className="text-[15px]">
                      <div className="flex items-center justify-between">
                        <span>Total</span>
                        <b>{pointsTotals?.total_points ?? 0}</b>
                      </div>
                      <div className="flex items-center justify-between text-neutral-600 text-sm mt-1">
                        <span>Checks completados</span>
                        <span>{pointsTotals?.checks_done ?? 0} × 5</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-600 text-sm">
                        <span>Días completos</span>
                        <span>{pointsTotals?.days_completed ?? 0} × 10</span>
                      </div>
                    </div>
                  )}
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

                <p className="text-xs text-neutral-500">
                  Reglas: <b>+5</b> por cada check completado · <b>+10</b> por completar todas las tareas del día.
                </p>
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

/* ======= Subcomponentes auxiliares ======= */

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
                {/* Icono de estado (informativo) */}
                <span className="shrink-0 mt-0.5">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-neutral-400" />
                  )}
                </span>

                {/* Cabecera del ítem: label + chevron (abre/cierra detalle) */}
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

              {/* Detalle desplegable */}
              {t.detail && isOpen && (
                <div id={detailId} className="mt-2 ml-9 pr-2">
                  <MD className="text-[13px] text-neutral-700">
                    {t.detail}
                  </MD>
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
      dayProgressMap={{}}             // siempre vacío en preview
      openTasks={{}}                  // cerradas por defecto
      toggleTaskOpen={() => {}}       // no-op en preview
    />
  );
}
