'use client';

import { useEffect, useState } from 'react';
import { COLORS } from '@/lib/constants';
import { todayKey, daysInMonth } from '@/lib/date';
import {
  getActiveProgram,
  getDayTasks,
  toggleTask,
  getProgress,
  type TaskWithStatus,
} from '@/lib/programService';
import { supabase } from '@/lib/supabaseClient';

/* =========
   Retos desde Herramientas (Mi zona)
   ========= */
type Reto = {
  id: string;
  text: string;
  createdAt: number;
  due: string; // YYYY-MM-DD
  done: boolean;
  permanent?: boolean;
};

const LS_RETOS = 'akira_mizona_retos_v1';
function loadLS<T>(k: string, fb: T): T {
  if (typeof window === 'undefined') return fb;
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch {
    return fb;
  }
}
function saveLS<T>(k: string, v: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(k, JSON.stringify(v));
}

/* =========
   Componente
   ========= */
export default function MiZona() {
  const [name, setName] = useState<string>('Amigo/a');
  const [retos, setRetos] = useState<Reto[]>(() =>
    loadLS<Reto[]>(LS_RETOS, []),
  );

  // Estado de programas activos (solo soportamos 1 ahora: lectura-30)
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [totalDays, setTotalDays] = useState<number>(30);
  const [dayTasks, setDayTasks] = useState<TaskWithStatus[]>([]);
  const [programSlug, setProgramSlug] = useState<string | null>(null);

  useEffect(() => {
    setName(localStorage.getItem('akira_name') || 'Amigo/a');
  }, []);

  useEffect(() => {
    saveLS(LS_RETOS, retos);
  }, [retos]);

  const hoy = todayKey();
  const retosHoy = retos.filter((r) => r.due === hoy && !r.done);

  const completarReto = (id: string) => {
    const r = retos.find((x) => x.id === id);
    if (!r) return;
    const upd = retos.map((x) => (x.id === id ? { ...x, done: true } : x));

    if (r.permanent) {
      const tmr = new Date();
      tmr.setDate(tmr.getDate() + 1);
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

  const borrarReto = (id: string) => setRetos(retos.filter((r) => r.id !== id));
  const editarReto = (id: string) => {
    const r = retos.find((x) => x.id === id);
    if (!r) return;
    const nuevo = prompt('Editar reto:', r.text);
    if (nuevo == null) return;
    setRetos(retos.map((x) => (x.id === id ? { ...x, text: nuevo } : x)));
  };

  // === Cargar datos de programas activos ===
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;

        // De momento hardcodeamos lectura-30
        const slug = 'lectura-30';
        const active = await getActiveProgram(supabase, userId, slug);
        if (!active) return;

        const { currentDay, totalDays } = await getProgress(
          supabase,
          userId,
          slug,
        );
        const dayTasks = await getDayTasks(supabase, userId, slug, currentDay);

        if (!alive) return;
        setProgramSlug(slug);
        setCurrentDay(currentDay);
        setTotalDays(totalDays);
        setDayTasks(dayTasks);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleToggleTask(t: TaskWithStatus) {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || !programSlug) return;

      await toggleTask(
        supabase,
        userId,
        programSlug,
        t.day,
        t.id,
        !t.completed,
      );

      const updated = await getDayTasks(supabase, userId, programSlug, t.day);
      setDayTasks(updated);
    } catch (err) {
      console.error(err);
    }
  }

  // === Calendario ===
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const nDays = daysInMonth(y, m);
  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}-`;

  return (
    <div className="py-6">
      {/* Saludo */}
      <div className="mb-4">
        <h2 className="text-3xl font-black leading-tight">Hola {name}</h2>
      </div>

      {/* Métricas rápidas (ejemplo: número de retos hechos / días con retos) */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: COLORS.line }}
        >
          <div className="text-4xl font-black">
            {retos.filter((r) => r.done).length}
          </div>
          <div className="text-sm text-black/60">retos completados</div>
        </div>
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: COLORS.line }}
        >
          <div className="text-4xl font-black">
            {new Set(retos.filter((r) => r.done).map((r) => r.due)).size}
          </div>
          <div className="text-sm text-black/60">días cumpliendo retos</div>
        </div>
      </div>

      {/* Calendario mensual */}
      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: COLORS.line }}
      >
        <div className="mb-2 text-sm font-medium">Este mes</div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: nDays }, (_, i) => {
            const day = i + 1;
            const dKey = `${monthPrefix}${String(day).padStart(2, '0')}`;
            // Por ahora: día completado si hay algún reto completado ese día
            const anyDone = retos.some((r) => r.due === dKey && r.done);
            let bg = 'transparent',
              br = COLORS.gray;
            if (anyDone) {
              bg = COLORS.green;
              br = COLORS.green;
            }
            return (
              <div
                key={dKey}
                className="flex items-center justify-center rounded-full text-xs"
                style={{
                  width: 28,
                  height: 28,
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
      </div>

      {/* Retos añadidos desde Herramientas */}
      <section className="mt-5">
        <div className="mb-2 text-sm text-black/60">Retos de hoy</div>
        <ul className="list">
          {retosHoy.length === 0 && (
            <li className="muted" style={{ padding: '10px 0' }}>
              No tienes retos añadidos desde Herramientas para hoy.
            </li>
          )}
          {retosHoy.map((r) => (
            <li
              key={r.id}
              style={{
                padding: '12px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" onChange={() => completarReto(r.id)} />
                <span>
                  {r.text}
                  {r.permanent ? ' · (permanente)' : ''}
                </span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn secondary"
                  onClick={() => editarReto(r.id)}
                >
                  Editar
                </button>
                <button className="btn red" onClick={() => borrarReto(r.id)}>
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Programa activo */}
      <div className="mt-5 space-y-3">
        {!programSlug && (
          <div
            className="rounded-2xl border p-4 text-sm text-black/70"
            style={{ borderColor: COLORS.line }}
          >
            Aún no has empezado ningún programa. Ve a “Hábitos” o “Inicio” para
            comenzar uno.
          </div>
        )}

        {programSlug && (
          <div
            key={programSlug}
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: COLORS.line }}
          >
            <div className="bg-white px-4 py-3">
              <div className="text-sm text-black/60">Programa</div>
              <div className="text-base font-semibold">Lectura</div>
              <div className="text-xs text-black/60">
                Día {currentDay} / {totalDays}
              </div>
            </div>

            <div className="bg-[#f7f7f7] px-4 py-3">
              <div className="mb-2 text-sm text-black/60">Retos de hoy</div>
              <ul className="space-y-3">
                {dayTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleTask(t)}
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{
                        background: t.completed ? COLORS.green : COLORS.red,
                        color: '#fff',
                      }}
                      aria-label={t.completed ? 'Completado' : 'Sin completar'}
                    >
                      {t.completed ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M20 6L9 17l-5-5"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M6 12h12"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm text-black/80">{t.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
