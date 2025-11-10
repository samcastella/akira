import ProgramDetail from '@/components/ProgramDetail';
import { resolveProgramDef, getBySlug } from '@/data/programs';
import { notFound } from 'next/navigation';

export default function Page() {
  // Datos normalizados del programa (tareas, texto, etc.)
  const def = resolveProgramDef('san-silvestre-60');
  if (!def) return notFound();

  // Metadatos (imagen hero, días, título corto, etc.)
  const meta = getBySlug('san-silvestre-60'); // devuelve ProgramMeta | undefined
  const hero = meta?.imageSrc ?? '/images/programs/san-silvestre-hero.jpg';

  return (
    <ProgramDetail
      slug="san-silvestre-60"
      imageSrc={hero}
      title={def.title}
      shortDescription={def.shortDescription ?? ''}
      howItWorks={def.howItWorks ?? ''}
    />
  );
}
