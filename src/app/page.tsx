'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ThoughtModal from '@/components/ThoughtModal';
import { listPrograms } from '@/lib/programs_catalog';

/* =========================
   Tipos y helpers
   ========================= */
type Thought = { id: string; title: string; body: string };

const LS_THOUGHTS = 'akira_thoughts_v1';
const LS_THOUGHT_SHOWN = 'akira_thought_last_seen';

const FALLBACK_THOUGHTS: Thought[] = [
  { id: 't1', title: 'Pequeños pasos', body: 'La constancia gana a la intensidad. Empieza hoy con un paso sencillo.' },
  { id: 't2', title: 'Enfoque', body: 'Menos es más: elige una cosa importante y complétala.' },
  { id: 't3', title: 'Movimiento', body: 'Tu energía cambia con el movimiento. Levántate y respira hondo.' },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadThoughts(): Thought[] {
  if (typeof window === 'undefined') return FALLBACK_THOUGHTS;
  try {
    const raw = localStorage.getItem(LS_THOUGHTS);
    if (!raw) return FALLBACK_THOUGHTS;
    const parsed = JSON.parse(raw) as Thought[];
    return Array.isArray(parsed) && parsed.length ? parsed : FALLBACK_THOUGHTS;
  } catch {
    return FALLBACK_THOUGHTS;
  }
}

function truncateWords(text: string, maxWords = 8) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

/* =========================
   Card del programa (4:5)
   Acepta slug o key y pone
   “Ver programa” dentro.
   ========================= */
type ProgramLike = {
  slug?: string;
  key?: string;
  title: string;
  subtitle?: string;
  image?: string;  // ruta en /public
  href?: string;
};

function ProgramCard({ program }: { program: ProgramLike }) {
  const ident = program.slug ?? program.key ?? '';
  const href = program.href ?? (ident ? `/habitos?key=${encodeURIComponent(ident)}` : '/habitos');
  const { title, subtitle, image = '/placeholder.jpg' } = program;

  return (
    <Link href={href} className="block group">
      {/* Mantener ratio 4:5: padding-top:125% */}
      <div className="relative w-full rounded-2xl overflow-hidden">
        <div style={{ paddingTop: '125%' }} />
        <Image
          src={image}
          alt={title}
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
        />

        {/* Degradado y textos dentro de la imagen */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          {subtitle && (
            <p className="text-white/85 text-sm sm:text-base leading-snug mb-1">
              {subtitle}
            </p>
          )}
          <h3 className="text-white text-2xl sm:text-3xl font-extrabold leading-tight">
            {title}
          </h3>

          <div className="mt-3">
            <span
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-white text-black text-sm font-medium
                         group-hover:translate-y-[-1px] transition-transform"
            >
              Ver programa
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* =========================
   Página
   ========================= */
export default function HomePage() {
  // 👉 No tipamos explícitamente para evitar el choque ProgramMeta vs Program
  const programs = useMemo(() => listPrograms(), []);
  const [thoughts, setThoughts] = useState<Thought[]>(FALLBACK_THOUGHTS);
  const [todayThought, setTodayThought] = useState<Thought | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const list = loadThoughts();
    setThoughts(list);

    const key = todayKey();
    const lastSeen = typeof window !== 'undefined' ? localStorage.getItem(LS_THOUGHT_SHOWN) : null;

    let pick: Thought;
    if (lastSeen === key && typeof window !== 'undefined') {
      const lastId = sessionStorage.getItem('akira_last_thought_id');
      pick = list.find(t => t.id === lastId) ?? list[0];
    } else {
      const idx = new Date().getDate() % list.length;
      pick = list[idx];
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_THOUGHT_SHOWN, key);
        sessionStorage.setItem('akira_last_thought_id', pick.id);
      }
    }
    setTodayThought(pick);
  }, []);

  return (
    <main className="px-4 sm:px-6 md:px-8 pb-16">
      <h1 className="page-title text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mt-4 mb-6">
        Akira — Build your habits
      </h1>

      {/* Pensamiento del día */}
      {todayThought && (
        <section className="mb-10 border border-black/10 rounded-2xl p-4 sm:p-6 bg-white">
          <div className="flex flex-col items-center text-center gap-2">
            <h2 className="text-base font-medium text-black/70">Pensamiento del día</h2>
            <h3 className="text-xl sm:text-2xl font-semibold">{todayThought.title}</h3>
            <p className="text-black/80 max-w-prose">{truncateWords(todayThought.body, 8)}</p>

            {/* Botón centrado y debajo del texto */}
            <button
              onClick={() => setModalOpen(true)}
              className="mt-3 inline-flex items-center px-4 py-2 rounded-full border border-black/15 bg-white hover:bg-black hover:text-white transition-colors text-sm font-medium"
            >
              Ver
            </button>
          </div>

          <ThoughtModal open={modalOpen} onClose={() => setModalOpen(false)} thought={todayThought} />
        </section>
      )}

      {/* Programas (full width, 4:5, textos y CTA dentro) */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Programas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {(programs as ProgramLike[]).map((p, i) => {
            const reactKey = p.slug ?? p.key ?? `p-${i}`;
            return <ProgramCard key={reactKey} program={p} />;
          })}
        </div>
      </section>
    </main>
  );
}
