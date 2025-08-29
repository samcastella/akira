// src/app/habitos/[slug]/page.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';

/* Catálogo (metadatos) */
import { getProgram as getMeta, type ProgramMeta } from '@/lib/programs_catalog';

/* Motor legacy (persistencia y progreso por tareas) */
import {
  PROGRAMS,                     // { [legacyKey]: ProgramDef }
  startProgram as legacyStart,  // (legacyKey: string) => void
  loadStore, saveStore,         // estado LS + persistencia
  getRelativeDayIndexForDate,   // (legacyKey, dateStr) => number (1..n)
  getProgressPercent,           // (legacyKey) => number %
} from '@/lib/programs';
import { addDays, dateKey, todayKey } from '@/lib/date';

/* Mapeo slug <-> legacy */
import { SLUG_TO_LEGACY } from '@/lib/programs_map';

/* Helpers internos: marcar/desmarcar todas las tareas de un día en legacy */
function markLegacyDayDone(legacyKey: string, dateStr: string) {
  const store = loadStore();
  const prog = PROGRAMS[legacyKey];
  if (!store[legacyKey] || !prog) return;

  const dayIdx = getRelativeDayIndexForDate(legacyKey, dateStr);
  if (dayIdx < 1) return;

  const tasksCount = prog.days[dayIdx - 1]?.tasks.length ?? 0;
  if (!store[legacyKey].completedByDate) store[legacyKey].completedByDate = {};
  const already = new Set(store[legacyKey].completedByDate[dateStr] ?? []);
  for (let i = 0; i < tasksCount; i++) already.add(i);
  store[legacyKey].completedByDate[dateStr] = Array.from(already).sort((a, b) => a - b);
  saveStore(store);
}

function unmarkLegacyDay(legacyKey: string, dateStr: string) {
  const store = loadStore();
  if (!store[legacyKey]) return;
  if (store[legacyKey].completedByDate) {
    store[legacyKey].completedByDate[dateStr] = [];
    saveStore(store);
  }
}

/* Racha: días consecutivos completos hasta hoy (o hasta el último día completo) */
function computeStreak(legacyKey: string): number {
  const store = loadStore();
  const prog = PROGRAMS[legacyKey];
  const st = store[legacyKey];
  if (!st || !prog) return 0;

  let streak = 0;
  // contamos hacia atrás desde hoy mientras el día relativo exista y esté completo
  for (let i = 0; i < prog.days.length; i++) {
    const d = addDays(new Date(), -i);
    const dk = dateKey(d);
    const rel = getRelativeDayIndexForDate(legacyKey, dk);
    if (rel < 1) break; // antes de empezar o fuera de rango
    const tasks = prog.days[rel - 1]?.tasks.length ?? 0;
    const done = st.completedByDate?.[dk]?.length ?? 0;
    if (tasks > 0 && done >= tasks) {
      streak++;
      continue;
    }
    break;
  }
  return streak;
}

export default function ProgramPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta: ProgramMeta | undefined = useMemo(() => {
    try { return getMeta(slug as any); } catch { return undefined; }
  }, [slug]);

  if (!meta) return notFound();

  const legacyKey = SLUG_TO_LEGACY[slug];
  const legacyProg = legacyKey ? PROGRAMS[legacyKey] : undefined;
  const unsupported = !legacyKey || !legacyProg;

  // “versión” simple para forzar re-render tras mutaciones en LS
  const [v, setV] = useState(0);
  const bump = () => setV((x) => x + 1);

  const today = todayKey();

  const started = useMemo(() => {
    if (unsupported) return false;
    const store = loadStore();
    return !!store[legacyKey];
  }, [legacyKey, unsupported, v]);

  const dayIdx = useMemo(() => {
    if (unsupported) return 0;
    return started ? getRelativeDayIndexForDate(legacyKey, today) || 1 : 0;
  }, [legacyKey, started, today, unsupported, v]);

  const tasksToday = useMemo(() => {
    if (unsupported || !legacyProg) return [];
    const idx = Math.max(1, dayIdx);
    return legacyProg.days[idx - 1]?.tasks ?? [];
  }, [legacyProg, dayIdx, unsupported]);

  const progress = useMemo(() => {
    if (unsupported) return 0;
    return getProgressPercent(legacyKey);
  }, [legacyKey, unsupported, v]);

  const streak = useMemo(() => {
    if (unsupported) return 0;
    return computeStreak(legacyKey);
  }, [legacyKey, unsupported, v]);

  const todayTarget = useMemo(() => {
    const idx = Math.max(0, Math.min(meta.durationDays - 1, Math.max(1, dayIdx) - 1));
    return { value: meta.plan[idx], unit: meta.unit }; // minutos o páginas
  }, [meta, dayIdx]);

  const nextTarget = useMemo(() => {
    if (dayIdx >= meta.durationDays) return null;
    const idx = Math.max(0, Math.min(meta.durationDays - 1, Math.max(1, dayIdx + 1) - 1));
    return { day: Math.max(1, dayIdx + 1), value: meta.plan[idx], unit: meta.unit };
  }, [meta, dayIdx]);

  const onStart = useCallback(() => {
    if (unsupported) return;
    legacyStart(legacyKey);
    bump();
  }, [legacyKey, unsupported]);

  const onCompleteToday = useCallback(() => {
    if (unsupported) return;
    markLegacyDayDone(legacyKey, today);
    bump();
  }, [legacyKey, unsupported, today]);

  const onUncompleteToday = useCallback(() => {
    if (unsupported) return;
    unmarkLegacyDay(legacyKey, today);
    bump();
  }, [legacyKey, unsupported, today]);

  /* UI */
  return (
    <main className="container">
      {/* Portada */}
      <div style={{ margin: '8px 0 12px' }}>
        <h1 style={{ margin: 0 }}>{meta.title}</h1>
        {meta.subtitle && <p style={{ margin: '6px 0 0', color: '#666' }}>{meta.subtitle}</p>}
      </div>

      {meta.cover && (
        <img
          src={meta.cover}
          alt={meta.title}
          style={{
            width: '100%',
            height: 200,
            objectFit: 'cover',
            borderRadius: 12,
            border: '1px solid #eee',
            marginBottom: 12,
          }}
        />
      )}

      {/* Estado / Progreso */}
      {!unsupported && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <strong>Progreso</strong>
            <span style={{ fontSize: 12, color: '#666' }}>
              Racha: {streak} día{streak === 1 ? '' : 's'} · {progress}%
            </span>
          </div>
          <div style={{ height: 8, background: '#eee', borderRadius: 999, marginTop: 8 }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 999,
                background: '#111',
                transition: 'width 160ms ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Contenido principal */}
      {unsupported ? (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ margin: 0 }}>Este programa estará disponible muy pronto.</p>
          <Link href="/habitos" style={{ display: 'inline-block', marginTop: 8, fontSize: 14 }}>
            ← Volver a Programas
          </Link>
        </div>
      ) : !started ? (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ margin: 0, color: '#333' }}>Este plan dura {meta.durationDays} días.</p>
          <small className="muted">
            Objetivo del Día 1: {meta.plan[0]} {meta.unit === 'minutes' ? 'min' : meta.unit}
          </small>
          <button onClick={onStart} className="btn btn-primary" style={{ marginTop: 10 }}>
            {meta.cta ?? 'Empieza ahora'}
          </button>
        </div>
      ) : (
        <>
          {/* Día actual */}
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong>Día {Math.max(1, dayIdx)} / {meta.durationDays}</strong>
              <small style={{ color: '#666' }}>
                Objetivo hoy: {todayTarget.value} {meta.unit === 'minutes' ? 'min' : meta.unit}
              </small>
            </div>

            {/* Micro-retos del día (legacy) */}
            {tasksToday.length > 0 && (
              <ul style={{ margin: '10px 0 0 18px' }}>
                {tasksToday.map((t, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{t}</li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={onCompleteToday} className="btn btn-primary">
                Marcar día como hecho
              </button>
              <button onClick={onUncompleteToday} className="btn secondary">
                Deshacer día
              </button>
              <Link href="/mizona" className="btn" style={{ border: '1px solid #ddd' }}>
                Ver en Mi zona
              </Link>
            </div>
          </div>

          {/* Próximo día (preview) */}
          {nextTarget && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <strong>Próximo día</strong>
                <small className="muted">Día {nextTarget.day} · objetivo: {nextTarget.value} {meta.unit === 'minutes' ? 'min' : meta.unit}</small>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                Mantén el ritmo: marca hoy como hecho para desbloquear el siguiente día.
              </p>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Link href="/habitos" style={{ fontSize: 14 }}>← Volver a Programas</Link>
          </div>
        </>
      )}
    </main>
  );
}
