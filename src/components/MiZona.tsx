'use client';

import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '@/lib/constants';
import {
  PROGRAMS,
  isTaskTodayCompleted,
  toggleTaskToday,
  getRelativeDayIndexForDate,
  loadStore,
} from '@/lib/programs';
import { todayKey, daysInMonth } from '@/lib/date';

/* =========
   Retos desde Herramientas (Mi zona)
   ========= */
type Reto = {
  id: string;
  text: string;
  createdAt: number;
  due: string;           // YYYY-MM-DD
  done: boolean;
  permanent?: boolean;   // si es permanente, al completar se recrea para mañana
};

const LS_RETOS = 'akira_mizona_retos_v1';
function loadLS<T>(k: string, fb: T): T {
  if (typeof window === 'undefined') return fb;
  try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; }
}
function saveLS<T>(k: string, v: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(k, JSON.stringify(v));
}

/* =========
   Lógica existente (programas)
   ========= */
type DayColor = 'empty' | 'none' | 'some' | 'all';

function totalsForDate(dateStr: string) {
  const store = loadStore();
  let total = 0; let done = 0;
  for (const k of Object.keys(store)) {
    const prog = PROGRAMS[k]; if (!prog) continue;
    const idx = getRelativeDayIndexForDate(k, dateStr);
    if (idx < 1) continue;
    const n = prog.days[idx - 1]?.tasks.length ?? 0;
    total += n;
    const arr = store[k].completedByDate?.[dateStr] ?? [];
    done += Math.min(arr.length, n);
  }
  return { total, done };
}
function dayColorStatus(dateStr: string): DayColor {
  const { total, done } = totalsForDate(dateStr);
  if (total === 0) return 'empty';
  if (done === 0) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayKey() + 'T00:00:00');
    return d < today ? 'none' : 'empty';
  }
  if (done < total) return 'some';
  return 'all';
}

/* =========
   Componente
   ========= */
export default function MiZona() {
  const [name, setName] = useState<string>('Amigo/a');
  const [, setTick] = useState(0);
  const bump = () => setTick(v => v + 1);

  useEffect(() => { setName(localStorage.getItem('akira_name') || 'Amigo/a'); }, []);

  /* ---- Programas (tal cual tenías) ---- */
  const store = loadStore();
  const active = Object.keys(store).filter(k => PROGRAMS[k]);

  const allDatesWithAny = new Set<string>();
  let totalChecks = 0;
  Object.keys(store).forEach(k => {
    const map = store[k].completedByDate || {};
    Object.entries(map).forEach(([d, arr]) => {
      if ((arr?.length ?? 0) > 0) allDatesWithAny.add(d);
      totalChecks += arr.length;
    });
  });
  const daysWithAny = allDatesWithAny.size;

  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth();
  const nDays = daysInMonth(y, m);
  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}-`;

  /* ---- Retos enviados desde Herramientas ---- */
  const [retos, setRetos] = useState<Reto[]>(() => loadLS<Reto[]>(LS_RETOS, []));
  useEffect(() => { saveLS(LS_RETOS, retos); }, [retos]);

  const hoy = todayKey();
  const retosHoy = useMemo(() => retos.filter(r => r.due === hoy && !r.done), [retos, hoy]);

  const completarReto = (id: string) => {
    const r = retos.find(x => x.id === id); if (!r) return;
    const upd = retos.map(x => x.id === id ? { ...x, done: true } : x);

    // Si era permanente, crea uno nuevo para mañana
    if (r.permanent) {
      const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
      upd.unshift({
        id: crypto.randomUUID(),
        text: r.text,
        createdAt: Date.now(),
        due: tmr.toISOString().slice(0, 10),
        done: false,
        permanent: true,
      });
    }
    setRetos(upd);
  };

  const borrarReto = (id: string) => setRetos(retos.filter(r => r.id !== id));
  const editarReto = (id: string) => {
    const r = retos.find(x => x.id === id); if (!r) return;
    const nuevo = prompt('Editar reto:', r.text);
    if (nuevo == null) return;
    setRetos(retos.map(x => x.id === id ? { ...x, text: nuevo } : x));
  };

  return (
    <div className="py-6">
      {/* Saludo y métricas */}
      <div className="mb-4">
        <h2 className="text-3xl font-black leading-tight">Hola {name}</h2>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
          <div className="text-4xl font-black">{totalChecks}</div>
          <div className="text-sm text-black/60">retos completados</div>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
          <div className="text-4xl font-black">{daysWithAny}</div>
          <div className="text-sm text-black/60">días cumpliendo retos</div>
        </div>
      </div>

      {/* Calendario mensual */}
      <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.line }}>
        <div className="mb-2 text-sm font-medium">Este mes</div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: nDays }, (_, i) => {
            const day = i + 1;
            const dKey = `${monthPrefix}${String(day).padStart(2, '0')}`;
            const status = dayColorStatus(dKey);
            let bg = 'transparent', br = COLORS.gray;
            if (status === 'none') { bg = COLORS.red; br = COLORS.red; }
            if (status === 'some') { bg = COLORS.orange; br = COLORS.orange; }
            if (status === 'all')  { bg = COLORS.green; br = COLORS.green; }
            return (
              <div
                key={dKey}
                className="flex items-center justify-center rounded-full text-xs"
                style={{
                  width: 28, height: 28,
                  background: bg,
                  border: `1px solid ${br}`,
                  color: bg === 'transparent' ? '#111' : '#fff',
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-black/60">
          <span className="inline-flex h-3 w-3 rounded-full" style={{ background: COLORS.red }} /> Sin marcar
          <span className="inline-flex h-3 w-3 rounded-full" style={{ background: COLORS.orange }} /> Parcial
          <span className="inline-flex h-3 w-3 rounded-full" style={{ background: COLORS.green }} /> Completado
        </div>
      </div>

      {/* === NUEVO: Retos añadidos desde Herramientas (para hoy) === */}
      <section className="mt-5">
        <div className="mb-2 text-sm text-black/60">Retos de hoy</div>
        <ul className="list">
          {retosHoy.length === 0 && (
            <li className="muted" style={{ padding: '10px 0' }}>
              No tienes retos añadidos desde Herramientas para hoy.
            </li>
          )}
          {retosHoy.map(r => (
            <li
              key={r.id}
              style={{ padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" onChange={() => completarReto(r.id)} />
                <span>{r.text}{r.permanent ? ' · (permanente)' : ''}</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn secondary" onClick={() => editarReto(r.id)}>Editar</button>
                <button className="btn red" onClick={() => borrarReto(r.id)}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Programas activos (como lo tenías) */}
      <div className="mt-5 space-y-3">
        {active.length === 0 && (
          <div className="rounded-2xl border p-4 text-sm text-black/70" style={{ borderColor: COLORS.line }}>
            Aún no has empezado ningún programa. Ve a “Hábitos” o “Inicio” para comenzar uno.
          </div>
        )}

        {active.map((key) => {
          const p = PROGRAMS[key];
          const dayIdx = getRelativeDayIndexForDate(key, todayKey());
          const tasks = dayIdx ? (p.days[dayIdx - 1]?.tasks ?? []) : [];
          return (
            <div key={key} className="overflow-hidden rounded-2xl border" style={{ borderColor: COLORS.line }}>
              <div className="bg-white px-4 py-3">
                <div className="text-sm text-black/60">Programa</div>
                <div className="text-base font-semibold">{p.name}</div>
                <div className="text-xs text-black/60">Día {dayIdx || 1} / {p.days.length}</div>
              </div>

              <div className="bg-[#f7f7f7] px-4 py-3">
                <div className="mb-2 text-sm text-black/60">Retos de hoy</div>
                <ul className="space-y-3">
                  {tasks.map((t, i) => {
                    const done = isTaskTodayCompleted(key, i);
                    return (
                      <li key={i} className="flex items-center gap-3">
                        <button
                          onClick={() => { toggleTaskToday(key, i); bump(); }}
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ background: done ? COLORS.green : COLORS.red, color: '#fff' }}
                          aria-label={done ? 'Completado' : 'Sin completar'}
                        >
                          {done ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M6 12h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          )}
                        </button>
                        <span className="text-sm text-black/80">{t}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
