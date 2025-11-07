// src/app/mizona/checks/page.tsx
'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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

/* ===== Helpers JSON (fallback síncrono) ===== */
function tryGetProgramJson(slug: string): any | null {
  try {
    // @ts-ignore
    const m = require(`@/data/programs/${slug}.json`);
    return m?.default ?? m ?? null;
  } catch {
    return null;
  }
}

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
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

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

  // ======= Realtime (todos los programas del usuario) =======
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

  // ======= Slugs activos (iniciados y no completados) =======
  const todayISO = todayKey();
  const activeSlugs = useMemo(() => {
    const out: string[] = [];
    for (const [slug, p] of Object.entries(activeMap)) {
      const lp = p as LocalProgram;
      if (!lp?.startedAt) continue;

      const json = jsonBySlug[slug] || tryGetProgramJson(slug);
      const totalDays: number = json?.days?.length ?? json?.durationDays ?? 0;
      if (!totalDays) continue;

      const rawIdx = daysBetweenFromMs(lp.startedAt, todayISO) + 1;
      if (rawIdx > totalDays) continue; // completado → fuera

      out.push(slug);
    }
    return out;
  }, [activeMap, jsonBySlug, todayISO]);

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
      const map: Record<string, ProgramJson> = { ...jsonBySlug };
      for (const e of entries) if (e) map[e[0]] = e[1];
      setJsonBySlug(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlugs.join('|')]);

  // ======= Construcción de “programsToday” desde la MISMA fuente =======
  const visiblePrograms = useMemo(() => {
    const res: Array<{
      slug: string; title: string; day: number; color: string; tasks: { id: string; label: string; done: boolean; detail?: string }[];
    }> = [];

    for (const slug of activeSlugs) {
      const lp = activeMap[slug] as LocalProgram | undefined;
      if (!lp?.startedAt) continue;

      const json = jsonBySlug[slug] || tryGetProgramJson(slug);
      const totalDays = json?.days?.length ?? json?.durationDays ?? 0;
      if (!totalDays) continue;

      const rawIdx = daysBetweenFromMs(lp.startedAt, todayISO) + 1;
      if (rawIdx > totalDays) continue;
      const currentDay = Math.min(totalDays, Math.max(1, rawIdx));

      const dayDef = json?.days?.find((d: any) => d.day === currentDay) ?? json?.days?.[currentDay - 1];
      const plannedTasks = (dayDef?.tasks ?? []) as JsonTask[];
      if (!plannedTasks.length) continue;

      const mapForDay = (lp.progress?.[currentDay] as Record<string, boolean> | undefined) ?? {};
      const tasks = plannedTasks.map((t, i) => {
        const id = t.id ?? `task_${i}`;
        return { id, label: t.label, done: !!mapForDay[id], detail: t.detail };
      });

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
