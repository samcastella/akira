// src/app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ThoughtModal from '@/components/ThoughtModal';
import { listPrograms } from '@/lib/programs_catalog';

// ===== Pensamiento del día =====
type Thought = { id: string; title: string; body: string };

const LS_THOUGHTS = 'akira_thoughts_v1';
const LS_THOUGHT_SHOWN = 'akira_thought_last_seen';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadThoughts(): Thought[] {
  if (typeof window === 'undefined') return FALLBACK_THOUGHTS;
  try {
    const raw = localStorage.getItem(LS_THOUGHTS);
    const arr = raw ? (JSON.parse(raw) as Thought[]) : [];
    return arr.length ? arr : FALLBACK_THOUGHTS;
  } catch {
    return FALLBACK_THOUGHTS;
  }
}

function pickToday(thoughts: Thought[]): Thought {
  if (!thoughts.length) return FALLBACK_THOUGHTS[0];
  // determinista por día
  const idx = Math.abs(hashStr(todayKey())) % thoughts.length;
  return thoughts[idx];
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const FALLBACK_THOUGHTS: Thought[] = [
  {
    id: 'fallback-1',
    title: 'El presente cuenta',
    body:
      'Cada página leída hoy es un voto a favor de la identidad que quieres construir. Empieza pequeño, pero empieza. ' +
      'La constancia pesa menos que la perfección.',
  },
];

// ===== Página =====
export default function HomePage() {
  // Pensamiento del día
  const thoughts = useMemo(() => loadThoughts(), []);
  const today = useMemo(() => todayKey(), []);
  const thought = useMemo(() => pickToday(thoughts), [thoughts]);

  const [showThought, setShowThought] = useState(false);

  // Mostrar el pop-up automáticamente la primera vez del día
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const last = localStorage.getItem(LS_THOUGHT_SHOWN);
      if (last !== today) {
        setShowThought(true);
        localStorage.setItem(LS_THOUGHT_SHOWN, today);
      }
    } catch {}
  }, [today]);

  const excerpt = useMemo(() => {
    const t = thought.body.trim();
    if (t.length <= 160) return t;
    const cut = t.slice(0, 160);
    const lastDot = cut.lastIndexOf('.');
    return (lastDot > 60 ? cut.slice(0, lastDot + 1) : cut) + '…';
  }, [thought]);

  // Programas del catálogo
  const programs = useMemo(() => listPrograms(), []);

  return (
    <main className="container" style={{ paddingBottom: 16 }}>
      {/* Pensamiento del día */}
      <section
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-card)',
          padding: 16,
          border: 'none',
          marginTop: 12,
          minHeight: 148, // un poco más alto
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{thought.title}</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>{excerpt}</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowThought(true)} aria-haspopup="dialog">
            Ver
          </button>
        </div>
      </section>

      {/* Programas destacados (imagen a todo el ancho y CTA directo al programa) */}
      <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
        {programs.map((p) => (
          <article key={p.slug} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {p.cover && (
              <img
                src={p.cover}
                alt={p.title}
                style={{
                  width: '100%',
                  height: 220,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            )}
            <div style={{ padding: 14 }}>
              <h3 style={{ margin: '0 0 4px' }}>{p.title}</h3>
              {p.subtitle && <p className="muted" style={{ margin: 0 }}>{p.subtitle}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Link href={`/habitos/${p.slug}`} className="btn btn-primary">
                  Empieza ahora
                </Link>
                <Link href={`/habitos/${p.slug}`} className="btn secondary">
                  Ver programa
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Modal de Pensamiento */}
      {showThought && (
        <ThoughtModal
          title={thought.title}
          body={thought.body}
          onClose={() => setShowThought(false)}
        />
      )}
    </main>
  );
}
