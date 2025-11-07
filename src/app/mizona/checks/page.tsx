// src/app/mizona/checks/page.tsx
'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import CreateHabitBar from '@/components/habits/CreateHabitBar';
import { useTodayActivity } from '@/lib/activity/useTodayActivity';
import {
  loadActive,
  saveActive,
  migrateCompat,
  type LocalStore,
  type LocalProgram,
} from '@/lib/programsLocal';
import { useAuthUserId } from '@/lib/user';
import { supabase } from '@/lib/supabaseClient';
import { pullUserPrograms } from '@/lib/programSync';

/* ===== Dynamic loaders como en ProgramDetail ===== */
type JsonTask = { id?: string; label: string; detail?: string };
type JsonDay = { day: number; tasks: JsonTask[] };
type ProgramJson = { slug: string; title: string; durationDays?: number; days: JsonDay[] };

const DATA_LOADERS: Record<string, () => Promise<ProgramJson>> = {
  'lectura-30': async () => (await import('@/data/programs/lectura-30.json')).default as any,
  'detox-tecnologico-30': async () => (await import('@/data/programs/detox-tecnologico-30.json')).default as any,
};

/* ===== Helpers fecha (idénticos a ProgramDetail) ===== */
function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function startOfDayMs(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d.getTime(); }
function daysBetweenFromMs(startMs: number, endISOyyyyMmDd: string) {
  const a = startOfDayMs(new Date(startMs));
  const b = startOfDayMs(new Date(`${endISOyyyyMmDd}T00:00:00`));
  return Math.floor((b - a) / 86_400_000);
}
function addDays(ms: number, days: number) { return startOfDayMs(new Date(ms + days * 86_400_000)); }
function weekdayLabel(dateMs: number) {
  const map = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
  return map[new Date(dateMs).getDay()];
}

/* === Modal ligero con soporte **negritas** === */
function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let i = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) parts.push(text.slice(i, m.index));
    parts.push(<strong key={m.index} className="font-semibold">{m[1]}</strong>);
    i = m.index + m[0].length;
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}
function InfoModal({ open, title, detail, onClose }:{
  open: boolean; title: string; detail?: string; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[2000] overflow-y-auto">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-[2001] min-h-full flex items-center justify-center p-4">
        <div className="w-full sm:max-w-md sm:rounded-2xl bg-white border border-neutral-200 shadow-xl" style={{ maxHeight: '85vh' }}>
          <div className="p-4 sm:p-5 overflow-y-auto">
            <div className="text-sm text-neutral-500 mb-1">Detalle</div>
            <div className="text-lg font-semibold mb-2">{title}</div>
            <div className="text-[15px] leading-relaxed text-neutral-800 whitespace-pre-wrap">
              {detail ? <InlineMarkdown text={detail} /> : 'Sin detalles.'}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Page ===== */
export default function MiActividadChecks() {
  const uid = useAuthUserId();

  // ======= Estado fuente ÚNICA de verdad (igual que ProgramDetail) =======
  const [activeMap, setActiveMap] = useState<LocalStore>({});
  const [jsonBySlug, setJsonBySlug] = useState<Record<string, ProgramJson>>({});
  const [loading, setLoading] = useState(true);

  // ======= Sugerencia del día (solo esta parte viene del hook) =======
  const {
    suggestionsToday,
    acceptSuggestion,
    dismissSuggestion,
    toggleSuggestionDone,
  } = useTodayActivity();

  // ======= Carga inicial + pull + migrate =======
  useEffect(() => {
    migrateCompat();
    setActiveMap(loadActive());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) { setLoading(false); return; }
      try {
        await pullUserPrograms(); // hidrata local desde Supabase
        if (!cancelled) setActiveMap(loadActive());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  // ======= Rehydrate en foco/online =======
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

  // ======= Realtime (sin filtrar por slug para cubrir todos los programas) =======
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const ch = supabase
      .channel(`rt-program-tasks-all-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_program_tasks', filter: `user_id=eq.${uid}` },
        async () => {
          try { await pullUserPrograms(); } finally { if (!cancelled) setActiveMap(loadActive()); }
        })
      .subscribe();

    return () => {
      cancelled = true;
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [uid]);

  // ======= Slugs activos (iniciados y NO completados) =======
  const activeSlugs = useMemo(() => {
    const out: string[] = [];
    for (const [slug, p] of Object.entries(activeMap)) {
      const lp = p as LocalProgram;
      if (!lp?.startedAt) continue;
      // ✅ excluir completados (sin depender del tipo)
      if ('completedAt' in (lp as any) && (lp as any).completedAt) continue;
      out.push(slug);
    }
    return out;
  }, [activeMap]);

  // ======= Cargar JSON solo de los slugs activos con loaders rápidos =======
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(activeSlugs.map(async (slug) => {
        const loader = DATA_LOADERS[slug];
        if (!loader) return null;
        try {
          const json = await loader();
          return [slug, json] as const;
        } catch {
          return null;
        }
      }));
      if (cancelled) return;
      const map: Record<string, ProgramJson> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setJsonBySlug(map);
    })();
    return () => { cancelled = true; };
  }, [activeSlugs.join('|')]);

  // ======= Construcción de “programsToday” desde la MISMA fuente =======
  const todayISO = todayKey();
  const visiblePrograms = useMemo(() => {
    const res: Array<{
      slug: string; title: string; day: number; color: string; tasks: { id: string; label: string; done: boolean; detail?: string }[];
    }> = [];

    for (const slug of activeSlugs) {
      const lp = activeMap[slug] as LocalProgram | undefined;
      if (!lp?.startedAt) continue;
      // ✅ defensa extra sin romper tipos
if (lp && 'completedAt' in (lp as any) && (lp as any).completedAt) continue;
      const json = jsonBySlug[slug];
      const totalDays = json?.days?.length ?? json?.durationDays ?? 0;
      if (!totalDays) continue;

      const currentDay = Math.min(totalDays, Math.max(1, daysBetweenFromMs(lp.startedAt, todayISO) + 1));
      if (currentDay > totalDays) continue;

      const dayDef = json?.days?.find((d) => d.day === currentDay) ?? json?.days?.[currentDay - 1];
      const plannedTasks = (dayDef?.tasks ?? []) as JsonTask[];
      if (!plannedTasks.length) continue;

      const mapForDay = (lp.progress?.[currentDay] as Record<string, boolean> | undefined) ?? {};
      const tasks = plannedTasks.map((t, i) => {
        const id = t.id ?? `task_${i}`;
        return { id, label: t.label, done: !!mapForDay[id], detail: t.detail };
      });

      // Si último día y TODO hecho, oculta (defensa adicional)
      const planned = tasks.length;
      const done = tasks.filter(x => x.done).length;
      const lastDayAndComplete = planned > 0 && done >= planned && currentDay >= totalDays;
      if (lastDayAndComplete) continue;

      res.push({
        slug,
        title: json?.title || slug,
        day: currentDay,
        color: colorFor(slug),
        tasks,
      });
    }

    return res;
  }, [activeMap, jsonBySlug, todayISO, activeSlugs]);

  const hasPrograms = visiblePrograms.length > 0;

  // ======= Modal detalles =======
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoDetail, setInfoDetail] = useState<string | undefined>(undefined);
  const openInfo = (title: string, detail?: string) => { setInfoTitle(title); setInfoDetail(detail); setInfoOpen(true); };
  const closeInfo = () => setInfoOpen(false);

  // ======= ensureDayRows (idéntico a ProgramDetail) =======
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

  // ======= Toggle (optimista + upsert + pull) =======
  const handleToggleProgramTask = useCallback(async (slug: string, day: number, taskId: string) => {
    // 1) Optimista en local
    const store = loadActive();
    const lp = store[slug] as LocalProgram | undefined;
    if (!lp) return;

    const progress = { ...(lp.progress ?? {}) };
    const mapForDay = { ...((progress[day] as any) || {}) };
    const next = !mapForDay[taskId];
    mapForDay[taskId] = next;
    progress[day] = mapForDay;

    const updated: LocalProgram = { ...(lp as LocalProgram), progress, updatedAt: Date.now() };
    const newStore: LocalStore = { ...store, [slug]: updated };
    saveActive(newStore);
    setActiveMap(newStore);

    try {
      if (!uid) return;

      // 2) Sembrar filas del día
      const json = jsonBySlug[slug];
      const taskIds = (json?.days.find(d => d.day === day)?.tasks ?? json?.days?.[day - 1]?.tasks ?? [])
        .map((t, i) => t.id ?? `task_${i}`);
      await ensureDayRows(uid, slug, day, taskIds);

      // 3) Upsert del toggle real
      await supabase
        .from('user_program_tasks')
        .upsert(
          {
            user_id: uid,
            program_slug: slug,
            day,
            task_id: taskId,
            completed: next,
            completed_at: next ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,program_slug,day,task_id' as any }
        );

      // 4) Pull para dejar persistido y coherente (y para otros dispositivos)
      await pullUserPrograms();
      setActiveMap(loadActive());
    } catch (e) {
      console.error('[checks/toggle] error:', e);
    } finally {
      // 5) Eventos globales
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('akira:points:refresh', { detail: { source: 'checks' } }));
        window.dispatchEvent(new CustomEvent('akira:activity:changed', { detail: { source: 'checks' } }));
      }
    }
  }, [uid, jsonBySlug]);

  const hasChallenges = false; // (sección placeholder)
  const hasHabits = false; // (sección placeholder)
  const s = suggestionsToday;
  const nothingAtAll = !hasPrograms && !hasChallenges && !hasHabits && !s;

  // ===== Render =====
  return (
    <div className="py-6 space-y-6">
      {loading && (
        <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600 bg-white">
          Cargando…
        </div>
      )}

      {!loading && nothingAtAll && (
        <div className="rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600 bg-white">
          Todavía no hay nada creado
        </div>
      )}

      {/* ===== Reto sugerido de hoy ===== */}
      {!loading && s && s.status !== 'dismissed' && (
        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Reto sugerido de hoy</h3>
              <p className="text-sm text-neutral-600">{s.description ?? 'Pequeño empujón para hoy.'}</p>
            </div>
            {s.status === 'proposed' && (
              <div className="flex gap-2">
                <button onClick={acceptSuggestion} className="px-3 py-1.5 rounded-full bg-black text-white text-sm font-semibold active:scale-95">
                  Aceptar
                </button>
                <button onClick={dismissSuggestion} className="px-3 py-1.5 rounded-full border text-sm font-semibold active:scale-95">
                  Descartar
                </button>
              </div>
            )}
          </div>

          {(s.status === 'accepted' || s.status === 'done') && (
            <div className="mt-1">
              <CreateHabitBar
                variant="task"
                label={s.title}
                checked={s.status === 'done'}
                color="#111"
                onToggle={toggleSuggestionDone}
                showInfoButton={false}
              />
              <p className="mt-2 text-xs text-neutral-500">
                * Este reto no suma puntos al ranking global; es un extra opcional.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ===== Programas activos (misma fuente que ProgramDetail) ===== */}
      {!loading && (
        <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <h3 className="text-lg font-semibold">Programas activos</h3>
          {!hasPrograms && <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>}

          {hasPrograms && visiblePrograms.map((prog) => (
            <div key={prog.slug} className="space-y-2">
              <div className="text-sm font-medium">{prog.title}</div>
              {prog.tasks.map((t) => {
                const hasDetail = Boolean(t.detail);
                return (
                  <CreateHabitBar
                    key={t.id}
                    variant="task"
                    label={t.label}
                    checked={t.done}
                    color={prog.color}
                    onToggle={() => handleToggleProgramTask(prog.slug, prog.day, t.id)}
                    onInfo={hasDetail ? (() => openInfo(`${prog.title} · ${t.label}`, t.detail)) : undefined}
                    showInfoButton={hasDetail}
                  />
                );
              })}
            </div>
          ))}
        </section>
      )}

      {/* Retos con amigos (placeholder simple) */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Retos con amigos</h3>
        <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>
      </section>

      {/* Hábitos personalizados (placeholder simple) */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Hábitos personalizados</h3>
        <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>
      </section>

      {/* Modal de detalles */}
      <InfoModal open={infoOpen} title={infoTitle} detail={infoDetail} onClose={closeInfo} />
    </div>
  );
}

/* ===== Colores por slug (igual criterio que en tu app) ===== */
function colorFor(slug: string) {
  if (slug.includes('detox')) return '#0a7cff';
  if (slug.includes('lectura')) return '#f59e0b';
  return '#111';
}
