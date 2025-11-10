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

/* ===== NUEVO: resolver colores desde ProgramDefs ===== */
import { resolveProgramDef } from '@/data/programs';

/* ===== NUEVO: sync de hábitos personalizados ===== */
import {
  useHabitsSupabaseSync,
  flushHabitsNow,
  queueTickUpsert,
  type HabitMaster as HabitMasterSync,
} from '@/lib/useHabitsSupabaseSync';

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

/* ===== Helpers fecha ===== */
function startOfDayMs(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d.getTime(); }
function daysBetweenFromMs(startMs: number, endISOyyyyMmDd: string) {
  const a = startOfDayMs(new Date(startMs));
  const b = startOfDayMs(new Date(`${endISOyyyyMmDd}T00:00:00`));
  return Math.floor((b - a) / 86_400_000);
}
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

/* === Fecha/TZ Europe/Madrid para hábitos personalizados === */
function dateKeyTZ(d = new Date(), tz = 'Europe/Madrid') {
  const parts = new Intl.DateTimeFormat('es-ES', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const g = (t:string) => parts.find(p=>p.type===t)?.value!;
  return `${g('year')}-${g('month')}-${g('day')}`;
}
function weekdayKeyTZ(d = new Date(), tz = 'Europe/Madrid'):
  'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday' {
  const keys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;
  const zoned = new Date(d.toLocaleString('en-US', { timeZone: tz }));
  return keys[zoned.getDay()];
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

/* ===== Limpieza mínima de markdown inline para labels de barra ===== */
function mdInlineToPlain(s: string) {
  return s?.replace(/\*\*(.+?)\*\*/g, '$1') ?? s;
}

/* ===== LocalStorage helpers de hábitos personalizados (misma clave que el sync) ===== */
const LS_HABITS_MASTER = 'akira_habits_master_v1';
const LS_HABITS_DAILY  = 'akira_habits_daily_v1';

type HabitMaster = HabitMasterSync & {
  perDay?: Record<string, { items: { id: string; name?: string; description?: string }[] }>;
};
type DailyEntry = { done: boolean; doneAt?: number; updated_at?: string };
type DailyMap = Record<string, Record<string, DailyEntry>>;

function loadMasters(): HabitMaster[] {
  try { return JSON.parse(localStorage.getItem(LS_HABITS_MASTER) || '[]') as HabitMaster[]; } catch { return []; }
}
function loadDaily(): DailyMap {
  try { return JSON.parse(localStorage.getItem(LS_HABITS_DAILY) || '{}') as DailyMap; } catch { return {}; }
}
function saveDaily(map: DailyMap) {
  localStorage.setItem(LS_HABITS_DAILY, JSON.stringify(map));
}

/* ===== Page ===== */
export default function MiActividadChecks() {
  const uid = useAuthUserId();

  // 🔌 Mantén sincronía con Supabase para hábitos personalizados
  useHabitsSupabaseSync(uid || undefined);

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
        await pullUserPrograms(); // hidrata local desde Supabase (programas)
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
  const todayISO = dateKeyTZ(new Date());
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
        return { id, label: mdInlineToPlain(t.label), done: !!mapForDay[id], detail: t.detail };
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
      const json = jsonBySlug[slug] || tryGetProgramJson(slug);
      const taskIds = (json?.days.find((d: any) => d.day === day)?.tasks ?? json?.days?.[day - 1]?.tasks ?? [])
        .map((t: any, i: number) => t.id ?? `task_${i}`);
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

  /* =========================
   *  Retos con amigos (inline)
   * ========================= */
  type ChallengeMini = { id: string; title: string; start: string; end: string; todayIdx: number; totalDays: number };
  type CheckStatus = null | 'pending' | 'valid' | 'invalid' | 'auto_valid';
  const PHOTOS_BUCKET = 'challenge-photos';

  const [friendChallenges, setFriendChallenges] = useState<ChallengeMini[]>([]);
  const [friendChecks, setFriendChecks] = useState<Record<string, CheckStatus>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Cargar retos activos del usuario
  useEffect(() => {
    (async () => {
      if (!uid) { setFriendChallenges([]); return; }
      // 1) membership
      const { data: mems, error: eM } = await supabase
        .from('challenge_members')
        .select('challenge_id')
        .eq('user_id', uid);
      if (eM) { console.warn(eM); setFriendChallenges([]); return; }
      const ids = (mems ?? []).map(m => m.challenge_id);
      if (!ids.length) { setFriendChallenges([]); return; }

      // 2) retos
      const { data: chs, error: eC } = await supabase
        .from('challenges')
        .select('id, title, start, end')
        .in('id', ids);
      if (eC) { console.warn(eC); setFriendChallenges([]); return; }

      const today = dateKeyTZ(new Date());
      const list: ChallengeMini[] = (chs ?? []).map((c: any) => {
        const totalDays = Math.max(1, Math.round((new Date(c.end+'T00:00:00').getTime() - new Date(c.start+'T00:00:00').getTime())/86400000) + 1);
        const idxRaw = Math.round((new Date(today+'T00:00:00').getTime() - new Date(c.start+'T00:00:00').getTime())/86400000) + 1;
        const todayIdx = clamp(idxRaw, 1, totalDays);
        return { id: c.id, title: c.title, start: c.start, end: c.end, todayIdx, totalDays };
      })
      // activos hoy
      .filter(c => today >= c.start && today <= c.end);

      setFriendChallenges(list);
    })();
  }, [uid]);

  // Cargar mi check de HOY por reto activo
  useEffect(() => {
    if (!uid || !friendChallenges.length) { setFriendChecks({}); return; }
    (async () => {
      const next: Record<string, CheckStatus> = {};
      for (const c of friendChallenges) {
        const { data, error } = await supabase
          .from('challenge_checks')
          .select('status')
          .eq('challenge_id', c.id)
          .eq('user_id', uid)
          .eq('day_index', c.todayIdx)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') console.warn(error);
        next[c.id] = (data?.status as CheckStatus) ?? null;
      }
      setFriendChecks(next);
    })();
  }, [uid, friendChallenges]);

  async function onUploadChallengePhoto(chId: string) {
    const input = document.getElementById(`challenge-file-${chId}`) as HTMLInputElement | null;
    input?.click();
  }
  async function onPickChallengeFile(ch: ChallengeMini, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setUploading((s) => ({ ...s, [ch.id]: true }));
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${ch.id}/${ch.todayIdx}/${uid}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(PHOTOS_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });
      if (up.error) throw up.error;

      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const ins = await supabase.from('challenge_checks').insert([{
        challenge_id: ch.id,
        user_id: uid,
        day_index: ch.todayIdx,
        photo_path: path,
        photo_expires_at: expiresAt,
        status: 'pending',
      }]);
      if (ins.error) throw ins.error;

      setFriendChecks((s) => ({ ...s, [ch.id]: 'pending' }));
      // eventos globales
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('akira:activity:changed', { detail: { source: 'challenge' } }));
        window.dispatchEvent(new CustomEvent('akira:points:refresh',   { detail: { source: 'challenge' } }));
      }
    } catch (err:any) {
      console.error(err);
      alert('No se pudo subir la foto del reto. Inténtalo de nuevo.');
    } finally {
      setUploading((s) => ({ ...s, [ch.id]: false }));
      e.target.value = '';
    }
  }

  const hasFriendChallenges = friendChallenges.length > 0;

  /* =========================
   *  HÁBITOS PERSONALIZADOS
   * ========================= */
  const [masters, setMasters] = useState<HabitMaster[]>([]);
  const [daily, setDaily] = useState<DailyMap>({});

  // Rehidratar masters + daily al entrar/visibilidad
  useEffect(() => {
    const read = () => {
      try { setMasters(loadMasters().filter(h => !h.deleted_at)); } catch { setMasters([]); }
      try { setDaily(loadDaily()); } catch { setDaily({}); }
    };
    read();
    const onVis = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const tzToday = new Date();
  const dayKey = dateKeyTZ(tzToday);
  const weekKey = weekdayKeyTZ(tzToday);

  const visibleHabits = useMemo(() => {
    const today = dayKey;
    const dow = weekKey;
    const dowIdx = new Date(tzToday.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).getDay(); // 0 dom, 6 sáb
    return masters
      .filter(h => {
        // rango de fechas
        if (h.startDate && today < h.startDate) return false;
        if (h.endDate && today > h.endDate) return false;
        // fines de semana
        if (h.weekend === false && (dowIdx === 0 || dowIdx === 6)) return false;
        return true;
      })
      .map(h => {
        // items significativos del día (al menos name o description no vacíos)
        const rawItems = h.perDay?.[dow]?.items ?? [];
        const meaningful = rawItems.filter(it => (it.name?.trim() || it.description?.trim()));
        const hasDetail = meaningful.length > 0;

        // construir detalle legible (se muestra con InlineMarkdown ⇒ puede tener **negrita**)
        const detail = hasDetail
          ? meaningful.map(it => {
              const t = (it.name?.trim() || 'Hábito');
              const d = it.description?.trim();
              return d ? `• ${t} — ${d}` : `• ${t}`;
            }).join('\n')
          : undefined;

        const checked = !!(daily?.[today]?.[h.id]?.done);
        const label = mdInlineToPlain(`${h.icon ?? ''} ${h.name}`.trim());
        return {
          id: h.id,
          label,
          color: h.color ?? '#F0F0F0',
          checked,
          detail,
          hasDetail,
        };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masters, dayKey, weekKey, daily]);

  const hasHabits = visibleHabits.length > 0;

  // Toggle de hábito personalizado (un único check por hábito/día)
  const toggleCustomHabit = useCallback(async (hid: string) => {
    const today = dayKey;
    // optimista en local
    const map = { ...(daily || {}) };
    const bucket = { ...(map[today] || {}) };
    const cur = bucket[hid]?.done ?? false;
    const next = !cur;
    bucket[hid] = { done: next, doneAt: next ? Date.now() : undefined, updated_at: new Date().toISOString() };
    map[today] = bucket;
    setDaily(map);
    saveDaily(map);

    try {
      if (!uid) return;
      queueTickUpsert({
        habit_id: hid,
        date_key: today,
        done: next,
        done_at: next ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      await flushHabitsNow(uid);
    } catch (e) {
      console.warn('[customHabit/toggle] flush error', e);
    } finally {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('akira:activity:changed', { detail: { source: 'custom-habits' } }));
      }
    }
  }, [dayKey, daily, uid]);

  const s = suggestionsToday;
  const nothingAtAll = !hasPrograms && !hasFriendChallenges && !hasHabits && !s;

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
                label={mdInlineToPlain(s.title)}
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

      {/* ===== Programas activos ===== */}
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
                    label={mdInlineToPlain(t.label)}
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

      {/* ===== Retos con amigos ===== */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Retos con amigos</h3>
        {!hasFriendChallenges && <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>}

        {hasFriendChallenges && friendChallenges.map((ch) => {
          const status = friendChecks[ch.id];
          const checked = status === 'valid' || status === 'auto_valid';
          const busy = !!uploading[ch.id];
          const label = `Día ${ch.todayIdx}/${ch.totalDays} – ${mdInlineToPlain(ch.title)}`;
          return (
            <div key={ch.id} className="space-y-2">
              <CreateHabitBar
                variant="task"
                label={label}
                checked={checked}
                color="#F8E68A"
                onToggle={() => {}}
                showInfoButton={false}
                rightSlot={
                  <>
                    <input
                      id={`challenge-file-${ch.id}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => onPickChallengeFile(ch, e)}
                    />
                    <button
                      onClick={() => onUploadChallengePhoto(ch.id)}
                      disabled={busy || checked}
                      className="btn-pill-black px-4 py-2 text-xs font-semibold inline-flex items-center gap-2 active:scale-95 disabled:opacity-60"
                    >
                      {busy ? 'Subiendo…' : (status ? 'Actualizado' : 'Subir foto')}
                    </button>
                  </>
                }
              />
              {status && (
                <p className="text-xs text-neutral-500">
                  Estado: {status === 'pending' ? 'Pendiente de validación' :
                           status === 'valid' ? 'Validado' :
                           status === 'auto_valid' ? 'Validado (auto)' : 'No válido'}
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* ===== Hábitos personalizados ===== */}
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Hábitos personalizados</h3>
          <Link href="/mizona/crear-habitos" className="text-sm underline">Crear hábito</Link>
        </div>

        {!hasHabits && <p className="text-sm text-neutral-500">Todavía no hay nada creado</p>}

        {hasHabits && visibleHabits.map(h => {
          return (
            <CreateHabitBar
              key={h.id}
              variant="task"
              label={mdInlineToPlain(h.label)}
              checked={h.checked}
              color={h.color}
              onToggle={() => toggleCustomHabit(h.id)}
              onInfo={h.hasDetail ? (() => openInfo(h.label, h.detail)) : undefined}
              showInfoButton={h.hasDetail}
            />
          );
        })}
      </section>

      {/* Modal de detalles */}
      <InfoModal open={infoOpen} title={infoTitle} detail={infoDetail} onClose={closeInfo} />
    </div>
  );
}

/* ===== Colores por slug (usa ProgramDefs y fallbacks) ===== */
function colorFor(slug: string) {
  const def = resolveProgramDef(slug);
  if (def?.themeColor) return def.themeColor;

  // Fall-backs por si llega un slug legacy o un comunitario sin color definido
  const FALLBACK: Record<string, string> = {
    'lectura': '#E0E7FF',
    'lectura-30': '#E0E7FF',
    'detox-tecnologico': '#FCD34D',
    'detox-tecnologico-30': '#FCD34D',
    'san-silvestre-60': '#FCA5A5',
  };
  for (const key in FALLBACK) {
    if (slug.includes(key)) return FALLBACK[key];
  }
  return '#F8E68A';
}
