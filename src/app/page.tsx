// src/app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ThoughtModal from '@/components/ThoughtModal';
import { PROGRAMS } from '@/lib/programs';
import { Dumbbell, BookOpen, PiggyBank, Brain } from 'lucide-react';

/* ===== Pensamiento del día ===== */
type Thought = { id: string; title: string; body: string };

const LS_THOUGHTS = 'akira_thoughts_v1';
const LS_THOUGHT_SHOWN = 'akira_thought_last_seen';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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
  const idx = Math.abs(hashStr(todayKey())) % thoughts.length;
  return thoughts[idx];
}
function firstWords(txt: string, n = 9) {
  const words = txt.trim().split(/\s+/);
  const slice = words.slice(0, n).join(' ');
  return words.length > n ? slice + '…' : slice;
}

/* ===== Icono por programa ===== */
function ProgramIcon({ slug }: { slug: string }) {
  if (slug?.includes('burpees')) return <Dumbbell size={18} />;
  if (slug?.includes('lectura') || slug?.includes('reading')) return <BookOpen size={18} />;
  if (slug?.includes('finanzas') || slug?.includes('savings')) return <PiggyBank size={18} />;
  if (slug?.includes('medit')) return <Brain size={18} />;
  return <BookOpen size={18} />;
}

/* ===== Página ===== */
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

  const excerpt = useMemo(() => firstWords(thought.body, 9), [thought]);

  // Catálogo normalizado a array
  const programs = useMemo(() => {
    const cat: any = PROGRAMS as any;
    if (Array.isArray(cat)) return cat;
    if (cat && typeof cat === 'object') return Object.values(cat);
    return [];
  }, []);

  return (
    <main className="container" style={{ paddingBottom: 16 }}>
      {/* Pensamiento del día */}
      <section
        className="home-thought"
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-card)',
          padding: 16,
          border: '1px solid var(--line)',
          marginTop: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{thought.title}</h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>{excerpt}</p>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowThought(true)}
            aria-haspopup="dialog"
          >
            Ver
          </button>
        </div>
      </section>

      {/* Programas */}
      <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
        {programs.map((p: any, i: number) => (
          <article key={p?.slug ?? p?.id ?? p?.key ?? i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {p?.cover && (
              <img
                src={p.cover}
                alt={p?.title ?? 'Programa'}
                className="cover-img"
              />
            )}
            <div style={{ padding: 14 }}>
              <h3 style={{ margin: '0 0 4px' }}>{p?.title ?? p?.name ?? 'Programa'}</h3>
              {p?.subtitle && <p className="muted" style={{ margin: 0 }}>{p.subtitle}</p>}

              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Link href={`/habitos/${p?.slug ?? p?.id ?? p?.key ?? 'programa'}`} className="btn btn-primary">
                  Empieza ahora
                </Link>

                <Link href={`/habitos/${p?.slug ?? p?.id ?? p?.key ?? 'programa'}`} className="btn secondary">
                  Ver programa
                  <span className="icon"><ProgramIcon slug={(p?.slug ?? p?.id ?? p?.key ?? '')} /></span>
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Modal de Pensamiento */}
      <ThoughtModal
        open={showThought}
        title={thought.title}
        text={thought.body}
        onClose={() => setShowThought(false)}
      />
    </main>
  );
}
