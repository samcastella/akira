// src/app/mizona/mis-habitos/HabitosClient.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import type { HabitMaster } from '@/components/habits/HabitForm';
import { useUserProfile, useAuthUserId } from '@/lib/user';

import { PROGRAMS } from '@/data/programs';
import {
  initProgramsLocal,
  getActiveSlugs,
  getDayIndexFor,
  LS_ACTIVE as LS_PROGRAMS_ACTIVE, // 'akira_programs_active_v1'
} from '@/lib/programsLocal';
import { pullUserPrograms } from '@/lib/programSync';

/* =========================
   Constantes / Tipos
   ========================= */
const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY = 'akira_habits_daily_v1';
const LS_PROGRAM_CHECKS = 'akira_programs_daily_checks_v1'; // { [slug]: { [dayIdx]: { [taskId]: true } } }
const LS_PROGRAMS_ACTIVE_LEGACY = 'akira_program_active'; // legacy single-object (por si acaso)

type DailyEntry = { done: boolean; doneAt?: number };
type DailyMap = Record<string, Record<string, DailyEntry>>;
type HabitView = HabitMaster & { done: boolean };

type ProgramTask = { id?: string; label: string; detail?: string; tags?: string[] };
type ProgramDef = {
  slug: string;
  title: string;
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
   Confeti
   ========================= */
async function confettiBurst(evt?: React.MouseEvent, big = false) {
  try {
    const { default: confetti } = await import('canvas-confetti');
    const x = evt?.clientX ?? window.innerWidth / 2;
    const y = evt?.clientY ?? window.innerHeight / 2;
    const ox = Math.min(Math.max(x / window.innerWidth, 0), 1);
    const oy = Math.min(Math.max(y / window.innerHeight, 0), 1);

    confetti({
      particleCount: big ? 180 : 80,
      spread: big ? 90 : 65,
      startVelocity: big ? 45 : 35,
      ticks: 220,
      gravity: 0.9,
      origin: { x: ox, y: oy },
      scalar: big ? 1.05 : 0.9,
      zIndex: 9999,
    });
  } catch {}
}

/* =========================
   Programas: lookup con fallbacks
   ========================= */
function normalizeSlug(slug: string) {
  return String(slug).replace(/-30$/, '');
}

/** Caché interna para hidratar datos cuando el import estático no llega al cliente. */
let __PROGRAMS_CACHE: any = null;

function getProgramBySlug(slug: string): ProgramDef | null {
  const s = normalizeSlug(slug);

  // 1) import estático (si llegó al bundle de cliente)
  const fromImport: any = (PROGRAMS as any) || null;
  if (fromImport) {
    if (Array.isArray(fromImport)) return fromImport.find((p) => normalizeSlug(p.slug) === s) || null;
    if (typeof fromImport === 'object') return (fromImport as Record<string, ProgramDef>)[s] || null;
  }

  // 2) caché / window.__PROGRAMS (inyectado en runtime)
  const srcCache: any =
    __PROGRAMS_CACHE ||
    (typeof window !== 'undefined' ? (window as any).__PROGRAMS : null);

  if (srcCache) {
    if (Array.isArray(srcCache)) return srcCache.find((p: any) => normalizeSlug(p.slug) === s) || null;
    if (typeof srcCache === 'object') {
      return (
        (srcCache as Record<string, ProgramDef>)[s] ||
        Object.values(srcCache as Record<string, ProgramDef>).find((p) => normalizeSlug(p.slug) === s) ||
        null
      );
    }
  }

  return null;
}

function ProgramMiniBar({
  slug,
  onToggle,
  isChecked,
}: {
  slug: string;
  onToggle: (slug: string, dayIdx: number, taskId: string) => void;
  isChecked: (slug: string, dayIdx: number, taskId: string) => boolean;
}) {
  const program = getProgramBySlug(slug);

  if (!program) {
    return (
      <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line, rgba(0,0,0,.16))' }}>
        <div className="text-sm text-black/60">
          Programa no encontrado en datos: <b>{slug}</b>
        </div>
      </div>
    );
  }

  const canonSlug = program.slug; // ya normalizado
  const dayIdx = getDayIndexFor(canonSlug) ?? 0;
  const tasks: ProgramTask[] = program?.days?.[dayIdx]?.tasks || [];

  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--line, rgba(0,0,0,.16))' }}>
      <div className="text-sm font-medium mb-2 truncate">{program.title || canonSlug}</div>
      {tasks.length === 0 ? (
        <span className="text-xs text-black/50">Hoy no hay tareas.</span>
      ) : (
        <ul className="flex items-center gap-8">
          {tasks.map((t, i) => {
            const taskId = String(t.id ?? `${canonSlug}-d${dayIdx}-t${i}`);
            const checked = isChecked(canonSlug, dayIdx, taskId);
            return (
              <li key={taskId}>
                <button
                  onClick={() => onToggle(canonSlug, dayIdx, taskId)}
                  className="grid h-6 w-6 place-items-center rounded-full border"
                  title={checked ? 'Desmarcar' : 'Marcar'}
                  aria-label={checked ? `Desmarcar ${t.label}` : `Marcar ${t.label}`}
                  style={
                    checked
                      ? { background: '#22c55e', color: 'white', borderColor: '#16a34a' }
                      : { background: 'white' }
                  }
                >
                  {checked ? <Check size={14} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* Depuración: chips con slugs detectados */
function ActiveSlugsChips({ slugs }: { slugs: string[] }) {
  if (!slugs?.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {slugs.map((s) => (
        <span key={s} className="text-xs rounded-full border px-2 py-1 text-black/70">
          {s}
        </span>
      ))}
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
  const [checksVersion, setChecksVersion] = useState<number>(0); // para forzar re-render cuando cambian checks

  // Rellenar caché de PROGRAMS en cliente (window.__PROGRAMS o lazy import)
  useEffect(() => {
    (async () => {
      try {
        if (!__PROGRAMS_CACHE && typeof window !== 'undefined') {
          const runtime = (window as any).__PROGRAMS;
          if (runtime) {
            __PROGRAMS_CACHE = runtime;
            return;
          }
          // fallback: intenta lazy import del módulo de datos
          const mod = await import('@/data/programs');
          if ((mod as any)?.PROGRAMS) {
            __PROGRAMS_CACHE = (mod as any).PROGRAMS;
          }
        }
      } catch {
        // silencioso
      }
    })();
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
        setActivePrograms(getActiveSlugs());
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
  const firstName = (fullName.split(/\s+/).filter(Boolean)[0] || '');
  const greetingName = firstName || username || 'usuario/a';
  const avatar = (user?.foto as string | undefined) || undefined;

  // cargar estado inicial + sync de programas (reactivo)
  const uid = useAuthUserId();
  useEffect(() => {
    setMasters(loadMasterHabits());
    setDaily(loadDaily());

    // Normalizar checks a slugs canónicos
    const checks0 = loadProgramChecks();
    const checksNorm: ChecksMap = {};
    for (const [slug, byDay] of Object.entries(checks0 || {})) {
      const ns = String(slug).replace(/-30$/, '');
      if (!checksNorm[ns]) checksNorm[ns] = {};
      Object.assign(checksNorm[ns], byDay);
    }
    if (JSON.stringify(checks0) !== JSON.stringify(checksNorm)) saveProgramChecks(checksNorm);
    setChecks(checksNorm);

    // Init + primer refresco
    initProgramsLocal();
    const refreshActives = () => setActivePrograms(getActiveSlugs());
    refreshActives();

    // micro-poll tras montar
    const t0 = setTimeout(refreshActives, 250);
    const t1 = setTimeout(refreshActives, 750);
    const t2 = setTimeout(refreshActives, 1200);

    // Pull remoto → recarga
    (async () => {
      try { if (uid) await pullUserPrograms(); } catch {}
      initProgramsLocal();
      refreshActives();
    })();

    // listeners MISMA pestaña + cross-tab
    const onProgramsUpdated = () => refreshActives();
    const onVisibility = () => { if (!document.hidden) refreshActives(); };
    const onFocus = () => refreshActives();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_PROGRAMS_ACTIVE || e.key === LS_PROGRAMS_ACTIVE_LEGACY) refreshActives();
      if (e.key === LS_PROGRAM_CHECKS) setChecks(loadProgramChecks());
    };

    window.addEventListener('akira:programs-updated', onProgramsUpdated as EventListener);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimeout(t0); clearTimeout(t1); clearTimeout(t2);
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
      .filter((h) => isInRange(dKey, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => h.id);
  }
  function toggleDone(habitId: string, dKey?: string, evt?: React.MouseEvent) {
    const key = dKey ?? today;
    const bucket = daily[key] ?? {};
    const wasDone = !!bucket[habitId]?.done;
    let completedAllAfter = false;

    setDaily((prev) => {
      const map: DailyMap = { ...prev };
      const b: Record<string, DailyEntry> = { ...(map[key] ?? {}) };
      const current = b[habitId] ?? { done: false };
      const next: DailyEntry = current.done ? { done: false } : { done: true, doneAt: Date.now() };
      b[habitId] = next;
      map[key] = b;

      const ids = applicableMasterIds(key);
      completedAllAfter = ids.length > 0 && ids.every((id) => b[id]?.done === true);

      saveDaily(map);
      return map;
    });

    if (!wasDone) void confettiBurst(evt);
    if (!wasDone && completedAllAfter) void confettiBurst(undefined, true);
  }

  const todayHabits: HabitView[] = useMemo(() => {
    const d = parseKeyToDate(today);
    const bucket = daily[today] ?? {};
    return masters
      .filter((h) => isInRange(today, h.startDate, h.endDate))
      .filter((h) => !(h.weekend === false && isWeekendDay(d)))
      .map((h) => ({ ...h, done: !!bucket[h.id]?.done }));
  }, [masters, daily, today]);

  // checks de programas (local)
  const isTaskChecked = (slug: string, dayIdx: number, taskId: string) =>
    !!checks?.[slug]?.[dayIdx]?.[taskId];

  const toggleTaskChecked = (slug: string, dayIdx: number, taskId: string) => {
    setChecks((prev) => {
      const next: ChecksMap = { ...(prev || {}) };
      next[slug] = { ...(next[slug] || {}) };
      next[slug][dayIdx] = { ...(next[slug][dayIdx] || {}) };
      if (next[slug][dayIdx][taskId]) {
        delete next[slug][dayIdx][taskId];
      } else {
        next[slug][dayIdx][taskId] = true;
      }
      saveProgramChecks(next);
      return next;
    });
    setChecksVersion((v) => v + 1);
  };

  /* ===== RENDER ===== */
  return (
    <main className="mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8 py-6" style={{ background: 'white' }}>
      {/* Cabecera minimalista con avatar pequeño clicable */}
      <HeaderMinimal avatar={avatar} greetingName={greetingName} />

      {/* Menú superior */}
      <TopMenu />

      {/* RETOS PARA HOY */}
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
              const bg = checked ? (h.color ?? '#E8EAF6') : '#fff';
              const textColor = checked ? (h.textColor === 'white' ? '#fff' : '#111') : '#111';

              return (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-2xl border border-black/20 px-4 py-3 transition"
                  style={{ background: bg, color: textColor }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{h.icon ?? '🧩'}</span>
                    <span className="text-sm">{h.name}</span>
                  </div>

                  <button
                    onClick={(e) => toggleDone(h.id, undefined, e)}
                    className="grid h-6 w-6 place-items-center rounded-full border border-black/60 bg-white text-black"
                    title={checked ? 'Desmarcar' : 'Marcar como hecho'}
                    aria-label={checked ? `Desmarcar ${h.name}` : `Marcar ${h.name} como hecho`}
                    style={checked ? { background: '#22c55e', color: 'white', borderColor: '#16a34a' } : undefined}
                  >
                    {checked ? <Check size={14} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 2) Programas activos */}
      <section className="mb-6">
        <SubTitle>Programas activos</SubTitle>

        {/* chips de depuración: muestran los slugs activos detectados */}
        <ActiveSlugsChips slugs={activePrograms} />

        {activePrograms?.length ? (
          <div className="space-y-3" key={checksVersion /* fuerza refresco simple */}>
            {activePrograms.map((slug) => (
              <ProgramMiniBar
                key={slug}
                slug={slug}
                onToggle={toggleTaskChecked}
                isChecked={isTaskChecked}
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
