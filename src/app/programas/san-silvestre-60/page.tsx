// src/app/programas/san-silvestre-60/page.tsx
import ProgramCommunityDetail from '@/components/ProgramCommunityDetail';
import { resolveProgramDef } from '@/data/programs';

export const dynamic = 'force-static';

export default function Page() {
  const def = resolveProgramDef('san-silvestre-60');
  if (!def) {
    return (
      <main className="container mx-auto px-4 py-10 text-sm text-neutral-600">
        Programa no disponible.
      </main>
    );
  }

  return (
    <ProgramCommunityDetail
      slug="san-silvestre-60"
      imageSrc="/images/programs/san-silvestre-hero.jpg"
      title={def.title}
      program={{
        slug: def.slug,
        title: def.title,
        shortDescription: def.shortDescription,
        howItWorks: def.howItWorks,
        durationDays: def.durationDays,
        themeColor: def.themeColor,
        accordions: def.accordions,
        days: def.days as any,
      }}
    />
  );
}
