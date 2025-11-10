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

/* === Local store programas === */
import {
  loadActive,
  saveActive,
  migrateCompat,
  type LocalStore,
  type LocalProgram,
} from '@/lib/programsLocal';

/* === Sync Supabase === */
import { pushStartProgram, pushResetProgram, pullUserPrograms } from '@/lib/programSync';

/* === Usuario === */
import { useAuthUserId } from '@/lib/user';

/* ✅ Realtime */
import { supabase } from '@/lib/supabaseClient';

/* === Puntuación (RPC) === */
import {
  fetchProgramPoints,
  fetchProgramPointsByDay,
  type ProgramPointsTotals,
  type ProgramPointsByDayRow,
} from '@/lib/programService';

/* === UI barras === */
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
  'san-silvestre-60': async () => {
    const m = await import('@/data/programs/san-silvestre-60.json');
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
function addDays(ms: number, days: number) {
  return startOfDayMs(new Date(ms + days * 86_400_000));
}
function weekdayLabel(dateMs: number) {
  const map = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
  const d = new Date(dateMs).getDay();
  return map[d];
}

/* ---------- Mini Markdown ---------- */
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

/* ===== Tabs (renombrado Puntuación → Estadísticas) ===== */
const TABS = ['Resumen', 'Check del día', 'Estadísticas'] as const;
type Tab = typeof TABS[number];

/* ===== Colores ===== */
const PROGRAM_COLORS: Record<string, string> = {
  'lectura-30': '#111111',
  'detox-tecnologico-30': '#0a7cff',
};

/* ===== Badges ===== */
const BADGE_FILES: Record<string, string> = {
  'lectura-30': '/images/badges/superlector.png',
  'detox-tecnologico-30': '/images/badges/detox-tecnologico.png',
};
const BADGE_TITLES: Record<string, string> = {
  'lectura-30': 'Superlector',
  'detox-tecnologico-30': 'Domador del Scroll',
};

type Props = {
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
  shortDescription: _shortDescription,
  howItWorks,
}: Props) {
  const router = useRouter();
  const uid = useAuthUserId();

  const [data, setData] = useState<ProgramJson | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [activeMap, setActiveMap] = useState<LocalStore>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [taskInfoOpen, setTaskInfoOpen] = useState<null | { label: string; detail?: string }>(null);

  const [openAcc, setOpenAcc] = useState<{ do: boolean; get: boolean; use: boolean }>({
    do: false,
    get: false,
    use: false,
  });

  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('Resumen');

  // Puntuación
  const [pointsTotals, setPointsTotals] = useState<ProgramPointsTotals | null>(null);
  const [pointsByDay, setPointsByDay] = useState<ProgramPointsByDayRow[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsTick, setPointsTick] = useState(0); // refresco tras cada check

  /* cargar JSON */
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

  /* cargar progreso + listeners */
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

  /* pull al montar si uid */
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

  /* rehydrate en foco/online */
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

  const dayData = useMemo(() => {
    if (!data || totalDays === 0) return null;
    return data.days.find((d) => d.day === currentDay) ?? data.days[currentDay - 1] ?? null;
  }, [data, currentDay, totalDays]);

  const tasks: JsonTask[] = dayData?.tasks ?? [];

  function getDayProgressMap(dayNum: number): Record<string, boolean> {
    const entry = activeMap[slug];
    if (!entry) return {};
    const raw = (entry.progress ?? {})[dayNum] as any;
    return raw && !Array.isArray(raw) ? (raw as Record<string, boolean>) : {};
  }

  const progressPct = useMemo(() => {
    if (!active?.startedAt || totalDays === 0) return 0;
    const passed = Math.min(totalDays, Math.max(0, daysBetweenFromMs(active.startedAt, todayKey()) + 1));
    return Math.round((passed / totalDays) * 100);
  }, [active?.startedAt, totalDays]);

  /* ========== Sembrar filas del día antes del primer toggle ========== */
  async function ensureDayRows(uid: string, slug: string, dayNum: number, taskIds: string[]) {
    if (!taskIds.length) return;

    const { data: existing, error: selErr } = await supabase
      .from('user_program_tasks')
      .select('task_id')
      .eq('user_id', uid)
      .eq('program_slug', slug)
      .eq('day', dayNum);

    if (selErr) {
      console.warn('[ensureDayRows] select error', selErr);
      return;
    }

    const have = new Set((existing ?? []).map((r: any) => r.task_id));
    const missing = taskIds.filter((id) => !have.has(id));
    if (!missing.length) return;

    const now = new Date().toISOString();
    const seedRows = missing.map((id) => ({
      user_id: uid,
      program_slug: slug,
      day: dayNum,
      task_id: id,
      completed: false,
      completed_at: null,
      updated_at: now,
    }));

    const { error: upErr } = await supabase
      .from('user_program_tasks')
      .upsert(seedRows as any, { onConflict: 'user_id,program_slug,day,task_id' as any });

    if (upErr) console.warn('[ensureDayRows] upsert error', upErr);
  }

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

  /** Toggle check (optimista + pull inmediato para persistencia tras logout) */
  async function toggleTaskDone(dayNum: number, taskId: string) {
    const entry = activeMap[slug] as LocalProgram | undefined;
    const prev = Boolean((entry?.progress?.[dayNum] as any)?.[taskId]);
    const next = !prev;

    const progress = { ...(entry?.progress ?? {}) };
    const mapForDay = { ...((progress[dayNum] as any) || {}) };
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

    if (next) {
      try { window.dispatchEvent(new CustomEvent('akira:celebrate')); } catch {}
    }

    try {
      if (!uid) return;

      // Sembrar todas las filas del día antes del toggle
      const dayTasks = (data?.days.find(d => d.day === dayNum)?.tasks ?? []).map((t, i) => t.id ?? `task_${i}`);
      await ensureDayRows(uid, slug, dayNum, dayTasks);

      // Upsert del toggle real
      await supabase
        .from('user_program_tasks')
        .upsert(
          {
            user_id: uid,
            program_slug: slug,
            day: dayNum,
            task_id: taskId,
            completed: next,
            completed_at: next ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,program_slug,day,task_id' as any }
        );

      // Pull inmediato para que quede persistido en local (sobre todo tras logout/login)
      await pullUserPrograms();
      setActiveMap(loadActive());

      // Refrescar puntos/estadísticas (si estás en la pestaña)
      setPointsTick((n) => n + 1);
    } catch (e) {
      console.error('[UPT upsert EXCEPTION]', e);
    }
  }

  /* ====== Carga de puntos (solo cuando pestaña = Estadísticas) ====== */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid || !started || activeTab !== 'Estadísticas') {
        if (!uid || !started) {
          setPointsTotals(null);
          setPointsByDay([]);
        }
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
    return () => { alive = false; };
  }, [uid, slug, started, pointsTick, activeTab]);

  /* ===== Estadísticas (semana móvil real con etiquetas correctas) ===== */
  const weeklyStats = useMemo(() => {
    if (!started || !data || !active?.startedAt) {
      return { labels: ['L','M','X','J','V','S','D'], goal: Array(7).fill(0), actual: Array(7).fill(0) };
    }
    const end = currentDay;
    const start = Math.max(1, end - 6);

    const idxs: number[] = [];
    for (let d = start; d <= end; d++) idxs.push(d);
    while (idxs.length < 7) idxs.unshift(0);

    const labels: string[] = idxs.map((d) => {
      if (d <= 0) return '';
      const dateMs = addDays(active.startedAt!, d - 1);
      return weekdayLabel(dateMs);
    });

    const goal: number[] = idxs.map((d) => {
      if (d <= 0) return 0;
      const day = data!.days.find(x => x.day === d) ?? data!.days[d - 1];
      return Math.max(0, day?.tasks?.length ?? 0);
    });

    const actual: number[] = idxs.map((d) => {
      if (d <= 0) return 0;
      const map = (activeMap[slug]?.progress ?? {})[d] as Record<string, boolean> | undefined;
      return map ? Object.values(map).filter(Boolean).length : 0;
    });

    return { labels, goal, actual };
  }, [started, data, active?.startedAt, activeMap, slug, currentDay]);

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
  const badgeTitle = BADGE_TITLES[slug] ?? 'Insignia';

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
              onClick={() => { try { router.back(); } catch { location.href = '/habitos'; } }}
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

  {/* Enlace a la comunidad del programa San Silvestre */}
  {slug === 'san-silvestre-60' && (
    <a
      href="/programas/san-silvestre-60/comunidad"
      className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium hover:bg-neutral-50 mt-3"
      style={{ borderColor: 'var(--line)' }}
    >
      Ver comunidad y ranking
    </a>
  )}
</div>


      {/* TABS */}
      <nav className="border-b bg-white sticky top-[48px] z-10 -mt-px mt-6">
        <div className="container mx-auto flex justify-between px-0 overflow-x-auto">
          {TABS.map((tab) => {
            const locked = (tab === 'Check del día' || tab === 'Estadísticas') && !started;
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
          <div className="space-y-5">
            {howItWorks ? (
              <MD className="block text-[15px] md:text-[16px] leading-[1.75] text-neutral-900">
                {howItWorks}
              </MD>
            ) : null}

            {(data?.accordions?.whatYouWillDo?.length ||
              data?.accordions?.whatYouWillGet?.length ||
              data?.accordions?.howToUse?.length) && (
              <div className="divide-y divide-neutral-200">
                {data?.accordions?.whatYouWillDo?.length ? (
                  <div className="py-3">
                    <ARow
                      label="¿Qué vas a hacer?"
                      open={openAcc.do}
                      onClick={() => setOpenAcc((s) => ({ ...s, do: !s.do }))}
                    />
                    {openAcc.do && (
                      <ul className="pl-4 list-disc text-[13px] text-neutral-800 space-y-1 mt-1">
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
                  <div className="py-3">
                    <ARow
                      label="¿Qué vas a conseguir?"
                      open={openAcc.get}
                      onClick={() => setOpenAcc((s) => ({ ...s, get: !s.get }))}
                    />
                    {openAcc.get && (
                      <ul className="pl-4 list-disc text-[14px] text-neutral-900 space-y-1 mt-1">
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
                  <div className="py-3">
                    <ARow
                      label="¿Cómo se usa?"
                      open={openAcc.use}
                      onClick={() => setOpenAcc((s) => ({ ...s, use: !s.use }))}
                    />
                    {openAcc.use && (
                      <ul className="pl-4 list-disc text-[13px] text-neutral-800 space-y-1 mt-1">
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

                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full bg-black transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {(data.days.find(d => d.day === currentDay)?.tasks ?? []).map((t, i) => {
                    const id = t.id ?? `task_${i}`;
                    const done = Boolean((activeMap[slug]?.progress?.[currentDay] as any)?.[id]);
                    const hasDetail = Boolean(t.detail);
                    return (
                      <CreateHabitBar
                        key={`t_${id}`}
                        variant="task"
                        label={t.label}
                        checked={done}
                        color={programColor}
                        onToggle={() => toggleTaskDone(currentDay, id)}
                        showInfoButton={hasDetail}
                        onInfo={hasDetail ? () => setTaskInfoOpen({ label: t.label, detail: t.detail }) : undefined}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ===== Estadísticas ===== */}
        {activeTab === 'Estadísticas' && (
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
                <div className="text-center">
                  <div className="text-[56px] leading-none font-extrabold tabular-nums">
                    {loadingPoints ? 'Cargando…' : (pointsTotals?.total_points ?? 0)}
                  </div>
                  <div className="text-sm text-neutral-600 mt-1">Puntos ganados con este programa</div>
                  <div className="mt-4 text-lg font-semibold">
                    {loadingPoints ? '—' : (pointsTotals?.days_completed ?? 0)} días completando tus retos
                  </div>
                </div>

                <div className="rounded-2xl border p-4 bg-white" style={{ borderColor: 'var(--line)' }}>
                  <div className="text-sm font-semibold mb-2">Reglas de puntuación</div>
                  <ul className="text-sm text-neutral-700 list-disc pl-5 space-y-1">
                    <li><b>+5</b> puntos por cada check completado.</li>
                    <li><b>+10</b> puntos por completar <i>todas</i> las tareas del día.</li>
                  </ul>
                </div>

                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
                  <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Estadísticas</div>
                  <div className="p-4">
                    <WeeklyStatsChart
                      labels={weeklyStats.labels}
                      goal={weeklyStats.goal}
                      actual={weeklyStats.actual}
                    />
                    <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-4 h-[2px] bg-neutral-300" /> Objetivo
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-4 h-[2px] bg-blue-500" /> Hecho
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-neutral-200" />

                <div className="rounded-2xl border p-4 bg-white flex items-center gap-4" style={{ borderColor: 'var(--line)' }}>
                  <div className="flex-1">
                    <div className="text-[15px] font-semibold">Insignia</div>
                    <p className="text-sm text-neutral-600">
                      Consigue esta insignia al completar el reto (deberás haber completado el <b>90%</b> de los retos).
                    </p>
                    <div className="mt-1 text-sm font-medium text-neutral-900">{badgeTitle}</div>
                  </div>
                  <div className="w-24 h-24 relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
                    <Image src={badgeSrc} alt={`Insignia: ${badgeTitle}`} fill className="object-cover" />
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
              <button onClick={cancelReset} className="rounded-xl border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50">
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

      {/* Pop-up detalle */}
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

/* ===== Subcomponentes ===== */

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

const ARow: FC<{ label: string; open: boolean; onClick: () => void }> = ({ label, open, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between py-3" aria-expanded={open}>
    <span className="text-[15px] font-semibold text-neutral-900">{label}</span>
    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
  </button>
);

/* ===== WeeklyStatsChart (SVG) ===== */
const WeeklyStatsChart: FC<{ labels: string[]; goal: number[]; actual: number[] }> = ({ labels, goal, actual }) => {
  const width = 640, height = 220, padL = 28, padR = 16, padT = 20, padB = 28;
  const n = 7;
  const xs = (i: number) => padL + (i * (width - padL - padR)) / Math.max(1, n - 1);
  const maxY = Math.max(5, ...goal, ...actual);
  const niceMax = Math.max(5, Math.ceil(maxY / 5) * 5);
  const ys = (v: number) => padT + (height - padT - padB) * (1 - v / (niceMax || 1));
  const gridLines = 4;
  const pathFor = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(v)}`).join(' ');
  const goalPath = pathFor(goal);
  const actualPath = pathFor(actual);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <rect x="0" y="0" width={width} height={height} fill="white" />
        {[...Array(gridLines + 1)].map((_, i) => {
          const y = padT + ((height - padT - padB) * i) / gridLines;
          return <line key={`g${i}`} x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const val = Math.round(niceMax * p);
          const y = padT + (height - padT - padB) * (1 - p);
          return <text key={`t${i}`} x={width - padR + 6} y={y + 4} fontSize="10" fill="#6b7280">{val}</text>;
        })}
        <path d={goalPath} fill="none" stroke="#d1d5db" strokeWidth="2" />
        <path d={actualPath} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {goal.map((v, i) => <circle key={`pg${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#d1d5db" strokeWidth="2" />)}
        {actual.map((v, i) => <circle key={`pa${i}`} cx={xs(i)} cy={ys(v)} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />)}
        {labels.map((l, i) => (
          <text key={`lx${i}`} x={xs(i)} y={height - padB + 16} textAnchor="middle" fontSize="11" fill="#6b7280">
            {l || ' '}
          </text>
        ))}
        <text x={width - 4} y={padT - 6} textAnchor="end" fontSize="12" fill="#6b7280">Retos</text>
      </svg>
    </div>
  );
};
