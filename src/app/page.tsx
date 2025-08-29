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
   ProgramCard (4:5, 100% ancho)
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
  const { title, subtitle } = program;

  // Forzar imágenes por clave solicitadas
  const imgByKey: Record<string, string> = {
    lectura: '/reading.jpg',
    reading: '/reading.jpg',
    burpees: '/burpees.jpg',
    finanzas: '/savings.jpg',
    savings: '/savings.jpg',
    meditacion: '/meditation.jpg',
    meditation: '/meditation.jpg',
  };
  const fallback = '/reading.jpg';
  const image =
    (ident && imgByKey[ident]) ||
    program.image ||
    fallback;

  return (
    <Link href={href} className="block group">
      <div className="relative w-full rounded-2xl overflow-hidden">
        {/* Ratio 4:5 */}
        <div style={{ paddingTop: '125%' }} />
        <Image
          src={image}
          alt={title}
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
        />

        {/* Degradado + textos dentro */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          {subtitle && (
            <p className="text-white/85 text-sm leading-snug mb-1">
              {subtitle}
            </p>
          )}
          <h3 className="text-white text-3xl font-extrabold leading-tight">
            {title}
          </h3>

          <div className="mt-3">
            <span
              className="inline-flex items-center px-4 py-2 rounded-full bg-white text-black text-sm font-medium
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
  // No tipamos explícitamente para evitar choque ProgramMeta vs Program
  const catalog = useMemo(() => listPrograms(), []);
  const [todayThought, setTodayThought] = useState<Thought | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Orden deseado de programas (uno bajo otro)
  const orderedKeys = ['lectura', 'burpees', 'finanzas', 'meditacion'];

  const programsOnePerRow: ProgramLike[] = useMemo(() => {
    // Normalizamos y reordenamos según orderedKeys
    const byIdent = new Map<string, any>();
    for (const p of catalog as any[]) {
      const ident = (p.slug ?? p.key ?? '').toString();
      if (ident) byIdent.set(ident, p);
    }

    const result: ProgramLike[] = [];
    for (const k of orderedKeys) {
      const p = byIdent.get(k);
      if (p) {
        result.push({
          ...p,
          // subtítulo y título ya vienen del catálogo; si faltan, mantenemos lo que haya
        });
      }
    }
    // Si faltara alguno en el catálogo, añadimos el resto al final
    for (const p of catalog as any[]) {
      const ident = (p.slug ?? p.key ?? '').toString();
      if (!orderedKeys.includes(ident)) result.push(p);
    }
    return result;
  }, [catalog]);

  useEffect(() => {
    const list = loadThoughts();
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
    <main className="px-4 sm:px-6 md:px-8 pb-20">

      {/* ===== Franja pequeña: Pensamiento del día ===== */}
      {todayThought && (
        <section className="mb-6 rounded-2xl border border-black/10 bg-white px-4 py-3">
          <div className="flex flex-col items-center text-center gap-1">
            <h2 className="text-sm font-medium text-black/70">Pensamiento del día</h2>
            <p className="text-black/80 text-sm">
              {truncateWords(todayThought.body, 8)}
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-2 inline-flex items-center px-4 py-2 rounded-full border border-black/15 bg-white hover:bg-black hover:text-white transition-colors text-sm font-medium"
            >
              Ver
            </button>
          </div>

          {/* Modal: props correctas y render condicional */}
          {modalOpen && (
            <ThoughtModal
              title={todayThought.title}
              body={todayThought.body}
              onClose={() => setModalOpen(false)}
            />
          )}
        </section>
      )}

      {/* ===== Programas: 1 por fila, 100% ancho, ratio 4:5 ===== */}
      <section className="space-y-5">
        {programsOnePerRow.map((p, i) => {
          const reactKey = (p.slug ?? p.key ?? `p-${i}`).toString();
          return <ProgramCard key={reactKey} program={p} />;
        })}
      </section>

      {/* ===== CTA final ===== */}
      <section className="mt-8 mb-2 text-center">
        <h3 className="text-2xl sm:text-3xl font-semibold mb-4">
          ¿Te gustaría ver nuestros programas de hábitos?
        </h3>
        <Link
          href="/habitos"
          className="inline-flex items-center px-5 py-2.5 rounded-full bg-black text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Ver programas ahora
        </Link>
      </section>
    </main>
  );
}
