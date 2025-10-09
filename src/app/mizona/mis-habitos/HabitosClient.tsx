'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import type { HabitMaster } from '@/components/habits/HabitForm';
import { useUserProfile, useAuthUserId } from '@/lib/user';

import {
  initProgramsLocal,
  getActiveSlugs,
  getDayIndexFor,
  LS_ACTIVE as LS_PROGRAMS_ACTIVE,
  loadActive as loadProgramsLocalStore,
  type LocalStore,
} from '@/lib/programsLocal';

import { pullUserPrograms, pushToggleTask } from '@/lib/programSync';

/* =========================
Constantes / Tipos
========================= */
const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY = 'akira_habits_daily_v1';
const LS_PROGRAM_CHECKS = 'akira_programs_daily_checks_v1';
const LS_PROGRAMS_ACTIVE_LEGACY = 'akira_program_active'; // legacy

type DailyEntry = { done: boolean; doneAt?: number; updated_at?: string };
type DailyMap = Record<string, Record<string, DailyEntry>>;
type HabitView = HabitMaster & { done: boolean };

type ProgramTask = { id?: string; label: string; detail?: string; tags?: string[] };
type ProgramDef = {
  slug: string;
  title: string;
  themeColor?: string;
  image?: string; // opcional: /programs/<slug>.png
  totalDays?: number; // opcional para mostrar 10/30
  days?: { day: number; tasks: ProgramTask[] }[];
};

/* =========================
Helpers de almacenamiento
========================= */
function loadMasterHabits(): HabitMaster[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_HABITS_MASTER);
    return raw ? (JSON.parse(raw) as HabitMaster[]) : [];
  } catch {
    return [];
  }
}
function loadDaily(): DailyMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_HABITS_DAILY);
    return raw ? (JSON.parse(raw) as DailyMap) : {};
  } catch {
    return {};
  }
}
function saveDaily(map: DailyMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_HABITS_DAILY, JSON.stringify(map));
}

/* Checks por tarea de programa (día actual) */
type ChecksMap = Record<string, Record<number, Record<string, true>>>;
function loadProgramChecks(): ChecksMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_PROGRAM_CHECKS);
    return raw ? (JSON.parse(raw) as ChecksMap) : {};
  } catch {
    return {};
  }
}
function saveProgramChecks(map: ChecksMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_PROGRAM_CHECKS, JSON.stringify(map));
}

/* =========================
Fechas
========================= */
const dateKeyTZ = (d = new Date(), tz = 'Europe/Madrid') => {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value!;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const startOfWeek = (d = new Date()) => {
  const dt = new Date(d);
  const wd = dt.getDay(); // 0=Dom
  const diff = (wd + 6) % 7; // Lunes inicio
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
};
const startOfMonth = (d = new Date()) => {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  dt.setHours(0,0,0,0);
  return dt;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
};
const addMonths = (d: Date, n: number) => {
  const x = new Date(d); x.setMonth(x.getMonth() + n); x.setDate(1); return x;
};
const isInRange = (dKey: string, start?: string, end?: string) => {
  if (start && dKey < start) return false;
  if (end && dKey > end) return false;
  return true;
};
const isWeekendDay = (d: Date) => [0,6].includes(d.getDay());
const parseKeyToDate = (k: string) => new Date(`${k}T00:00:00`);

/* =========================
UI helpers
========================= */
const BORDER = '#E5E7EB';
const PILL_RADIUS = 9999;

/* ===== DEBUG confetti ===== */
function DBG(..._args: any[]) {}
function markPoint(_x?: number, _y?: number, _label = '') {}

/* =========================
Confeti (canvas propio)
========================= */
let confettiInstance: any | null = null;
let confettiCanvas: HTMLCanvasElement | null = null;

async function getConfettiShooter() {
  const { default: confetti } = await import('canvas-confetti');
  if (!confettiCanvas) {
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'akira-confetti';
    Object.assign(confettiCanvas.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      pointerEvents: 'none', zIndex: '2147483647', background: 'transparent',
    });
    document.body.appendChild(confettiCanvas);
  }
  if (!confettiInstance) confettiInstance = confetti.create(confettiCanvas, { resize: true, useWorker: true });
  return confettiInstance;
}
async function confettiBurstXY(x?: number, y?: number, big = false) {
  try {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const shoot = await getConfettiShooter();
    const ox = Math.min(Math.max((x ?? window.innerWidth / 2) / window.innerWidth, 0), 1);
    const oy = Math.min(Math.max((y ?? window.innerHeight / 2) / window.innerHeight, 0), 1);
    shoot({ particleCount: big ? 180 : 80, spread: big ? 90 : 65, startVelocity: big ? 45 : 35, ticks: 220, gravity: 0.9, origin: { x: ox, y: oy }, scalar: big ? 1.05 : 0.9 });
  } catch {}
}

/* =========================
Programas: lookup (__PROGRAMS + aliases)
========================= */
function getAliases(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return ((window as any).__PROGRAMS_ALIASES ?? {}) as Record<string, string>;
}
function normalizeSlug(slug: string) {
  const s = String(slug || '');
  const alias = getAliases()[s];
  return (alias ?? s).replace(/-30$/, '');
}
function getProgramBySlug(slug: string): ProgramDef | null {
  if (typeof window === 'undefined') return null;
  const index = (window as any).__PROGRAMS as Record<string, ProgramDef> | undefined;
  if (!index) return null;
  return index[normalizeSlug(slug)] || null;
}
function resolveProgramImage(program?: ProgramDef | null): string | undefined {
  if (!program) return undefined;
  if (program.image) return program.image;
  const s = program.slug.toLowerCase();
  if (s.includes('reading')) return '/programs/reading.jpg';
  if (s.includes('detox')) return '/programs/detox-hero.jpg';
  if (s.includes('lectura')) return '/programs/lectura-hero.jpg';
  return undefined;
}

/* =========================
Helper “soft-delete”
========================= */
const isDeleted = (h: any): boolean => !!h?.deleted_at;

/* =========================
Componentes visuales
========================= */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-extrabold tracking-tight mb-2">{children}</h3>;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold tracking-tight mb-2">{children}</h4>;
}
function EmptyBar({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-2xl border border-dashed px-4 py-3 text-sm"
      style={{ borderColor: 'var(--line, rgba(0,0,0,.16))' }}
    >
      <span className="text-black/60">{label}</span>
      <span className="grid h-7 w-7 place-items-center rounded-full border">
        <Plus size={16} />
      </span>
    </Link>
  );
}

/* =========================
Rueda semanal con texto interior
========================= */
function CircularWeekWheel({ done, total }: { done: number; total: number }) {
  const size = 280;
  const strokeW = 16;
  const r = (size - strokeW) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const dash = C * pct, gap = C - dash;
  const angle = -Math.PI / 2 + 2 * Math.PI * pct;
  const px = cx + r * Math.cos(angle), py = cy + r * Math.sin(angle);
  const pctTxt = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="grid place-items-center my-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="akiraWheel" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffe044" /><stop offset="50%" stopColor="#ff8a00" /><stop offset="100%" stopColor="#ff3b30" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} stroke="#eee" strokeWidth={strokeW} fill="none" />
        <circle cx={cx} cy={cy} r={r} stroke="url(#akiraWheel)" strokeWidth={strokeW} strokeLinecap="round" fill="none" strokeDasharray={`${dash} ${gap}`} transform={`rotate(-90 ${cx} ${cy})`} filter="url(#softShadow)" />
        <g transform={`translate(${px}, ${py})`}>
          <circle r={strokeW / 2} fill="#fff" stroke="#00000020" />
          <text x="0" y="4" fontSize="14" textAnchor="middle">🔥</text>
        </g>
        <text x={cx} y={cy - 20} fontSize="11" fill="#6b7280" textAnchor="middle" style={{ letterSpacing: 1.1 }}>
          ACTIVIDADES DE ESTA SEMANA
        </text>
        <text x={cx} y={cy + 6} fontSize="22" fontWeight={800} textAnchor="middle" fill="#111">
          {pctTxt}% completado
        </text>
        <text x={cx} y={cy + 30} fontSize="13" textAnchor="middle" fill="#6b7280">
          {done}/{total} checks
        </text>
      </svg>
    </div>
  );
}

/* =========================
Ranking
========================= */
function RankingCard({ username, points, rank, avatar }: { username: string; points: number; rank: number; avatar?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border px-3 py-2 mb-6" style={{ borderColor: 'var(--line, rgba(0,0,0,.12))', background: '#fff' }}>
      <div className="rounded-full overflow-hidden grid place-items-center" style={{ width: 44, height: 44, border: '1px solid #e5e7eb', background: '#f7f7f7' }}>
        {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <span>👤</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{username || 'Usuario'}</div>
        <div className="text-xs text-black/60">Ranking mensual: #{rank}</div>
      </div>
      <div className="text-2xl font-extrabold">{points}</div>
    </div>
  );
}

/* =========================
Tarjeta Programa (diseño tipo adjunto + imágenes)
========================= */
function ProgramActiveCard({
  program, dayIdx, progressDays, onClick,
}: {
  program: ProgramDef; dayIdx: number; progressDays: { current: number; total?: number }; onClick: () => void;
}) {
  const color = program.themeColor || '#eaeef3';
  const tot = progressDays.total ?? program.totalDays ?? program.days?.length ?? 30;
  const cur = Math.max(1, Math.min(tot, progressDays.current));
  const img = resolveProgramImage(program);

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-[24px] border px-3 py-3 md:px-4 md:py-4 flex items-center gap-3 hover:shadow-sm transition bg-[#f7f7f7]"
      style={{ borderColor: 'var(--line, rgba(0,0,0,.10))' }}
      aria-label={`Abrir ${program.title}`}
    >
      <div className="shrink-0 rounded-full overflow-hidden" style={{ width: 52, height: 52, border: '1px solid #e5e7eb', background: '#fff' }}>
        {img ? <img src={img} alt={program.title} className="w-full h-full object-cover" /> : <span className="grid place-items-center w-full h-full">🏁</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-black/50 leading-none mb-1">Programa</div>
        <div className="text-[14px] font-semibold leading-snug line-clamp-2">{program.title}</div>

        <div className="mt-2 flex items-center gap-2">
          <div className="relative h-2 flex-1 rounded-full overflow-hidden" style={{ background: '#eaeef3' }}>
            <div className="h-full" style={{ width: `${(cur / tot) * 100}%`, background: color }} />
          </div>
          <div className="text-xs font-semibold text-black/60 shrink-0">{cur}/{tot}</div>
        </div>
      </div>

      <ChevronRight className="shrink-0 text-black/40" />
    </button>
  );
}

/* =========================
Gráfico semanal (sin borde). Puntos blancos con borde gris oscuro.
“Retos” separado del 25.
========================= */
function WeeklyChecksChart({
  valuesGoal, valuesDone, labels,
}: { valuesGoal: number[]; valuesDone: number[]; labels: string[] }) {
  const w = 380, h = 160, padL = 18, padR = 64, padT = 16, padB = 22;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxV = Math.max(1, 25, ...valuesGoal, ...valuesDone);
  const y = (v: number) => padT + innerH - (v / maxV) * innerH;
  const x = (i: number) => padL + (i * innerW) / (labels.length - 1 || 1);
  const pts = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <div>
      <svg width={w} height={h} role="img" aria-label="Checks por día (semana)">
        {/* grid y escala derecha */}
        {[0, 5, 10, 15, 20, 25].map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={w - padR} y2={y(t)} stroke="#f1f5f9" />
            <text x={w - padR + 8} y={y(t) + 4} fontSize="10" fill="#94a3b8">{t}</text>
          </g>
        ))}
        {/* etiqueta “Retos” separada */}
        <text x={w - 10} y={padT - 4} fontSize="11" textAnchor="end" fill="#6b7280">Retos</text>

        {/* líneas */}
        <polyline fill="none" stroke="#9ca3af" strokeWidth={2} points={pts(valuesGoal)} />
        <polyline fill="none" stroke="#10b981" strokeWidth={2.5} points={pts(valuesDone)} />

        {/* puntos (blancos con borde gris oscuro) */}
        {valuesGoal.map((v, i) => (
          <circle key={'ga'+i} cx={x(i)} cy={y(v)} r={4} fill="#ffffff" stroke="#374151" strokeWidth={1.25} />
        ))}
        {valuesDone.map((v, i) => (
          <circle key={'do'+i} cx={x(i)} cy={y(v)} r={4} fill="#ffffff" stroke="#374151" strokeWidth={1.25} />
        ))}

        {/* labels abajo */}
        {labels.map((lb, i) => (
          <text key={lb+i} x={x(i)} y={h - 4} fontSize="10" textAnchor="middle" fill="#94a3b8">{lb}</text>
        ))}
      </svg>
    </div>
  );
}

/* =========================
Calendario (mes navegable) — celdas circulares + flechas laterales
========================= */
function monthMatrix(base = new Date()) {
  const first = startOfMonth(base);
  const firstWeekday = (first.getDay() + 6) % 7; // 0=Lun
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, month: first.toLocaleString('es-ES', { month: 'long' }), year: first.getFullYear() };
}

function CalendarHeat({
  baseDate,
  onPrev,
  onNext,
  colorForDate,
}: {
  baseDate: Date;
  onPrev: () => void;
  onNext: () => void;
  colorForDate: (d: Date) => { color: string; label: string };
}) {
  const { cells, month, year } = monthMatrix(baseDate);
  const weekLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="relative rounded-2xl border p-4" style={{ borderColor: 'var(--line, rgba(0,0,0,.12))' }}>
      {/* Flechas laterales a media altura */}
      <button
        onClick={onPrev}
        className="absolute left-1 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full border bg-white"
        style={{ borderColor: 'var(--line, rgba(0,0,0,.12))' }}
        aria-label="Mes anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={onNext}
        className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full border bg-white"
        style={{ borderColor: 'var(--line, rgba(0,0,0,.12))' }}
        aria-label="Mes siguiente"
      >
        <ChevronRight size={18} />
      </button>

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold capitalize">{month} {year}</div>
        <Link href="/mizona/calendarios" className="text-sm font-semibold">Ver todos</Link>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs text-black/60 mb-1">
        {weekLabels.map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-9" />;
          const meta = colorForDate(d);
          return (
            <div
              key={i}
              className="h-9 w-9 mx-auto rounded-full grid place-items-center text-xs"
              style={{ background: meta.color, color: '#111', border: '1px solid #00000033' }}
              title={meta.label}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
Página principal
========================= */
export default function MiActividadPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [masters, setMasters] = useState<HabitMaster[]>([]);
  const [daily, setDaily] = useState<DailyMap>({});
  const [today, setToday] = useState<string>(dateKeyTZ());

  const [activePrograms, setActivePrograms] = useState<string[]>([]);
  const [checks, setChecks] = useState<ChecksMap>({});
  const [checksVersion, setChecksVersion] = useState<number>(0);
  const [programsTick, setProgramsTick] = useState<number>(0);

  // Estado para calendario
  const [calDate, setCalDate] = useState<Date>(startOfMonth(new Date()));

  // Precalentar confeti
  useEffect(() => { void getConfettiShooter().catch(() => {}); }, []);

  // Hidratar index de programas desde window.__PROGRAMS
  useEffect(() => {
    const bump = () => setProgramsTick((t) => t + 1);
    const id = requestAnimationFrame(bump);
    const onUpdated = () => bump();
    window.addEventListener('akira:programs-updated', onUpdated);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('akira:programs-updated', onUpdated);
    };
  }, []);

  // rollover a medianoche (Europe/Madrid)
  const midnightTimer = useRef<number | null>(null);
  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const next = new Date(now); next.setHours(24, 0, 0, 0);
      midnightTimer.current = window.setTimeout(() => {
        setToday(dateKeyTZ()); setActivePrograms(normalizeSlugs(getActiveSlugs())); schedule();
      }, next.getTime() - now.getTime() + 1000);
    };
    schedule();
    return () => { if (midnightTimer.current) window.clearTimeout(midnightTimer.current); };
  }, []);

  const user = (useUserProfile?.() as any) || {};
  const username = user?.username || 'usuario';
  const avatar = (user?.foto as string | undefined) || undefined;

  const uid = useAuthUserId();

  function refreshActivesFromLocal() {
    setActivePrograms(normalizeSlugs(getActiveSlugs()));
  }
  function rebuildChecksFromProgramsLocal(slugs: string[]) {
    const store: LocalStore = loadProgramsLocalStore() || {};
    const rebuilt: ChecksMap = {};
    for (const slug of slugs) {
      const dayIdx = getDayIndexFor(slug) ?? 0;
      const prog = store[slug];
      const dayMap = (prog as any)?.progress?.[dayIdx] || {};
      const taskMap: Record<string, true> = {};
      for (const [taskId, done] of Object.entries(dayMap)) if (done) taskMap[taskId] = true;
      if (Object.keys(taskMap).length) {
        if (!rebuilt[slug]) rebuilt[slug] = {};
        rebuilt[slug][dayIdx] = taskMap;
      }
    }
    saveProgramChecks(rebuilt);
    setChecks(rebuilt);
  }
  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());

    const checks0 = loadProgramChecks();
    const checksNorm: ChecksMap = {};
    const aliases = getAliases();
    for (const [slug, byDay] of Object.entries(checks0 || {})) {
      const target = (aliases[slug] ?? slug).replace(/-30$/, '');
      if (!checksNorm[target]) checksNorm[target] = {};
      Object.assign(checksNorm[target], byDay);
    }
    if (JSON.stringify(checks0) !== JSON.stringify(checksNorm)) saveProgramChecks(checksNorm);
    setChecks(checksNorm);

    initProgramsLocal();
    refreshActivesFromLocal();

    const t0 = setTimeout(refreshActivesFromLocal, 250);
    const t1 = setTimeout(refreshActivesFromLocal, 750);

    (async () => {
      try {
        if (uid) {
          await pullUserPrograms();
          initProgramsLocal();
          const act = normalizeSlugs(getActiveSlugs());
          setActivePrograms(act);
          rebuildChecksFromProgramsLocal(act);
        }
      } catch {}
    })();

    const onProgramsUpdated = () => {
      refreshActivesFromLocal();
      const act = normalizeSlugs(getActiveSlugs());
      rebuildChecksFromProgramsLocal(act);
    };
    const onVisibility = () => {
      if (!document.hidden) {
        refreshActivesFromLocal();
        const act = normalizeSlugs(getActiveSlugs());
        rebuildChecksFromProgramsLocal(act);
      }
    };
    const onFocus = () => {
      refreshActivesFromLocal();
      const act = normalizeSlugs(getActiveSlugs());
      rebuildChecksFromProgramsLocal(act);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_PROGRAMS_ACTIVE || e.key === LS_PROGRAMS_ACTIVE_LEGACY) {
        refreshActivesFromLocal();
        const act = normalizeSlugs(getActiveSlugs());
        rebuildChecksFromProgramsLocal(act);
      }
      if (e.key === LS_PROGRAM_CHECKS) setChecks(loadProgramChecks());
      if (e.key === LS_HABITS_MASTER) setMasters(loadMasterHabits());
      if (e.key === LS_HABITS_DAILY) setDaily(loadDaily());
    };

    window.addEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimeout(t0); clearTimeout(t1);
      window.removeEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [uid, pathname]);

  useEffect(() => { if (masters.length) ensureDailyForDate(today); }, [masters, today]);

  function ensureDailyForDate(dKey: string) {
    setDaily((prev) => {
      const map: DailyMap = { ...prev };
      const bucket: Record<string, DailyEntry> = { ...(map[dKey] ?? {}) };
      const d = parseKeyToDate(dKey);
      masters.forEach((h) => {
        if (isDeleted(h)) return;
        if (!isInRange(dKey, h.startDate, h.endDate)) return;
        if (h.weekend === false && isWeekendDay(d)) return;
        if (!bucket[h.id]) bucket[h.id] = { done: false };
      });
      map[dKey] = bucket; saveDaily(map); return map;
    });
  }
  function applicableMasterIds(dKey: string) {
    const d = parseKeyToDate(dKey);
    return masters.filter((h) => !isDeleted(h))
      .filter((h) => isInRange(dKey, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => h.id);
  }
  function toggleDone(habitId: string, dKey?: string, _evt?: React.MouseEvent) {
    const key = dKey ?? dateKeyTZ(new Date());
    const bucket = daily[key] ?? {};
    const wasDone = !!bucket[habitId]?.done;
    let completedAllAfter = false;
    const nowIso = new Date().toISOString();
    setDaily((prev) => {
      const map: DailyMap = { ...prev };
      const b: Record<string, DailyEntry> = { ...(map[key] ?? {}) };
      const current = b[habitId] ?? { done: false };
      const next: DailyEntry = current.done ? { done: false, updated_at: nowIso } : { done: true, doneAt: Date.now(), updated_at: nowIso };
      b[habitId] = next; map[key] = b;
      const ids = applicableMasterIds(key);
      completedAllAfter = ids.length > 0 && ids.every((id) => b[id]?.done === true);
      saveDaily(map); return map;
    });
    if (!wasDone && completedAllAfter) void confettiBurstXY(undefined, undefined, true);
  }

  const todayHabits: HabitView[] = useMemo(() => {
    const d = parseKeyToDate(today);
    const bucket = daily[today] ?? {};
    return masters
      .filter((h) => !isDeleted(h))
      .filter((h) => isInRange(today, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => ({ ...h, done: !!bucket[h.id]?.done }));
  }, [masters, daily, today]);

  const isTaskChecked = (slug: string, dayIdx: number, taskId: string) => !!checks?.[slug]?.[dayIdx]?.[taskId];
  const toggleTaskChecked = async (slug: string, dayIdx: number, taskId: string, evt?: React.MouseEvent) => {
    const cx = evt?.clientX, cy = evt?.clientY;
    const prevChecked = !!checks?.[slug]?.[dayIdx]?.[taskId];
    const nextChecked = !prevChecked;
    setChecks((prev) => {
      const next: ChecksMap = { ...(prev || {}) };
      next[slug] = { ...(next[slug] || {}) };
      next[slug][dayIdx] = { ...(next[slug][dayIdx] || {}) };
      if (nextChecked) next[slug][dayIdx][taskId] = true; else delete next[slug][dayIdx][taskId];
      saveProgramChecks(next); return next;
    });
    setChecksVersion((v) => v + 1);
    if (nextChecked) { void confettiBurstXY(cx, cy); requestAnimationFrame(() => void confettiBurstXY(cx, cy)); }
    try { await pushToggleTask({ slug, day: dayIdx, taskId, completed: nextChecked }); }
    catch {
      setChecks((prev) => {
        const next: ChecksMap = { ...(prev || {}) };
        next[slug] = { ...(next[slug] || {}) };
        next[slug][dayIdx] = { ...(next[slug][dayIdx] || {}) };
        if (prevChecked) next[slug][dayIdx][taskId] = true; else delete next[slug][dayIdx][taskId];
        saveProgramChecks(next); return next;
      });
      setChecksVersion((v) => v + 1);
    }
  };

  /* ===== Agregados para RUEDA / STATS / CALENDARIO ===== */
  const programsTodayTotals = useMemo(() => {
    let total = 0, done = 0;
    for (const slug of activePrograms) {
      const prog = getProgramBySlug(slug); if (!prog) continue;
      const dayIdx = getDayIndexFor(slug) ?? 0;
      const tasks = prog.days?.[dayIdx]?.tasks ?? [];
      total += tasks.length;
      const taskMap = checks?.[slug]?.[dayIdx] ?? {};
      done += tasks.reduce((acc, t, i) => acc + (taskMap[String(t.id ?? `${slug}-d${dayIdx}-t${i}`)] ? 1 : 0), 0);
    }
    return { total, done };
  }, [activePrograms, checks, programsTick]);

  const weekKeys = useMemo(() => {
    const start = startOfWeek(parseKeyToDate(today));
    return Array.from({ length: 7 }, (_, i) => dateKeyTZ(addDays(start, i)));
  }, [today]);

  const personalWeekAgg = useMemo(() => {
    let total = 0, done = 0;
    weekKeys.forEach((k) => {
      const ids = applicableMasterIds(k); total += ids.length;
      const bucket = daily[k] ?? {};
      done += ids.reduce((acc, id) => acc + (bucket[id]?.done ? 1 : 0), 0);
    });
    return { total, done };
  }, [weekKeys, masters, daily]);

  const wheelTotals = { total: programsTodayTotals.total + personalWeekAgg.total, done: programsTodayTotals.done + personalWeekAgg.done };

  const labelsWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const statsGoalPerDay = weekKeys.map((k) => applicableMasterIds(k).length + programsTodayTotals.total);
  const statsDonePerDay = weekKeys.map((k) => {
    const ids = applicableMasterIds(k), bucket = daily[k] ?? {};
    const perDone = ids.reduce((acc, id) => acc + (bucket[id]?.done ? 1 : 0), 0);
    return perDone + programsTodayTotals.done;
  });

  // Ranking (simulado)
  const points = wheelTotals.done * 10;
  const rank = Math.max(1, 500 - wheelTotals.done);

  // Calendario: colores por ratio (blanco, rojo, naranja, verde)
  function colorForDate(d: Date) {
    const k = dateKeyTZ(d);
    const ids = applicableMasterIds(k);
    const bucket = daily[k] ?? {};
    const personalDone = ids.reduce((acc, id) => acc + (bucket[id]?.done ? 1 : 0), 0);
    const total = ids.length + programsTodayTotals.total;
    const done = personalDone + programsTodayTotals.done;
    if (total === 0) return { color: '#ffffff', label: 'Sin actividades' };
    const ratio = done / total;
    if (done === 0) return { color: '#fee2e2', label: '0% completado' };         // rojo
    if (ratio < 1) return { color: '#ffedd5', label: `${Math.round(ratio*100)}% completado` }; // naranja
    return { color: '#dcfce7', label: '100% completado' };                        // verde
  }

  /* ===== RENDER ===== */
  return (
    <main className="mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8 py-6 bg-white">
      {/* Título */}
      <h1 className="text-xl font-black tracking-tight mb-3 leading-snug">Mi actividad</h1>

      {/* RUEDA */}
      <CircularWeekWheel done={wheelTotals.done} total={wheelTotals.total} />

      {/* Ranking */}
      <RankingCard username={username} points={points} rank={rank} avatar={avatar} />

      {/* Programas en progreso */}
      <SectionTitle>En progreso</SectionTitle>
      <div className="text-sm text-black/60 mb-2">Sigue con tus entrenamientos planificados.</div>
      <div className="space-y-3 mb-6">
        {activePrograms?.length ? (
          activePrograms.map((slug) => {
            const program = getProgramBySlug(slug);
            if (!program) return <div key={slug} className="text-sm text-black/60">Programa no encontrado: <b>{slug}</b></div>;
            const dayIdx = getDayIndexFor(program.slug) ?? 0;
            const progressDays = { current: dayIdx + 1, total: program.totalDays ?? program.days?.length };
            return (
              <ProgramActiveCard
                key={program.slug}
                program={{ ...program, image: resolveProgramImage(program) }}
                dayIdx={dayIdx}
                progressDays={progressDays}
                onClick={() => router.push(`/habitos/${program.slug}`)}
              />
            );
          })
        ) : (
          <EmptyBar label="Añadir programa" href="/habitos" />
        )}
      </div>

      {/* Estadísticas — único gráfico (sin texto extra) */}
      <SectionTitle>Estadísticas</SectionTitle>
      <div className="mb-6">
        <WeeklyChecksChart valuesGoal={statsGoalPerDay} valuesDone={statsDonePerDay} labels={labelsWeek} />
      </div>

      {/* Calendario */}
      <SectionTitle>Calendario</SectionTitle>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-black/60">Selecciona calendario</div>
        <select className="text-sm border rounded-md px-2 py-1" aria-label="Selector de calendario">
          <option>Calendario general</option>
        </select>
      </div>
      <div className="mb-6">
        <CalendarHeat
          baseDate={calDate}
          onPrev={() => setCalDate((d) => addMonths(d, -1))}
          onNext={() => setCalDate((d) => addMonths(d, +1))}
          colorForDate={colorForDate}
        />
      </div>

      {/* Crear hábito */}
      <SectionTitle>Crear hábito</SectionTitle>
      <EmptyBar label="Crear un nuevo hábito" href="/mizona/crear-habitos" />

      {/* Logros */}
      <SectionTitle>Logros</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--line, rgba(0,0,0,.12))' }}>
          <div className="text-2xl">🥉</div>
          <div className="text-xs mt-1">5 checks en una semana</div>
        </div>
        <div className="rounded-xl border p-3 text-center opacity-60" style={{ borderColor: 'var(--line, rgba(0,0,0,.12))' }}>
          <div className="text-2xl">🥈</div>
          <div className="text-xs mt-1">15 checks en una semana</div>
        </div>
        <div className="rounded-xl border p-3 text-center opacity-40" style={{ borderColor: 'var(--line, rgba(0,0,0,.12))' }}>
          <div className="text-2xl">🥇</div>
          <div className="text-xs mt-1">30 checks en una semana</div>
        </div>
      </div>

      {/* (Opcional) Lista de hábitos personales de hoy */}
      {todayHabits.length > 0 && (
        <section className="mt-6">
          <SubTitle>Creados por ti (hoy)</SubTitle>
          <ul className="space-y-3">
            {todayHabits.map((h) => {
              const theme = h.color ?? '#e6f7ee';
              return (
                <li key={h.id}>
                  <TaskPill
                    label={h.name}
                    checked={h.done}
                    color={theme}
                    onToggle={(e) => toggleDone(h.id, undefined, e)}
                    onInfo={undefined}
                    leftIcon={h.icon ?? '🏋️‍♀️'}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

/* =========================
Barras/tareas personales (pill)
========================= */
function TaskPill({
  label, checked, color, onToggle, onInfo, leftIcon,
}: {
  label: string; checked: boolean; color: string;
  onToggle: (e: React.MouseEvent) => void; onInfo?: () => void; leftIcon?: React.ReactNode;
}) {
  const bg = checked ? color : '#ffffff';
  const border = checked ? '#00000080' : `${color}66`;
  const lastXY = useRef<{ x?: number; y?: number }>({});
  const prevChecked = useRef<boolean>(checked);
  useEffect(() => {
    if (!prevChecked.current && checked) {
      const x = lastXY.current.x, y = lastXY.current.y;
      void confettiBurstXY(x, y); requestAnimationFrame(() => void confettiBurstXY(x, y));
    }
    prevChecked.current = checked;
  }, [checked]);

  return (
    <div className="flex items-center justify-between px-4 py-3"
      style={{ background: bg, color: '#111', border: `1px solid ${border}`, borderRadius: PILL_RADIUS }}>
      <button
        onMouseDown={(e) => { lastXY.current = { x: e.clientX, y: e.clientY }; }}
        onClick={onToggle}
        className="grid h-9 w-9 place-items-center rounded-full border shrink-0"
        title={checked ? 'Desmarcar' : 'Marcar'}
        aria-label={checked ? `Desmarcar ${label}` : `Marcar ${label}`}
        style={checked ? { background: '#22c55e', color: 'white', borderColor: '#16a34a' } : { background: 'white', borderColor: '#11111140' }}
      >
        {checked ? <Check size={16} /> : null}
      </button>

      <div className="mx-3 min-w-0 flex-1 flex items-center gap-3">
        {leftIcon ? <span className="text-xl shrink-0 leading-none" aria-hidden>{leftIcon}</span> : null}
        <div className="text-[15px] leading-snug font-medium break-words">{label}</div>
      </div>

      <button onClick={onInfo} className="grid h-9 w-9 place-items-center rounded-full border shrink-0"
        title="Ver detalles" aria-label={`Ver detalles de ${label}`} style={{ background: 'white', borderColor: '#11111140' }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/* =========================
Utils locales
========================= */
function normalizeSlugs(slugs: string[]) {
  const aliases = getAliases();
  return slugs.map((s) => (aliases[s] ?? s).replace(/-30$/, ''));
}
