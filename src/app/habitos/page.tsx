'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SafeContainer from '@/components/SafeContainer';
import HabitCard, { HabitCardData } from '@/components/HabitCard';
import HabitDetail from '@/components/HabitDetail';
import { PROGRAMS, READING_PROGRAM } from '@/lib/programs';

const FEATURED_HABITS: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',      subtitle: 'Conviértete en un superlector', image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',       subtitle: 'Comienza hoy y no pares',        image: '/burpees.jpg' },
  { key: 'ahorro',     title: 'Ahorra sin darte cuenta', subtitle: 'Un hábito pequeño que cambia tu futuro', image: '/savings.jpg' },
  { key: 'meditacion', title: 'Medita 5 minutos',        subtitle: 'Encuentra calma en tu día',      image: '/meditation.jpg' },
];

export default function HabitosPage() {
  const sp = useSearchParams();
  const initial = sp.get('key');
  const [selectedHabit, setSelectedHabit] = useState<string | null>(initial);

  const selectedProgram = useMemo(
    () => (selectedHabit ? PROGRAMS[selectedHabit] ?? READING_PROGRAM : null),
    [selectedHabit]
  );

  return (
    <SafeContainer>
      <div className="py-6">
        {!selectedProgram ? (
          <>
            <h2 className="text-xl font-semibold">Hábitos</h2>
            <p className="mt-1 text-sm text-black/70">
              Explora programas para instaurar o eliminar hábitos.
            </p>
            <div className="mt-4 -mx-4">
              {FEATURED_HABITS.map((h) => (
                <div key={h.key}>
                  <HabitCard data={h} onOpen={setSelectedHabit} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <HabitDetail
            program={selectedProgram}
            onBack={() => setSelectedHabit(null)}
            onStarted={() => {}}
          />
        )}
      </div>
    </SafeContainer>
  );
}

