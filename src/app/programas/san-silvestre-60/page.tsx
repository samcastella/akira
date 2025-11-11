// src/app/programas/san-silvestre-60/page.tsx
'use client';

import ProgramCommunityDetail from '@/components/ProgramCommunityDetail';
import { resolveProgramDef } from '@/data/programs';

export default function SanSilvestrePage() {
  const def = resolveProgramDef('san-silvestre-60');
  if (!def) {
    return (
      <main className="container mx-auto px-4 py-8 text-sm text-neutral-600">
        Programa no encontrado.
      </main>
    );
  }

  // Adaptamos ProgramDef -> ProgramJson esperado por tu componente
  const program = {
    slug: def.slug,
    title: def.title,
    shortDescription: def.shortDescription,
    howItWorks: def.howItWorks,
    durationDays: def.durationDays ?? def.days?.length ?? 0,
    themeColor: def.themeColor,
    accordions: def.accordions,
    days: def.days,
  };

  return (
    <ProgramCommunityDetail
      slug="san-silvestre-60"
      imageSrc="/images/programs/san-silvestre-hero.jpg"
      title={def.title}
      program={program}
    />
  );
}
