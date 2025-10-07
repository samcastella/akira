// src/app/mizona/mis-habitos/HabitosClient.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import type { HabitMaster } from '@/components/habits/HabitForm';
import { useUserProfile, useAuthUserId } from '@/lib/user';

import {
  initProgramsLocal,
  getActiveSlugs,
  getDayIndexFor,
  LS_ACTIVE as LS_PROGRAMS_ACTIVE,
} from '@/lib/programsLocal';
import { pullUserPrograms } from '@/lib/programSync';

/* 🔗 SYNC Supabase */
import { useHabitsSupabaseSync, queueTickUpsert } from '@/lib/useHabitsSupabaseSync';

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
const dateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
   Markdown inline: **negrita**
   ========================= */
function renderInlineMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const [full, bold] = m;
    const start = m.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <strong key={`b-${start}`} className="font-semibold">
        {bold}
      </strong>
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/* =========================
   Confeti (canvas propio, precalentado)
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
    const hidden = typeof document !== 'undefined' ? document.hidden : false;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    DBG('burst request', { x, y, big, hidden, prefersReduced });

    if (hidden) {
      DBG('SKIP: document.hidden === true (página no visible)');
      return;
    }
    if (prefersReduced) {
      DBG('SKIP: prefers-reduced-motion');
      return;
    }

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
   Modal simple para detalles
   ========================= */
function TaskDetailModal({
  open,
  onClose,
  title,
  detail,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  detail?: string;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9998] grid place-items-center p-4"
      style={{ background: 'rgba(0,0,0,.35)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-sm font-medium">{renderInlineMarkdown(title)}</div>
        <div className="text-sm text-black/75 whitespace-pre-line">
          {detail ? renderInlineMarkdown(detail) : 'Sin descripción.'}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--line, rgba(0,0,0,.16))' }}
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Barra de tarea (píldora)
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
      DBG('TaskPill effect -> rising edge', { x, y, label });
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
          DBG('TaskPill mousedown', { x: e.clientX, y: e.clientY, label });
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
          {renderInlineMarkdown(label)}
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
   Programas: bloque
   ========================= */
function ProgramMiniBar({
  slug,
  onToggle,
  isChecked,
  programsTick,
}: {
  slug: string;
  onToggle: (slug: string, dayIdx: number, taskId: string, e?: React.MouseEvent) => void;
  isChecked: (slug: string, dayIdx: number, taskId: string) => boolean;
  programsTick: number;
}) {
  void programsTick;

  const program = getProgramBySlug(slug);
  const [openTask, setOpenTask] = useState<{ title: string; detail?: string } | null>(null);

  if (!program) {
    return (
      <div className="px-1 py-1">
        <div className="text-sm text-black/60">
          Programa no encontrado en datos: <b>{slug}</b>
        </div>
      </div>
    );
  }

  const canonSlug = program.slug;
  const dayIdx = getDayIndexFor(canonSlug) ?? 0;
  const tasks: ProgramTask[] = program?.days?.[dayIdx]?.tasks || [];

  const theme = program.themeColor || '#fff8dc';

  return (
    <div className="px-1 py-1">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">
        {program.title || canonSlug}
      </div>

      {tasks.length === 0 ? (
        <span className="text-xs text-black/50">Hoy no hay tareas.</span>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t, i) => {
            const taskId = String(t.id ?? `${canonSlug}-d${dayIdx}-t${i}`);
            const checked = isChecked(canonSlug, dayIdx, taskId);
            const label = t.label || `Tarea ${i + 1}`;
            return (
              <li key={taskId}>
                <TaskPill
                  label={label}
                  checked={checked}
                  color={theme}
                  onToggle={(e) => onToggle(canonSlug, dayIdx, taskId, e)}
                  onInfo={() => setOpenTask({ title: label, detail: t.detail })}
                />
              </li>
            );
          })}
        </ul>
      )}

      <TaskDetailModal
        open={!!openTask}
        onClose={() => setOpenTask(null)}
        title={openTask?.title || ''}
        detail={openTask?.detail}
      />
    </div>
  );
}

/* =========================
   Componente principal
   ========================= */
export default function HabitosClient() {
  const pathname = usePathname();

  const [masters, setMasters] = useState<HabitMaster[]>([]);
  const [daily, setDaily] = useState<DailyMap>({});
  const [today, setToday] = useState<string>(dateKey());

  const [activePrograms, setActivePrograms] = useState<string[]>([]);
  const [checks, setChecks] = useState<ChecksMap>({});
  const [checksVersion, setChecksVersion] = useState<number>(0);
  const [programsTick, setProgramsTick] = useState<number>(0);

  // Utilidades de depuración en consola
  useEffect(() => {
    (window as any).akiraConfettiOn = () => localStorage.setItem('akira_debug_confetti', '1');
    (window as any).akiraConfettiOff = () => localStorage.removeItem('akira_debug_confetti');
    (window as any).akiraConfettiInfo = () => {
      const info = {
        hidden: document.hidden,
        reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
        hasCanvas: !!document.getElementById('akira-confetti'),
        lastXY: (window as any).__akiraLastXY,
      };
      console.debug('[confetti] info', info);
      return info;
    };
  }, []);

  // Precalentar confeti al montar
  useEffect(() => {
    void getConfettiShooter().catch(() => {});
    (window as any).akiraConfettiTest = () => confettiBurstXY();
  }, []);

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

  // rollover a medianoche
  const midnightTimer = useRef<number | null>(null);
  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      midnightTimer.current = window.setTimeout(() => {
        setToday(dateKey());
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
  const username = String(user?.username ?? '').trim();
  const fullName = String(user?.nombre ?? '').trim();
  const firstName = fullName.split(/\s+/).filter(Boolean)[0] || '';
  const greetingName = firstName || username || 'usuario/a';
  const avatar = (user?.foto as string | undefined) || undefined;

  // cargar estado inicial + sync de programas
  const uid = useAuthUserId();

  /* 🔗 activa sincronización (pull + flush periódicos) */
  useHabitsSupabaseSync(uid ?? undefined);

  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());

    // Normalizar checks a slugs canónicos
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

    // Init + primer refresco
    initProgramsLocal();
    const refreshActives = () => setActivePrograms(normalizeSlugs(getActiveSlugs()));
    refreshActives();

    const t0 = setTimeout(refreshActives, 250);
    const t1 = setTimeout(refreshActives, 750);

    (async () => {
      try { if (uid) await pullUserPrograms(); } catch {}
      initProgramsLocal();
      refreshActives();
    })();

    // listeners
    const onProgramsUpdated = () => refreshActives();
    const onVisibility = () => { if (!document.hidden) refreshActives(); };
    const onFocus = () => refreshActives();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_PROGRAMS_ACTIVE || e.key === LS_PROGRAMS_ACTIVE_LEGACY) refreshActives();
      if (e.key === LS_PROGRAM_CHECKS) setChecks(loadProgramChecks());
      // ⬅️ rehidratar masters al cambiar la lista local (p.ej. soft-delete desde CrearHabitosPage)
      if (e.key === LS_HABITS_MASTER) setMasters(loadMasterHabits());
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
        // ⬅️ ignora soft-deleted
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

  // toggle hábitos personales (celebración grande si completas todos) + ⬆️ sync tick
  function toggleDone(habitId: string, dKey?: string, evt?: React.MouseEvent) {
    const key = dKey ?? today;
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

    // ⬆️ encolar para Supabase
    queueTickUpsert({
      habit_id: habitId,
      date_key: key,
      done: !wasDone,
      done_at: !wasDone ? nowIso : null,
      updated_at: nowIso,
    });

    if (!wasDone && completedAllAfter) void confettiBurstXY(undefined, undefined, true);
  }

  const todayHabits: HabitView[] = useMemo(() => {
    const d = parseKeyToDate(today);
    const bucket = daily[today] ?? {};
    return masters
      .filter((h) => !isDeleted(h)) // ignora soft-deleted en la UI
      .filter((h) => isInRange(today, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => ({ ...h, done: !!bucket[h.id]?.done }));
  }, [masters, daily, today]);

  // checks de programas (local)
  const isTaskChecked = (slug: string, dayIdx: number, taskId: string) =>
    !!checks?.[slug]?.[dayIdx]?.[taskId];

  const toggleTaskChecked = (
    slug: string,
    dayIdx: number,
    taskId: string,
    evt?: React.MouseEvent
  ) => {
    const cx = evt?.clientX;
    const cy = evt?.clientY;
    DBG('toggleTaskChecked called', { slug, dayIdx, taskId, cx, cy });
    markPoint(cx, cy, 'toggle');

    let willBeChecked = false;

    setChecks((prev) => {
      const next: ChecksMap = { ...(prev || {}) };
      next[slug] = { ...(next[slug] || {}) };
      next[slug][dayIdx] = { ...(next[slug][dayIdx] || {}) };
      if (next[slug][dayIdx][taskId]) {
        delete next[slug][dayIdx][taskId];
      } else {
        next[slug][dayIdx][taskId] = true;
        willBeChecked = true;
      }
      saveProgramChecks(next);
      return next;
    });
    setChecksVersion((v) => v + 1);

    if (willBeChecked) {
      DBG('CONFETTI from toggleTaskChecked', { cx, cy });
      void confettiBurstXY(cx, cy);
      requestAnimationFrame(() => void confettiBurstXY(cx, cy));
      setTimeout(() => void confettiBurstXY(cx, cy), 40);
    }
  };

  /* ===== RENDER ===== */
  return (
    <main className="mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8 py-6" style={{ background: 'white' }}>
      <HeaderMinimal avatar={avatar} greetingName={greetingName} />
      <TopMenu />

      <SectionTitle>
        Retos para hoy —{' '}
        <span className="font-normal">
          {new Date(`${today}T00:00:00`).toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </SectionTitle>

      {/* 1) Creados por ti */}
      <section className="mb-6">
        <SubTitle>Creados por ti</SubTitle>
        {todayHabits.length === 0 ? (
          <EmptyBar label="Añadir hábito personal" href="/mizona/crear-habitos" />
        ) : (
          <ul className="space-y-3">
            {todayHabits.map((h) => {
              const checked = h.done;
              const label = h.name;
              const theme = h.color ?? '#e6f7ee';

              return (
                <li key={h.id}>
                  <TaskPill
                    label={label}
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
        )}
      </section>

      {/* 2) Programas activos */}
      <section className="mb-6">
        <SubTitle>Programas activos</SubTitle>

        {activePrograms?.length ? (
          <div className="space-y-6">
            {activePrograms.map((slug) => (
              <ProgramMiniBar
                key={slug}
                slug={slug}
                onToggle={toggleTaskChecked}
                isChecked={isTaskChecked}
                programsTick={programsTick}
              />
            ))}
          </div>
        ) : (
          <EmptyBar label="Añadir programa" href="/habitos" />
        )}
      </section>

      {/* 3) Retos con amigos */}
      <section className="mb-2">
        <SubTitle>Retos con amigos</SubTitle>
        <EmptyBar label="Añadir reto con amigos" href="/mis-amigos" />
      </section>
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
        <h1 className="text-xl font-extrabold m-0 leading-none">Hola {greetingName},</h1>
        <p className="mt-1 text-sm text-black/70 m-0">Gestiona tus hábitos y retos diarios.</p>
      </div>
    </section>
  );
}

function TopMenu() {
  return (
    <nav className="mb-4 flex flex-wrap gap-3">
      <Link href="/mizona" className="btn" style={{ background: 'black', color: 'white', border: '1px solid black' }}>
        Mis hábitos
      </Link>
      <Link href="/mizona/crear-habitos" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
        Crear hábito
      </Link>
      <Link href="/mizona/logros" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
        Logros
      </Link>
      <Link href="/mizona/perfil" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
        Mi perfil
      </Link>
      <Link href="/mizona/calendarios" className="btn" style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}>
        Calendarios
      </Link>
    </nav>
  );
}

/* =========================
   Utils locales
   ========================= */
function normalizeSlugs(slugs: string[]) {
  const aliases = getAliases();
  return slugs.map((s) => (aliases[s] ?? s).replace(/-30$/, ''));
}
