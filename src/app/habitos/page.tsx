import { Suspense } from 'react';
import SafeContainer from '@/components/SafeContainer';
import HabitosClient from './HabitosClient';

export default function HabitosPage() {
  return (
    <SafeContainer>
      <Suspense fallback={<div className="py-6 text-sm text-black/60">Cargando…</div>}>
        <HabitosClient />
      </Suspense>
    </SafeContainer>
  );
}
