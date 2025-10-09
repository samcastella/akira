'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check, Plus, Flame, ChevronRight } from 'lucide-react';
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
// Clave YYYY-MM-DD consistente en Europe/Madrid
const dateKeyTZ = (d = new Date(), tz = 'Europe/Madrid') => {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value!;
  const y = get('year');
  const m = get('month');
  const day = get('day');
  return `${y}-${m}-${day}`;
};
const startOfWeek = (d = new Date()) => {
  const dt = new Date(d);
  const wd = dt.getDay(); // 0=Dom
  const diff = (wd + 6) % 7; // Lunes como inicio
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const isInRange = (dKey: string, start?: string, end?: string) => {
  if (start && dKey < start) return false;
  if (end && dKey > end) return false;
  return true;
};
const isWeekendDay = (d: Date) => {
  const g = d.getDay(); // 0=Dom, 6=Sáb
  return g === 0 || g === 6;
};
const parseKeyToDate = (k: string) => new Date(`${k}T00:00:00`);

/* =========================
UI helpers
========================= */
const BORDER = '#E5E7EB';
const PILL_RADIUS = 9999;

/* ===== DEBUG confetti ===== */
function DBG(...args: any[]) {
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('akira_debug_confetti') === '1') {
      console.debug('[confetti]', ...args);
    }
  } catch {}
}
function markPoint(x?: number, y?: number, label = '') {
  if (typeof document === 'undefined') return;
  if (localStorage.getItem('akira_debug_confetti') !== '1') return;
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed',
    left: `${(x ?? window.innerWidth / 2) - 4}px`,
    top: `${(y ?? window.innerHeight / 2) - 4}px`,
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#ef4444',
    border: '1px solid #000',
    zIndex: '2147483647',
    pointerEvents: 'none',
    boxShadow: '0 0 0 2px rgba(239,68,68,.3)',
    transform: 'translateZ(0)',
  } as CSSStyleDeclaration);
  if (label) dot.title = label;
  document.body.appendChild(dot);
  setTimeout(() => dot.remove(), 1200);
}

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
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '2147483647',
      background: 'transparent',
    });
    document.body.appendChild(confettiCanvas);
    DBG('canvas created & appended');
  }
  if (!confettiInstance) {
    confettiInstance = confetti.create(confettiCanvas, { resize: true, useWorker: true });
    DBG('confetti instance created');
  }
  return confettiInstance;
}

async function confettiBurstXY(x?: number, y?: number, big = false) {
  try {
    const hidden = typeof document === 'undefined' ? false : document.hidden;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    DBG('burst request', { x, y, big, hidden, prefersReduced });

    if (hidden || prefersReduced) return;

    const shoot = await getConfettiShooter();
    const ox = Math.min(Math.max((x ?? window.innerWidth / 2) / window.innerWidth, 0), 1);
    const oy = Math.min(Math.max((y ?? window.innerHeight / 2) / window.innerHeight, 0), 1);

    markPoint(x, y, 'burst');
    DBG('shoot', { origin: { ox, oy }, big });

    shoot({
      particleCount: big ? 180 : 80,
      spread: big ? 90 : 65,
      startVelocity: big ? 45 : 35,
      ticks: 220,
      gravity: 0.9,
      origin: { x: ox, y: oy },
      scalar: big ? 1.05 : 0.9,
    });
  } catch (e) {
    DBG('ERROR shoot', e);
  }
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

/* =========================
Helper “soft-delete”
========================= */
const isDeleted = (h: any): boolean => !!h?.deleted_at;

/* =========================
Componentes visuales
========================= */

// ——— Título de sección
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-extrabold tracking-tight mb-2">{children}</h3>;
}
// ——— Subtítulo pequeño
function SubTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold tracking-tight mb-2">{children}</h4>;
}
// ——— CTA vacío
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
Rueda de progreso semanal
========================= */
function CircularWeekWheel({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const size = 200;
  const strokeW = 14;
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  const pct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const dash = C * pct;
  const gap = C - dash;

  // posición del marcador 🔥
  const angle = -Math.PI / 2 + 2 * Math.PI * pct;
  const px = cx + r * Math.cos(angle);
  const py = cy + r * Math.sin(angle);

  return (
    <div className="grid place-items-center my-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <defs>
          <linearGradient id="akiraWheel" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffe044" />     {/* amarillo */}
            <stop offset="50%" stopColor="#ff8a00" />    {/* naranja */}
            <stop offset="100%" stopColor="#ff3b30" />   {/* rojo */}
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* base gris clara */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#eee"
          strokeWidth={strokeW}
          fill="none"
        />

        {/* progreso degradado */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="url(#akiraWheel)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${gap}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          filter="url(#softShadow)"
        />

        {/* marcador 🔥 */}
        <g transform={`translate(${px}, ${py})`}>
          <circle r={strokeW / 2} fill="#fff" stroke="#00000020" />
          <text x="0" y="4" fontSize="14" textAnchor="middle">🔥</text>
        </g>
      </svg>

      <div className="mt-3 text-center">
        <div className="text-xs uppercase tracking-wide text-black/60">Actividades de esta semana</div>
        <div className="mt-1 text-lg font-bold">
          {total > 0 ? Math.round((done / total) * 100) : 0}% completado
        </div>
        <div className="text-sm text-black/60">{done}/{total} checks</div>
      </div>
    </div>
  );
}

/* =========================
Tarjeta de Programa activo
========================= */
function ProgramActiveCard({
  program,
  dayIdx,
  progressDays,
  onClick,
}: {
  program: ProgramDef;
  dayIdx: number;
  progressDays: { current: number; total?: number };
  onClick: () => void;
}) {
  const color = program.themeColor || '#fff8dc';
  const totalDays = program.totalDays ?? program.days?.length ?? undefined;
  const cur = Math.max(1, progressDays.current);
  const tot = progressDays.total ?? totalDays ?? 30;
  const pct = Math.max(0, Math.min(100, Math.round((cur / tot) * 100)));

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border p-3 md:p-4 flex items-center gap-3 md:gap-4 hover:shadow-sm transition"
      style={{ borderColor: 'var(--line, rgba(0,0,0,.12))', background: '#fff' }}
      aria-label={`Abrir ${program.title}`}
    >
      <div
        className="shrink-0 grid place-items-center rounded-full overflow-hidden"
        style={{ width: 56, height: 56, background: color, border: '1px solid #00000014' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {program.image ? (
          <img src={program.image} alt={program.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">🏁</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight truncate">{program.title}</div>
        <div className="mt-1 h-2 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
          <div
            className="h-full"
            style={{ width: `${pct}%`, background: color, border: '1px solid #00000020' }}
          />
        </div>
        <div className="mt-1 text-xs text-black/60">
          Día {cur}/{tot} — índice actual: {dayIdx}
        </div>
      </div>

      <ChevronRight className="shrink-0 text-black/40" />
    </button>
  );
}

/* =========================
Mini gráficos (SVG simple)
========================= */
function MiniLineChart({
  valuesA,
  valuesB,
  labels,
  labelA = 'Objetivo',
  labelB = 'Realizado',
}: {
  valuesA: number[];
  valuesB: number[];
  labels: string[];
  labelA?: string;
  labelB?: string;
}) {
  const w = 320;
  const h = 120;
  const pad = 16;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const maxV = Math.max(1, ...valuesA, ...valuesB);
  const pts = (vals: number[]) =>
    vals.map((v, i) => {
      const x = pad + (i * innerW) / (vals.length - 1 || 1);
      const y = pad + innerH - (v / maxV) * innerH;
      return `${x},${y}`;
    }).join(' ');

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--line, rgba(0,0,0,.12))' }}>
      <div className="px-3 py-2 text-xs text-black/60 flex items-center gap-3">
        <span className="inline-block w-3 h-3 rounded-full bg-gray-300 border" />
        {labelA}
        <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 border ml-4" />
        {labelB}
      </div>
      <svg width={w} height={h} role="img" aria-label={`${labelA} vs ${labelB}`}>
        {/* grid horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad}
            y1={pad + t * innerH}
            x2={w - pad}
            y2={pad + t * innerH}
            stroke="#f1f5f9"
          />
        ))}
        {/* líneas */}
        <polyline fill="none" stroke="#d1d5db" strokeWidth={2} points={pts(valuesA)} />
        <polyline fill="none" stroke="#10b981" strokeWidth={2.5} points={pts(valuesB)} />
        {/* labels de días abajo */}
        {labels.map((lb, i) => {
          const x = pad + (i * innerW) / (labels.length - 1 || 1);
          return (
            <text key={lb + i} x={x} y={h - 2} fontSize="10" textAnchor="middle" fill="#94a3b8">
              {lb}
            </text>
          );
        })}
      </svg>
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
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      midnightTimer.current = window.setTimeout(() => {
        setToday(dateKeyTZ());
        setActivePrograms(normalizeSlugs(getActiveSlugs()));
        schedule();
      }, ms + 1000);
    };
    schedule();
    return () => {
      if (midnightTimer.current) window.clearTimeout(midnightTimer.current);
    };
  }, []);

  // usuario
  const user = (useUserProfile?.() as any) || {};
  const fullName = String(user?.nombre ?? '').trim();
  const firstName = fullName.split(/\s+/).filter(Boolean)[0] || '';
  const greetingName = firstName || (user?.username ?? 'usuario/a');
  const avatar = (user?.foto as string | undefined) || undefined;

  // auth
  const uid = useAuthUserId();

  // === helpers ===
  function refreshActivesFromLocal() {
    setActivePrograms(normalizeSlugs(getActiveSlugs()));
  }

  // reconstruir checks desde programsLocal (día actual)
  function rebuildChecksFromProgramsLocal(slugs: string[]) {
    const store: LocalStore = loadProgramsLocalStore() || {};
    const rebuilt: ChecksMap = {};
    for (const slug of slugs) {
      const dayIdx = getDayIndexFor(slug) ?? 0;
      const prog = store[slug];
      const dayMap = (prog as any)?.progress?.[dayIdx] || {};
      const taskMap: Record<string, true> = {};
      for (const [taskId, done] of Object.entries(dayMap)) {
        if (done) taskMap[taskId] = true;
      }
      if (Object.keys(taskMap).length) {
        if (!rebuilt[slug]) rebuilt[slug] = {};
        rebuilt[slug][dayIdx] = taskMap;
      }
    }
    saveProgramChecks(rebuilt);
    setChecks(rebuilt);
  }

  // Carga inicial + sync
  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());

    // Normalizar checks a slugs canónicos (legacy)
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
          await pullUserPrograms();                 // DB → local
          initProgramsLocal();
          const act = normalizeSlugs(getActiveSlugs());
          setActivePrograms(act);
          rebuildChecksFromProgramsLocal(act);      // pinta checks del servidor
        }
      } catch {}
    })();

    // listeners
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

  // asegurar bucket de hoy (hábitos personales)
  useEffect(() => {
    if (masters.length === 0) return;
    ensureDailyForDate(today);
  }, [masters, today]);

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

      map[dKey] = bucket;
      saveDaily(map);
      return map;
    });
  }

  // helpers hábitos personales
  function applicableMasterIds(dKey: string) {
    const d = parseKeyToDate(dKey);
    return masters
      .filter((h) => !isDeleted(h))
      .filter((h) => isInRange(dKey, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => h.id);
  }

  // toggle hábitos personales
  function toggleDone(habitId: string, dKey?: string, evt?: React.MouseEvent) {
    const key = dKey ?? dateKeyTZ(new Date());
    const bucket = daily[key] ?? {};
    const wasDone = !!bucket[habitId]?.done;
    let completedAllAfter = false;

    const nowIso = new Date().toISOString();

    setDaily((prev) => {
      const map: DailyMap = { ...prev };
      const b: Record<string, DailyEntry> = { ...(map[key] ?? {}) };
      const current = b[habitId] ?? { done: false };
      const next: DailyEntry = current.done
        ? { done: false, updated_at: nowIso }
        : { done: true, doneAt: Date.now(), updated_at: nowIso };
      b[habitId] = next;
      map[key] = b;

      const ids = applicableMasterIds(key);
      completedAllAfter = ids.length > 0 && ids.every((id) => b[id]?.done === true);

      saveDaily(map);
      return map;
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

  // checks de programas (local cache)
  const isTaskChecked = (slug: string, dayIdx: number, taskId: string) =>
    !!checks?.[slug]?.[dayIdx]?.[taskId];

  const toggleTaskChecked = async (
    slug: string,
    dayIdx: number,
    taskId: string,
    evt?: React.MouseEvent
  ) => {
    const cx = evt?.clientX;
    const cy = evt?.clientY;
    markPoint(cx, cy, 'toggle');

    const prevChecked = !!checks?.[slug]?.[dayIdx]?.[taskId];
    const nextChecked = !prevChecked;

    // UI optimista
    setChecks((prev) => {
      const next: ChecksMap = { ...(prev || {}) };
      next[slug] = { ...(next[slug] || {}) };
      next[slug][dayIdx] = { ...(next[slug][dayIdx] || {}) };
      if (nextChecked) next[slug][dayIdx][taskId] = true;
      else delete next[slug][dayIdx][taskId];
      saveProgramChecks(next);
      return next;
    });
    setChecksVersion((v) => v + 1);

    if (nextChecked) {
      void confettiBurstXY(cx, cy);
      requestAnimationFrame(() => void confettiBurstXY(cx, cy));
    }

    try {
      await pushToggleTask({ slug, day: dayIdx, taskId, completed: nextChecked });
    } catch (e) {
      // revert
      setChecks((prev) => {
        const next: ChecksMap = { ...(prev || {}) };
        next[slug] = { ...(next[slug] || {}) };
        next[slug][dayIdx] = { ...(next[slug][dayIdx] || {}) };
        if (prevChecked) next[slug][dayIdx][taskId] = true;
        else delete next[slug][dayIdx][taskId];
        saveProgramChecks(next);
        return next;
      });
      setChecksVersion((v) => v + 1);
    }

    try {
      window.dispatchEvent(
        new CustomEvent('akira:program-check-updated', {
          detail: { slug, dayIdx, taskId, done: nextChecked, updatedAt: new Date().toISOString() },
        })
      );
    } catch {}
  };

  /* =========================
  Agregados para la RUEDA y STATS
  ========================== */

  // 1) PROGRAMAS: tareas del día actual (hasta que guardemos histórico real)
  const programsTodayTotals = useMemo(() => {
    let total = 0;
    let done = 0;

    for (const slug of activePrograms) {
      const prog = getProgramBySlug(slug);
      if (!prog) continue;
      const dayIdx = getDayIndexFor(slug) ?? 0;
      const tasks = prog.days?.[dayIdx]?.tasks ?? [];
      total += tasks.length;

      const taskMap = checks?.[slug]?.[dayIdx] ?? {};
      done += tasks.reduce((acc, t, i) => {
        const tid = String(t.id ?? `${slug}-d${dayIdx}-t${i}`);
        return acc + (taskMap[tid] ? 1 : 0);
      }, 0);
    }
    return { total, done };
  }, [activePrograms, checks, programsTick]);

  // 2) HÁBITOS PERSONALES: sumatorio semanal real desde LS_HABITS_DAILY
  const weekKeys = useMemo(() => {
    const start = startOfWeek(parseKeyToDate(today));
    return Array.from({ length: 7 }, (_, i) => dateKeyTZ(addDays(start, i)));
  }, [today]);

  const personalWeekAgg = useMemo(() => {
    let total = 0;
    let done = 0;

    weekKeys.forEach((k) => {
      const ids = applicableMasterIds(k);
      total += ids.length;
      const bucket = daily[k] ?? {};
      done += ids.reduce((acc, id) => acc + (bucket[id]?.done ? 1 : 0), 0);
    });

    return { total, done };
  }, [weekKeys, masters, daily]);

  // 3) RUEDA: mezcla actual → programas (día) + personales (semana)
  //    TODO: cuando guardemos histórico de programas, cambiaremos 'programasTodayTotals' por 'programasWeekAgg'
  const wheelTotals = {
    total: programsTodayTotals.total + personalWeekAgg.total,
    done: programsTodayTotals.done + personalWeekAgg.done,
  };

  // 4) STATS: arrays L..D
  const labelsWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  // objetivo = número de actividades objetivo por día (programas hoy + personales de ese día)
  const statsGoalPerDay = weekKeys.map((k) => {
    // personales
    const perIds = applicableMasterIds(k).length;
    // programas (aprox: usamos tareas del "día actual" como proxy mientras no hay histórico)
    return perIds + programsTodayTotals.total;
  });
  // realizado
  const statsDonePerDay = weekKeys.map((k) => {
    const perIds = applicableMasterIds(k);
    const bucket = daily[k] ?? {};
    const perDone = perIds.reduce((acc, id) => acc + (bucket[id]?.done ? 1 : 0), 0);
    return perDone + programsTodayTotals.done; // aprox hasta histórico real
  });

  // 5) Estadística del DÍA (línea doble)
  const labelsDay = ['Objetivo', 'Realizado'];
  const todayGoal = statsGoalPerDay[ (new Date(parseKeyToDate(today)).getDay() + 6) % 7 ];
  const todayDone = statsDonePerDay[ (new Date(parseKeyToDate(today)).getDay() + 6) % 7 ];

  /* ===== RENDER ===== */
  return (
    <main className="mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8 py-6" style={{ background: 'white' }}>
      <HeaderMinimal avatar={avatar} greetingName={greetingName} />

      {/* Título principal */}
      <h1 className="text-2xl font-black tracking-tight mb-2">Mi actividad</h1>
      <p className="text-sm text-black/60 mb-4">
        Resumen de tu semana y tus progresos diarios.
      </p>

      {/* RUEDA */}
      <CircularWeekWheel done={wheelTotals.done} total={wheelTotals.total} />

      {/* Programas activos */}
      <SectionTitle>Programas activos</SectionTitle>
      <div className="space-y-3 mb-6">
        {activePrograms?.length ? (
          activePrograms.map((slug) => {
            const program = getProgramBySlug(slug);
            if (!program) return (
              <div key={slug} className="text-sm text-black/60">Programa no encontrado: <b>{slug}</b></div>
            );
            const dayIdx = getDayIndexFor(program.slug) ?? 0;
            const progressDays = { current: dayIdx + 1, total: program.totalDays ?? program.days?.length };

            return (
              <ProgramActiveCard
                key={program.slug}
                program={program}
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

      {/* Estadísticas */}
      <SectionTitle>Estadísticas</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <SubTitle>Semana (L–D)</SubTitle>
          <MiniLineChart
            valuesA={statsGoalPerDay}
            valuesB={statsDonePerDay}
            labels={labelsWeek}
            labelA="Objetivo"
            labelB="Realizado"
          />
        </div>
        <div>
          <SubTitle>Actividades de hoy</SubTitle>
          <MiniLineChart
            valuesA={[todayGoal, todayGoal]}
            valuesB={[todayDone, todayDone]}
            labels={['', '']}
            labelA="Objetivo"
            labelB="Realizado"
          />
        </div>
      </div>

      {/* Crear hábito */}
      <SectionTitle>Crear hábito</SectionTitle>
      <EmptyBar label="Crear un nuevo hábito" href="/mizona/crear-habitos" />

      {/* (Opcional) Lista de hábitos personales de hoy */}
      {todayHabits.length > 0 && (
        <section className="mt-6">
          <SubTitle>Creados por ti (hoy)</SubTitle>
          <ul className="space-y-3">
            {todayHabits.map((h) => {
              const checked = h.done;
              const theme = h.color ?? '#e6f7ee';
              return (
                <li key={h.id}>
                  <TaskPill
                    label={h.name}
                    checked={checked}
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
Subcomponentes simples
========================= */
function HeaderMinimal({ avatar, greetingName }: { avatar?: string; greetingName: string }) {
  return (
    <section className="mb-5 flex items-center gap-3">
      <Link
        href="/mizona/perfil"
        className="rounded-full overflow-hidden flex items-center justify-center"
        style={{ width: 32, height: 32, border: `1px solid ${BORDER}`, background: '#f7f7f7' }}
        aria-label="Ir a mi perfil"
        title="Mi perfil"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 16, color: '#9ca3af' }}>👤</span>
        )}
      </Link>
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold m-0 leading-none">Hola {greetingName},</h2>
        <p className="mt-1 text-sm text-black/70 m-0">Sigue construyendo tus hábitos 🔥</p>
      </div>
    </section>
  );
}

/* =========================
Barras/tareas personales (pill)
========================= */
function TaskPill({
  label,
  checked,
  color,
  onToggle,
  onInfo,
  leftIcon,
}: {
  label: string;
  checked: boolean;
  color: string;
  onToggle: (e: React.MouseEvent) => void;
  onInfo?: () => void;
  leftIcon?: React.ReactNode;
}) {
  const bg = checked ? color : '#ffffff';
  const border = checked ? '#00000080' : `${color}66`;
  const text = '#111111';

  const lastXY = useRef<{ x?: number; y?: number }>({});
  const prevChecked = useRef<boolean>(checked);
  useEffect(() => {
    if (!prevChecked.current && checked) {
      const gxy =
        (typeof window !== 'undefined' && (window as any).__akiraLastXY) || {};
      const x = lastXY.current.x ?? (gxy as any).x;
      const y = lastXY.current.y ?? (gxy as any).y;
      markPoint(x, y, 'TaskPill');
      void confettiBurstXY(x, y);
      requestAnimationFrame(() => void confettiBurstXY(x, y));
    }
    prevChecked.current = checked;
  }, [checked]);

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        borderRadius: PILL_RADIUS,
      }}
    >
      <button
        onMouseDown={(e) => {
          lastXY.current = { x: e.clientX, y: e.clientY };
          (window as any).__akiraLastXY = { x: e.clientX, y: e.clientY };
          markPoint(e.clientX, e.clientY, 'md');
        }}
        onClick={onToggle}
        className="grid h-9 w-9 place-items-center rounded-full border shrink-0"
        title={checked ? 'Desmarcar' : 'Marcar'}
        aria-label={checked ? `Desmarcar ${label}` : `Marcar ${label}`}
        style={
          checked
            ? { background: '#22c55e', color: 'white', borderColor: '#16a34a' }
            : { background: 'white', borderColor: '#11111140' }
        }
      >
        {checked ? <Check size={16} /> : null}
      </button>

      <div className="mx-3 min-w-0 flex-1 flex items-center gap-3">
        {leftIcon ? <span className="text-xl shrink-0 leading-none" aria-hidden>{leftIcon}</span> : null}
        <div className="text-[15px] leading-snug font-medium break-words">
          {label}
        </div>
      </div>

      <button
        onClick={onInfo}
        className="grid h-9 w-9 place-items-center rounded-full border shrink-0"
        title="Ver detalles"
        aria-label={`Ver detalles de ${label}`}
        style={{ background: 'white', borderColor: '#11111140' }}
      >
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
