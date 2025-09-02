'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, RotateCcw, Trash2, Camera } from 'lucide-react';

/* ====== storage + tipos ====== */
const LS_RETOS = 'akira_mizona_retos_v1';
const LS_USER  = 'akira_user_v1';              // donde RegistrationModal guarda con saveUserMerge
const LS_ACTIVE_PROGRAMS = 'akira_programs_active_v1'; // array de keys de programas activos

type Reto = { id: string; text: string; createdAt: number; due: string; done: boolean; permanent?: boolean };

type UserProfileLS = {
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  sexo?: 'masculino' | 'femenino' | 'prefiero_no_decirlo';
  edad?: number;
  estatura?: number;
  peso?: number;
  actividad?: 'sedentario' | 'ligero' | 'moderado' | 'intenso';
  caloriasDiarias?: number;
  instagram?: string;
  tiktok?: string;
  foto?: string; // NUEVO: avatar dataURL/URL
};

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(val));
}

const todayKey = () => new Date().toISOString().slice(0,10);
const fmtDate = (d: string | number) =>
  new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

/* ====== página ====== */
export default function MiZonaPage() {
  const [retos, setRetos] = useState<Reto[]>(() => loadLS<Reto[]>(LS_RETOS, []));
  const [user, setUser]   = useState<UserProfileLS>(() => loadLS<UserProfileLS>(LS_USER, {}));
  const [activePrograms, setActivePrograms] = useState<string[]>(() => loadLS<string[]>(LS_ACTIVE_PROGRAMS, []));

  useEffect(() => { saveLS(LS_RETOS, retos); }, [retos]);
  useEffect(() => {
    // refresco por si el usuario vuelve desde Registro/Perfil
    setUser(loadLS<UserProfileLS>(LS_USER, {}));
    setActivePrograms(loadLS<string[]>(LS_ACTIVE_PROGRAMS, []));
  }, []);

  const today = todayKey();

  const atrasados = useMemo(
    () => retos.filter(r => !r.done && r.due < today).sort((a,b)=>a.due.localeCompare(b.due)),
    [retos, today]
  );
  const hoy = useMemo(
    () => retos.filter(r => !r.done && r.due === today),
    [retos, today]
  );
  const proximos = useMemo(
    () => retos.filter(r => !r.done && r.due > today).sort((a,b)=>a.due.localeCompare(b.due)),
    [retos, today]
  );
  const hechos = useMemo(
    () => retos.filter(r => r.done).sort((a,b)=>b.createdAt - a.createdAt),
    [retos]
  );

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
          id: crypto.randomUUID(),
          text: r.text,
          createdAt: Date.now(),
          due: tomorrow.toISOString().slice(0,10),
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

  const greetingName = user?.nombre?.trim() ? user.nombre : 'usuario/a';
  const age = user?.edad ?? '—';
  const weight = user?.peso ?? '—';
  const activeCount = activePrograms?.length ?? 0;

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h2 className="page-title">Mi zona</h2>

      {/* ===== Panel saludo + datos rápidos ===== */}
      <section
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-card)',
          padding: 18,
          border: '1px solid var(--line)',
          marginBottom: 16
        }}
      >
        <div className="flex items-center gap-4">
          {/* Avatar redondo */}
          <Link href="/mizona/perfil" className="shrink-0" title="Editar foto de perfil">
            <div
              className="rounded-full overflow-hidden flex items-center justify-center"
              style={{
                width: 64, height: 64,
                border: '1px solid var(--line)',
                background: '#f7f7f7',
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
          </Link>

          <div className="flex-1">
            <p className="text-sm" style={{ margin: 0, fontWeight: 700 }}>
              Hola {greetingName},
            </p>

            <div className="mt-3 grid grid-cols-3 gap-8 text-sm">
              <div>
                <div className="muted">Edad</div>
                <div style={{ fontWeight: 600 }}>{age}</div>
              </div>
              <div>
                <div className="muted">Peso</div>
                <div style={{ fontWeight: 600 }}>{weight}</div>
              </div>
              <div>
                <div className="muted">Programas activos</div>
                <div style={{ fontWeight: 600 }}>{activeCount}</div>
              </div>
            </div>

            <div className="mt-4">
              <Link href="/mizona/perfil" className="btn">
                Ver más
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Retos ===== */}
      <section
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-card)',
          padding: 18,
          border: 'none',
        }}
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Tus retos diarios. Marca como hecho y, si es permanente, se recreará automáticamente para mañana.
        </p>

        <Section title="Atrasados" empty="No tienes retos atrasados.">
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

        <Section title="Próximos" empty="Sin retos próximos.">
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

        <Section title="Hechos" empty="Aún no has completado retos.">
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
    </main>
  );
}

/* ====== UI ====== */
function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has =
    Array.isArray(children) ? (children as React.ReactNode[]).length > 0 : !!children;
  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h3>
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
