'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import SafeContainer from '@/components/SafeContainer';
import ThoughtModal from '@/components/ThoughtModal';
import HabitCard, { HabitCardData } from '@/components/HabitCard';
import { COLORS } from '@/lib/constants';
import { todayThought } from '@/lib/thoughts';

const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector', image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',        image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño que cambia tu futuro', image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',      image: '/meditation.jpg' },
];

export default function Page() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShowSplash(false), 1500); return () => clearTimeout(t); }, []);

  const thought = useMemo(() => todayThought(), []);
  const [openThought, setOpenThought] = useState(false);
  useEffect(() => {
    if (showSplash) return;
    const key = `thought_${new Date().toDateString()}`;
    if (!localStorage.getItem(key)) { setOpenThought(true); localStorage.setItem(key, 'shown'); }
  }, [showSplash]);

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: COLORS.accent }}>
        <div className="relative w-screen" style={{ height: 0, paddingBottom: '177.78%' }}>
          <Image src="/splash.jpg" alt="Build your habits" fill className="object-cover" priority />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, color: COLORS.text }}>
      <SafeContainer>
        <div className="py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Pensamiento del día</h1>
              <p className="text-xs text-black/60">{thought.title}: toca para leerlo de nuevo</p>
            </div>
            <button onClick={() => setOpenThought(true)} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
              Ver pensamiento
            </button>
          </div>

          <div className="-mx-4">
            {FEATURED_HABITS.map((h) => (
              <div key={h.key}>
                <HabitCard data={h} onOpen={(key) => { window.location.href = `/habitos?key=${key}`; }} />
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl bg-white">
            <div className="p-5">
              <div className="mb-3 text-2xl font-bold leading-snug">
                ¿Listo para más? <br /> Descubre todos los hábitos
              </div>
              <Link href="/habitos" className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-white">
                Ver hábitos <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </SafeContainer>
      <ThoughtModal open={openThought} onClose={() => setOpenThought(false)} title={thought.title} text={thought.text} />
    </div>
  );
}
