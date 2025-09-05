// src/app/mizona/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check, RotateCcw, Trash2, Camera,
  ChevronRight, ChevronLeft
} from 'lucide-react';

/* ====== usuario (reactivo) ====== */
import { useUserProfile } from '@/lib/user';

/* ====== storage + tipos ====== */
const LS_RETOS = 'akira_mizona_retos_v1';
const LS_ACTIVE_PROGRAMS = 'akira_programs_active_v1'; // array de keys de programas activos

type Reto = { id: string; text: string; createdAt: number; due: string; done: boolean; permanent?: boolean };

type UserProfileLS = {
  username?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  sexo?: 'masculino' | 'femenino' | 'prefiero_no_decirlo';
  edad?: number;
  estatura?: number;           // cm
  peso?: number;               // kg
  actividad?: 'sedentario' | 'ligero' | 'moderado' | 'intenso';
  caloriasDiarias?: number;    // kcal/día
  instagram?: string;
  tiktok?: string;
  foto?: string;               // avatar dataURL/URL
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(val));
}

const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string | number) =>
  new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

/* Pequeños formateadores */
const fmtMaybe = (v: any, suffix = '') => (v === undefined || v === null || v === '' ? '—' : `${v}${suffix}`);
const fmtKg = (v?: number) => (typeof v === 'number' ? `${v} kg` : '—');
const fmtCm = (v?: number) => (typeof v === 'number' ? `${v} cm` : '—');
const fmtKcal = (v?: number) => (typeof v === 'number' ? `${v} kcal` : '—');

/* ===== helpers de calendario/semana ===== */
function mondayOf(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=lunes
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/* ====== página ====== */
type Tab = 'habitos' | 'crear' | 'logros' | 'perfil';

export default function MiZonaPage() {
  const [tab, setTab] = useState<Tab>('habitos');

  const [retos, setRetos] = useState<Reto[]>(() => loadLS<Reto[]>(LS_RETOS, []));
  const user = useUserProfile() as unknown as UserProfileLS; // ← reactivo a cambios del perfil
  const [activePrograms, setActivePrograms] = useState<string[]>(() => loadLS<string[]>(LS_ACTIVE_PROGRAMS, []));

  /* Persiste cambios de retos */
  useEffect(() => { saveLS(LS_RETOS, retos); }, [retos]);

  /* Sincroniza con otros tabs/cambios para retos y programas activos */
  useEffect(() => {
    const sync = () => {
      setActivePrograms(loadLS<string[]>(LS_ACTIVE_PROGRAMS, []));
      setRetos(loadLS<Reto[]>(LS_RETOS, []));
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === LS_ACTIVE_PROGRAMS || e.key === LS_RETOS) sync();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const today = todayKey();

  const atrasados = useMemo(
    () => retos.filter(r => !r.done && r.due < today).sort((a, b) => a.due.localeCompare(b.due)),
    [retos, today]
  );
  const hoy = useMemo(
    () => retos.filter(r => r.due === today),
    [retos, today]
  );
  const proximos = useMemo(
    () => retos.filter(r => !r.done && r.due > today).sort((a, b) => a.due.localeCompare(b.due)),
    [retos, today]
  );
  const hechos = useMemo(
    () => retos.filter(r => r.done).sort((a, b) => b.createdAt - a.createdAt),
    [retos]
  );

  /* === progreso semanal (colores por día) === */
  const weekStart = mondayOf(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLabel = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function dayColor(dateKey: string) {
    const dayRetos = retos.filter(r => r.due === dateKey);
    if (dayRetos.length === 0) return 'gray';
    const doneCount = dayRetos.filter(r => r.done).length;
    if (doneCount === 0) return 'red';
    if (doneCount < dayRetos.length) return 'orange';
    return 'green';
  }

  /* === calendario mensual === */
  const [monthViewOpen, setMonthViewOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });

  const daysInMonth = useMemo(() => {
    const first = new Date(monthCursor);
    const last = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const days: Date[] = [];
    // padding desde lunes
    const pad = (first.getDay() + 6) % 7;
    for (let i = 0; i < pad; i++) days.push(new Date(first.getFullYear(), first.getMonth(), i - pad + 1));
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d));
    // completa a múltiplo de 7
    while (days.length % 7 !== 0) {
      const next = new Date(days[days.length - 1]); next.setDate(next.getDate() + 1); days.push(next);
    }
    return days;
  }, [monthCursor]);

  /* === lógica clave: completar y recrear si es permanente === */
  function completeReto(id: string) {
    setRetos(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const r = prev[idx];

      const updated = [...prev];
      updated[idx] = { ...r, done: true };

      if (r.permanent) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const clone: Reto = {
          id: (globalThis.crypto as any)?.randomUUID?.() ?? String(Date.now()),
          text: r.text,
          createdAt: Date.now(),
          due: tomorrow.toISOString().slice(0, 10),
          done: false,
          permanent: true,
        };
        updated.unshift(clone);
      }
      return updated;
    });
  }

  function undoReto(id: string) {
    setRetos(prev => prev.map(r => r.id === id ? { ...r, done: false } : r));
  }

  function deleteReto(id: string) {
    setRetos(prev => prev.filter(r => r.id !== id));
  }

  const greetingName = user?.nombre?.trim()
    ? user.nombre
    : (user?.username?.trim() ? `@${user.username}` : 'usuario/a');

  const age = fmtMaybe(user?.edad);
  const weight = fmtKg(user?.peso);
  const height = fmtCm(user?.estatura);
  const kcal = fmtKcal(user?.caloriasDiarias);
  const activeCount = activePrograms?.length ?? 0;

  return (
    <main
      className="container"
      style={{ paddingTop: 24, paddingBottom: 24, overflowX: 'hidden', background: 'white' }}
    >
      {/* ===== Sub-navegación en píldoras ===== */}
      <h2 className="page-title" style={{ marginBottom: 8 }}>Hola {greetingName}</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
        Navega por tus hábitos, crea nuevos y consulta tus logros.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          className="btn"
          onClick={() => setTab('habitos')}
          style={tab === 'habitos'
            ? { background: 'black', color: 'white' }
            : { background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Mis hábitos
        </button>
        <button
          className="btn"
          onClick={() => setTab('crear')}
          style={tab === 'crear'
            ? { background: 'black', color: 'white' }
            : { background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Crear hábito
        </button>
        <button
          className="btn"
          onClick={() => setTab('logros')}
          style={tab === 'logros'
            ? { background: 'black', color: 'white' }
            : { background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Logros
        </button>
        <Link
          href="/mizona/perfil"
          className="btn"
          style={{ background: 'white', color: 'black', border: '1px solid var(--line)' }}
        >
          Editar mi perfil
        </Link>
      </div>

      {tab === 'habitos' && (
        <>
          {/* ===== Card de usuario (todo clicable) ===== */}
          <Link
            href="/mizona/perfil"
            style={{
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              background: 'white',
              borderRadius: 'var(--radius-card)',
              padding: 18,
              border: '1px solid var(--line)',
              marginBottom: 16
            }}
            aria-label="Ir a mi perfil"
          >
            <div className="flex items-center gap-4">
              {/* Avatar redondo */}
              <div
                className="rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  width: 64, height: 64,
                  border: '1px solid var(--line)',
                  background: '#f7f7f7',
                  flex: '0 0 auto'
                }}
              >
                {user?.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.foto}
                    alt="Foto de perfil"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Camera size={24} className="muted" />
                )}
              </div>

              {/* Métricas rápidas */}
              <div className="flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-10 text-sm">
                  <div>
                    <div className="muted">Edad</div>
                    <div style={{ fontWeight: 600 }}>{age}</div>
                  </div>
                  <div>
                    <div className="muted">Peso</div>
                    <div style={{ fontWeight: 600 }}>{weight}</div>
                  </div>
                  <div>
                    <div className="muted">Estatura</div>
                    <div style={{ fontWeight: 600 }}>{height}</div>
                  </div>
                  <div>
                    <div className="muted">Kcal diarias</div>
                    <div style={{ fontWeight: 600 }}>{kcal}</div>
                  </div>
                  <div>
                    <div className="muted">Programas activos</div>
                    <div style={{ fontWeight: 600 }}>{activeCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* ===== Semana (círculos) + toggle calendario mensual ===== */}
          <section
            style={{
              background: 'white',
              borderRadius: 'var(--radius-card)',
              padding: 14,
              border: '1px solid var(--line)',
              marginBottom: 16
            }}
          >
            <div className="flex items-center">
              <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
                {weekDays.map((d, i) => {
                  const k = ymd(d);
                  const color = dayColor(k);
                  const bg =
                    color === 'green' ? '#10b981' :
                    color === 'orange' ? '#f59e0b' :
                    color === 'red' ? '#e10600' : '#e5e7eb';
                  const fg = color === 'gray' ? '#111' : 'white';
                  return (
                    <div key={k} style={{ textAlign: 'center' }}>
                      <div
                        title={`${dayLabel[i]} · ${k}`}
                        style={{
                          width: 28, height: 28, borderRadius: 999,
                          background: bg, color: fg, display: 'grid', placeItems: 'center',
                          fontSize: 12, fontWeight: 600, opacity: 0.95
                        }}
                      >
                        {dayLabel[i]}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setMonthViewOpen(v => !v)}
                title="Ver calendario mensual"
                aria-label="Ver calendario mensual"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  marginLeft: 8,
                  lineHeight: 0,
                  cursor: 'pointer',
                  color: 'black'
                }}
              >
                <ChevronRight size={22} />
              </button>
            </div>

            {monthViewOpen && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => {
                      const d = new Date(monthCursor);
                      d.setMonth(d.getMonth() - 1);
                      setMonthCursor(d);
                    }}
                    aria-label="Mes anterior"
                    style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="text-sm font-semibold">
                    {monthCursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </div>
                  <button
                    onClick={() => {
                      const d = new Date(monthCursor);
                      d.setMonth(d.getMonth() + 1);
                      setMonthCursor(d);
                    }}
                    aria-label="Mes siguiente"
                    style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-xs" style={{ width: '100%' }}>
                  {['L','M','X','J','V','S','D'].map(hl => (
                    <div key={`h-${hl}`} className="muted" style={{ textAlign: 'center' }}>{hl}</div>
                  ))}
                  {daysInMonth.map((d, idx) => {
                    const k = ymd(d);
                    const inCurrent = d.getMonth() === monthCursor.getMonth();
                    const color = dayColor(k);
                    const bg =
                      color === 'green' ? '#10b981' :
                      color === 'orange' ? '#f59e0b' :
                      color === 'red' ? '#e10600' : '#e5e7eb';
                    const fg = color === 'gray' ? '#111' : 'white';
                    return (
                      <div
                        key={`d-${idx}-${k}`}
                        style={{
                          padding: 6,
                          borderRadius: 8,
                          textAlign: 'center',
                          opacity: inCurrent ? 1 : 0.4,
                          background: bg,
                          color: fg,
                          fontWeight: 600
                        }}
                        title={`${k}`}
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ===== Listados (orden por importancia) ===== */}

          {/* 1) Importante: Mis hábitos (retos del usuario) */}
          <section
            style={{
              background: 'white',
              borderRadius: 'var(--radius-card)',
              padding: 18,
              border: 'none',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Mis hábitos</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Marca como hecho y, si es permanente, se recreará automáticamente para mañana.
            </p>

            <Section title="Atrasados" empty="No tienes hábitos atrasados.">
              {atrasados.map(r => (
                <RetoItem
                  key={r.id}
                  reto={r}
                  onDone={() => completeReto(r.id)}
                  onUndo={() => undoReto(r.id)}
                  onDelete={() => deleteReto(r.id)}
                />
              ))}
            </Section>

            <Section title={`Hoy · ${fmtDate(today)}`} empty="Nada para hoy.">
              {hoy.map(r => (
                <RetoItem
                  key={r.id}
                  reto={r}
                  onDone={() => completeReto(r.id)}
                  onUndo={() => undoReto(r.id)}
                  onDelete={() => deleteReto(r.id)}
                />
              ))}
            </Section>

            <Section title="Próximos" empty="Sin hábitos próximos.">
              {proximos.map(r => (
                <RetoItem
                  key={r.id}
                  reto={r}
                  onDone={() => completeReto(r.id)}
                  onUndo={() => undoReto(r.id)}
                  onDelete={() => deleteReto(r.id)}
                />
              ))}
            </Section>

            <Section title="Hechos" empty="Aún no has completado hábitos.">
              {hechos.map(r => (
                <RetoItem
                  key={r.id}
                  reto={r}
                  done
                  onDone={() => completeReto(r.id)}
                  onUndo={() => undoReto(r.id)}
                  onDelete={() => deleteReto(r.id)}
                />
              ))}
            </Section>
          </section>

          {/* 2) Un poco menos importante: Programas activos */}
          <section
            style={{
              background: 'white',
              borderRadius: 'var(--radius-card)',
              padding: 18,
              border: '1px solid var(--line)',
              marginTop: 16
            }}
          >
            <h3 style={{ marginTop: 0 }}>Programas activos</h3>
            {activePrograms.length === 0 ? (
              <p className="muted">No tienes programas activos. Actívalos desde la sección de Programas.</p>
            ) : (
              <ul className="list" style={{ margin: 0 }}>
                {activePrograms.map(key => (
                  <li key={key} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                    <div className="flex items-center justify-between">
                      <div><strong>{key}</strong></div>
                      <div className="muted text-xs">Hábitos del programa aparecerán aquí</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3) Por último: Hábitos con amigos */}
          <section
            style={{
              background: 'white',
              borderRadius: 'var(--radius-card)',
              padding: 18,
              border: '1px solid var(--line)',
              marginTop: 16
            }}
          >
            <h3 style={{ marginTop: 0 }}>Hábitos con amigos</h3>
            <p className="muted">Cuando te unas a retos con amigos, verás aquí los hábitos compartidos del día.</p>
          </section>
        </>
      )}

      {tab === 'crear' && (
        <section
          style={{
            background: 'white',
            borderRadius: 'var(--radius-card)',
            padding: 18,
            border: '1px solid var(--line)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Crear hábito</h3>
          <p className="muted">Próximamente: formulario para crear y programar hábitos.</p>
        </section>
      )}

      {tab === 'logros' && (
        <section
          style={{
            background: 'white',
            borderRadius: 'var(--radius-card)',
            padding: 18,
            border: '1px solid var(--line)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Logros</h3>
          <p className="muted">Próximamente: tus rachas, días perfectos y medallas.</p>
        </section>
      )}
    </main>
  );
}

/* ====== UI ====== */
function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has =
    Array.isArray(children) ? (children as React.ReactNode[]).length > 0 : !!children;
  return (
    <section style={{ marginTop: 16 }}>
      <h4 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h4>
      <ul className="list" style={{ margin: 0 }}>
        {has ? children : <li className="muted" style={{ padding: '8px 0' }}>{empty}</li>}
      </ul>
    </section>
  );
}

function RetoItem({
  reto, done = false, onDone, onUndo, onDelete
}: {
  reto: Reto;
  done?: boolean;
  onDone: () => void;
  onUndo: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      style={{
        padding: '10px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        borderTop: '1px solid var(--line)'
      }}
    >
      <div>
        <div>
          <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{reto.text}</span>
          {reto.permanent && <span className="badge" style={{ marginLeft: 8 }}>permanente</span>}
        </div>
        <small className="muted">Para: {fmtDate(reto.due)}</small>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {!done ? (
          <button className="btn" onClick={onDone} title="Marcar como hecho"><Check size={16} /></button>
        ) : (
          <button className="btn secondary" onClick={onUndo} title="Deshacer"><RotateCcw size={16} /></button>
        )}
        <button className="btn red" onClick={onDelete} title="Eliminar"><Trash2 size={16} /></button>
      </div>
    </li>
  );
}
