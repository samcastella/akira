// src/components/ProgramCommunityDetail.tsx
'use client';

import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ChevronLeft, ChevronDown, ChevronUp, Lock, Play, RotateCcw,
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';
import { useAuthUserId } from '@/lib/user';

import CreateHabitBar from '@/components/habits/CreateHabitBar';

import {
  loadActive, saveActive, migrateCompat,
  type LocalStore, type LocalProgram,
} from '@/lib/programsLocal';

import {
  fetchProgramPoints, fetchProgramPointsByDay,
  type ProgramPointsTotals, type ProgramPointsByDayRow,
} from '@/lib/programService';

import { loadProgramLeaders, loadProgramMembersCount, loadAvatarsFor, type ProgramLeaderRow } from '@/lib/communityProgram';
import { pushStartProgram, pushResetProgram, pullUserPrograms } from '@/lib/programSync';

/* ===== Tabs ===== */
const TABS = ['Resumen', 'Checks del día', 'Estadísticas', 'Ranking'] as const;
type Tab = typeof TABS[number];

/* ====== Tipos de datos (ProgramDef-lite) ====== */
type JsonTask = { id?: string; label: string; detail?: string; tags?: string[] };
type JsonDay = { day: number; tasks: JsonTask[] };
export type ProgramJson = {
  slug: string;
  title: string;
  shortDescription?: string;
  howItWorks?: string;
  durationDays?: number;
  themeColor?: string;
  accordions?: {
    whatYouWillDo?: string[];
    whatYouWillGet?: string[];
    howToUse?: string[];
  };
  days: JsonDay[];
};

function startOfDayMs(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d.getTime(); }
function todayKey() { const d = new Date(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${mm}-${dd}`; }
function daysBetweenFromMs(startMs: number, endISOyyyyMmDd: string) {
  const a = startOfDayMs(new Date(startMs));
  const b = startOfDayMs(new Date(`${endISOyyyyMmDd}T00:00:00`));
  return Math.floor((b - a) / 86_400_000);
}
function addDays(ms: number, days: number) { return startOfDayMs(new Date(ms + days * 86_400_000)); }
function weekdayLabel(dateMs: number) {
  const map = ['D','L','M','X','J','V','S'] as const;
  return map[new Date(dateMs).getDay()];
}
function escapeHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
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

type Props = {
  slug: string;              // 'san-silvestre-60'
  imageSrc?: string;         // hero
  title: string;
  program: ProgramJson;      // ProgramDef normalizado (days/tasks/etc.)
};

export default function ProgramCommunityDetail({ slug, imageSrc, title, program }: Props) {
  const uid = useAuthUserId();

  const [activeMap, setActiveMap] = useState<LocalStore>({});
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');

  const [starting, setStarting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Puntos
  const [pointsTotals, setPointsTotals] = useState<ProgramPointsTotals | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsTick, setPointsTick] = useState(0);

  // Ranking
  const [leaders, setLeaders] = useState<ProgramLeaderRow[]>([]);
  const [leaderPhotos, setLeaderPhotos] = useState<Record<string, string | null>>({});
  const [leaderImgOk, setLeaderImgOk] = useState<Record<string, boolean>>({});
  const [membersCount, setMembersCount] = useState<number>(0);

  // theme
  const themeColor = program.themeColor ?? '#FCA5A5';

  /* ====== hidratar progreso local ====== */
  useEffect(() => {
    migrateCompat();
    setActiveMap(loadActive());
    const onUpd = () => setActiveMap(loadActive());
    window.addEventListener('storage', onUpd);
    window.addEventListener('akira:programs-updated', onUpd as EventListener);
    return () => {
      window.removeEventListener('storage', onUpd);
      window.removeEventListener('akira:programs-updated', onUpd as EventListener);
    };
  }, []);

  /* ====== Pull remoto al montar y al recuperar foco ====== */
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
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const rehydrate = async () => { try { await pullUserPrograms(); } catch {} setActiveMap(loadActive()); };
    const onVis = () => { if (document.visibilityState === 'visible') void rehydrate(); };
    const onOnline = () => void rehydrate();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
  }, [uid]);

  /* ====== Cargar ranking + participantes ====== */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [lb, count] = await Promise.all([
        loadProgramLeaders(slug),
        loadProgramMembersCount(slug),
      ]);
      if (!alive) return;
      setLeaders(lb);
      setMembersCount(count);
      // Avatares
      const ids = lb.map(l => l.user_id);
      const map = await loadAvatarsFor(ids);
      if (!alive) return;
      setLeaderPhotos(map);
    })();
    return () => { alive = false; };
  }, [slug, pointsTick]);

  const active: LocalProgram | null = activeMap[slug] ?? null;
  const started = Boolean(active?.startedAt);

  // UX: si iniciado, arrancamos en "Checks del día"
  useEffect(() => { setActiveTab(started ? 'Checks del día' : 'Resumen'); }, [started]);

  const totalDays = useMemo(() => program?.durationDays ?? program?.days?.length ?? 0, [program]);

  const currentDay = useMemo(() => {
    if (!active?.startedAt || totalDays <= 0) return 1;
    const delta = daysBetweenFromMs(active.startedAt, todayKey());
    return Math.min(totalDays, Math.max(1, delta + 1));
  }, [active?.startedAt, totalDays]);

  const progressPct = useMemo(() => {
    if (!active?.startedAt || totalDays === 0) return 0;
    const passed = Math.min(totalDays, Math.max(0, daysBetweenFromMs(active.startedAt, todayKey()) + 1));
    return Math.round((passed / totalDays) * 100);
  }, [active?.startedAt, totalDays]);

  async function ensureDayRows(uid: string, slug: string, dayNum: number, taskIds: string[]) {
    if (!taskIds.length) return;
    const { data: existing, error: selErr } = await supabase
      .from('user_program_tasks')
      .select('task_id')
      .eq('user_id', uid)
      .eq('program_slug', slug)
      .eq('day', dayNum);

    if (selErr) { console.warn('[ensureDayRows] select error', selErr); return; }
    const have = new Set((existing ?? []).map((r: any) => r.task_id));
    const missing = taskIds.filter((id) => !have.has(id));
    if (!missing.length) return;

    const now = new Date().toISOString();
    const seedRows = missing.map((id) => ({
      user_id: uid, program_slug: slug, day: dayNum, task_id: id,
      completed: false, completed_at: null, updated_at: now,
    }));

    const { error: upErr } = await supabase
      .from('user_program_tasks')
      .upsert(seedRows as any, { onConflict: 'user_id,program_slug,day,task_id' as any });

    if (upErr) console.warn('[ensureDayRows] upsert error', upErr);
  }

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
      progress, updatedAt: Date.now(),
    };
    const newStore: LocalStore = { ...activeMap, [slug]: updated };
    saveActive(newStore);
    setActiveMap(newStore);

    try {
      if (!uid) return;
      const dayTasks = (program.days.find(d => d.day === dayNum)?.tasks ?? []).map((t, i) => t.id ?? `task_${i}`);
      await ensureDayRows(uid, slug, dayNum, dayTasks);
      await supabase
        .from('user_program_tasks')
        .upsert(
          {
            user_id: uid, program_slug: slug, day: dayNum, task_id: taskId,
            completed: next,
            completed_at: next ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,program_slug,day,task_id' as any }
        );
      await pullUserPrograms();
      setActiveMap(loadActive());
      setPointsTick(n => n + 1);
    } catch (e) { console.error('[UPT upsert EXCEPTION]', e); }
  }

  async function handleStartProgram() {
    setErrorMsg(null); setStarting(true);
    try {
      await pushStartProgram(slug);
      await pullUserPrograms();
      setActiveMap(loadActive());
    } catch (e: any) {
      console.error('[ProgramCommunityDetail] start error', e);
      setErrorMsg('No se pudo iniciar el programa. Inténtalo de nuevo.');
    } finally { setStarting(false); }
  }
  async function confirmReset() {
    setErrorMsg(null); setResetting(true);
    try {
      await pushResetProgram(slug, { deleteTasks: true });
      await pullUserPrograms();
      setActiveMap(loadActive());
    } catch (e: any) {
      console.error('[ProgramCommunityDetail] reset error', e);
      setErrorMsg('No se pudo reiniciar el programa. Inténtalo de nuevo.');
    } finally { setResetting(false); }
  }

  /* ====== Puntos (solo pestaña Estadísticas) ====== */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid || !started || activeTab !== 'Estadísticas') return;
      setLoadingPoints(true);
      try {
        const [tot] = await Promise.all([
          fetchProgramPoints(uid, slug),
          // fetchProgramPointsByDay(uid, slug) // si necesitas desglose por día, está disponible
        ]);
        if (!alive) return;
        setPointsTotals(tot);
      } catch { if (alive) setPointsTotals(null); }
      finally { if (alive) setLoadingPoints(false); }
    })();
    return () => { alive = false; };
  }, [uid, slug, started, pointsTick, activeTab]);

  /* ====== Weekly (objetivo vs hecho local) ====== */
  const weeklyStats = useMemo(() => {
    const totalDaysLocal = program?.durationDays ?? program?.days?.length ?? 0;
    if (!started || !program || !active?.startedAt || totalDaysLocal === 0) {
      return { labels: ['L','M','X','J','V','S','D'], goal: Array(7).fill(0), actual: Array(7).fill(0) };
    }
    const end = Math.min(totalDaysLocal, currentDay);
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
      const day = program!.days.find(x => x.day === d) ?? program!.days[d - 1];
      return Math.max(0, day?.tasks?.length ?? 0);
    });

    const actual: number[] = idxs.map((d) => {
      if (d <= 0) return 0;
      const map = (activeMap[slug]?.progress ?? {})[d] as Record<string, boolean> | undefined;
      return map ? Object.values(map).filter(Boolean).length : 0;
    });

    return { labels, goal, actual };
  }, [started, program, active?.startedAt, activeMap, slug, currentDay]);

  return (
    <div className="px-4 pb-24 bg-white">
      {/* HERO */}
      {imageSrc && (
        <div className="-mx-4 mb-5 relative">
          <div className="relative w-full aspect-[16/9]">
            <Image src={imageSrc} alt={title} fill className="object-cover" priority />
          </div>
        </div>
      )}

      {/* Título + meta */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        <div className="text-sm text-neutral-500">👥 {membersCount} participantes</div>
      </div>

      {/* CTA */}
      <div className="mt-4">
        {errorMsg && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {!started ? (
            <button
              onClick={handleStartProgram}
              disabled={starting || !uid}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold bg-black text-white shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              <Play className="w-4 h-4" />
              {starting ? 'Iniciando…' : 'Empezar programa'}
            </button>
          ) : (
            <button
              onClick={confirmReset}
              disabled={resetting || !uid}
              className="inline-flex items-center gap-2 justify-center rounded-xl px-3.5 py-2.5 text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition disabled:opacity-60"
              title="Reiniciar programa"
            >
              <RotateCcw className="w-4 h-4" />
              {resetting ? 'Reiniciando…' : 'Reiniciar'}
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <nav className="border-b bg-white sticky top-[48px] z-10 -mt-px mt-6">
        <div className="container mx-auto flex justify-between px-0 overflow-x-auto">
          {TABS.map((tab) => {
            const locked = (tab === 'Checks del día' || tab === 'Estadísticas' || tab === 'Ranking') && !started;
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
            {program.howItWorks ? (
              <MD className="block text-[15px] md:text-[16px] leading-[1.75] text-neutral-900">
                {program.howItWorks}
              </MD>
            ) : null}

            {started && program.durationDays ? (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    Progreso: Día {Math.min(currentDay, program.durationDays)} / {program.durationDays}
                  </div>
                  <div className="text-sm text-neutral-500">{progressPct}%</div>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${progressPct}%`, background: themeColor }} />
                </div>
              </div>
            ) : null}

            <p className="text-xs text-neutral-500">
              * El plan se revela día a día. Los checks se realizan en <strong>Mi Zona</strong>.
            </p>
          </div>
        )}

        {/* ===== Checks del día ===== */}
        {activeTab === 'Checks del día' && started && (
          <>
            <p className="text-sm text-neutral-700">
              <strong>Tus retos de hoy</strong>. Márcalos cuando los completes.
            </p>

            <div className="mt-5 space-y-2">
              {(program.days.find(d => d.day === currentDay)?.tasks ?? []).map((t, i) => {
                const id = t.id ?? `task_${i}`;
                const done = Boolean((activeMap[slug]?.progress?.[currentDay] as any)?.[id]);
                const hasDetail = Boolean(t.detail);
                return (
                  <CreateHabitBar
                    key={`t_${id}`}
                    variant="task"
                    label={t.label}
                    checked={done}
                    color={themeColor}
                    onToggle={() => toggleTaskDone(currentDay, id)}
                    showInfoButton={hasDetail}
                    onInfo={hasDetail ? () => alert(t.detail) : undefined}
                  />
                );
              })}
            </div>
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
                <p className="text-sm mt-2">Cuando inicies, verás tus puntos y tu progreso semanal.</p>
              </div>
            )}
            {started && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-[56px] leading-none font-extrabold tabular-nums">
                    {loadingPoints ? '—' : (pointsTotals?.total_points ?? 0)}
                  </div>
                  <div className="text-sm text-neutral-600 mt-1">Puntos ganados con este programa</div>
                </div>

                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
                  <div className="px-4 py-3 text-sm font-semibold bg-neutral-50">Últimos 7 días</div>
                  <div className="p-4">
                    <WeeklyStatsChart
                      labels={weeklyStats.labels}
                      goal={weeklyStats.goal}
                      actual={weeklyStats.actual}
                    />
                    <div className="mt-3 flex items-center gap-4 text-xs text-neutral-600">
                      <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-neutral-300" /> Objetivo</div>
                      <div className="flex items-center gap-2"><span className="inline-block w-4 h-[2px] bg-blue-500" /> Hecho</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== Ranking ===== */}
        {activeTab === 'Ranking' && (
          <div className="space-y-3">
            {!leaders.length && <p className="text-sm text-neutral-600">Sin datos de ranking.</p>}
            <ul className="space-y-2">
              {leaders.map((r) => {
                const name =
                  r.handle ||
                  `${(r.nombre ?? '').trim()} ${(r.apellido ?? '').trim()}`.trim() ||
                  r.user_id.slice(0, 6);
                const avatar = leaderPhotos[r.user_id] || null;
                return (
                  <li
                    key={r.user_id}
                    className="flex items-center justify-between rounded-[28px] px-3 py-2 shadow-sm"
                    style={{ background: 'linear-gradient(180deg, #F8E68A 0%, #F2D767 100%)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-neutral-200">
                        {avatar && leaderImgOk[r.user_id] !== false ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar}
                            alt="Avatar"
                            className="absolute inset-0 h-full w-full object-cover object-center"
                            draggable={false}
                            referrerPolicy="no-referrer"
                            onError={() => setLeaderImgOk(s => ({ ...s, [r.user_id]: false }))}
                            onLoad={() => setLeaderImgOk(s => ({ ...s, [r.user_id]: true }))}
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center text-[12px] text-neutral-600">🙂</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">#{r.rank_position} · {name}</div>
                        <div className="text-xs opacity-80 truncate">Puntos acumulados</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-base font-bold tabular-nums">{r.score} pts</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
