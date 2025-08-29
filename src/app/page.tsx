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

// clave YYYY-MM-DD
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Fallback por si no hay LS
const FALLBACK_THOUGHTS: Thought[] = [
  { id: 't1', title: 'Pequeños pasos', body: 'La constancia gana a la intensidad. Empieza hoy con un paso sencillo.' },
  { id: 't2', title: 'Enfoque', body: 'Menos es más: elige una cosa importante y complétala.' },
  { id: 't3', title: 'Movimiento', body: 'Tu energía cambia con el movimiento. Levántate y respira hondo.' },
];

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
   ========================= */
type Program = {
  key: string;
  title: string;
  subtitle?: string;
  image?: string;    // ruta en /public
  href?: string;     // link a detalle
};

function ProgramCard({ program }: { program: Program }) {
  const { title, subtitle, image = '/placeholder.jpg', href = `/habitos?key=${program.key}` } = program;

  return (
    <Link href={href} className="block group">
      {/* Wrapper con ratio 4:5 (height = 125% del ancho) */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-sm">
        <div style={{ paddingTop: '125%' }} /> {/* 4:5 */}
        {/* Imagen */}
        <Image
          src={image}
          alt={title}
          fill
          priority={false}
          className="object-cover"
          sizes="100vw"
        />
        {/* Overlay + textos dentro de la imagen */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex flex-col gap-2">
          <h3 className="text-white text-xl sm:text-2xl font-semibold leading-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-white/85 text-sm sm:text-base leading-snug">
              {subtitle}
            </p>
          )}
          <div className="mt-2">
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-black text-sm font-medium
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
  const programs = useMemo<Program[]>(() => listPrograms(), []);
  const [thoughts, setThoughts] = useState<Thought[]>(FALLBACK_THOUGHTS);
  const [todayThought, setTodayThought] = useState<Thought | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Cargar pensamientos y fijar el de hoy (uno por día)
  useEffect(() => {
    const list = loadThoughts();
    setThoughts(list);

    const key = todayKey();
    const lastSeen = (typeof window !== 'undefined') ? localStorage.getItem(LS_THOUGHT_SHOWN) : null;

    let pick: Thought;
    if (lastSeen === key && typeof window !== 'undefined') {
      // Ya se mostró hoy → intenta recuperar el último id desde sessionStorage si lo guardaste
      const lastId = sessionStorage.getItem('akira_last_thought_id');
      pick = list.find(t => t.id === lastId) ?? list[0];
    } else {
      // Elige “pseudo-aleatorio” estable para el día
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
      {/* Título de página */}
      <h1 className="page-title text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mt-4 mb-6">
        Akira — Build your habits
      </h1>

      {/* Pensamiento del día */}
      {todayThought && (
        <section className="mb-10 border border-black/10 rounded-2xl p-4 sm:p-6 bg-white">
          <div className="flex flex-col items-center text-center gap-2">
            <h2 className="text-base font-medium text-black/70">Pensamiento del día</h2>
            <h3 className="text-xl sm:text-2xl font-semibold">{todayThought.title}</h3>
            <p className="text-black/80 max-w-prose">
              {truncateWords(todayThought.body, 8)}
            </p>
            {/* Botón centrado y debajo del texto */}
            <button
              onClick={() => setModalOpen(true)}
              className="mt-3 inline-flex items-center px-4 py-2 rounded-full border border-black/15 bg-white hover:bg-black hover:text-white transition-colors text-sm font-medium"
            >
              Ver
            </button>
          </div>

          {/* Modal (usa tu componente existente) */}
          <ThoughtModal open={modalOpen} onClose={() => setModalOpen(false)} thought={todayThought} />
        </section>
      )}

      {/* Programas destacados */}
      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold">Programas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {programs.map((p) => (
            <ProgramCard key={p.key} program={p as Program} />
          ))}
        </div>
      </section>
    </main>
  );
}
