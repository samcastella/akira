'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import SubHeaderTabs from '@/components/nav/SubHeaderTabs';

import {
  PROGRAMS,
  AVAILABLE_PROGRAM_SLUGS,
  toIndexCard,
  type ThematicCategory,
} from '@/data/programs';
import { loadActive } from '@/lib/programsLocal';

/* =========================== Tipos base =========================== */

type ProgramType = 'good' | 'bad';
type Category = ThematicCategory;

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string;
  days: number;
  type: ProgramType;
  categories: Category[];
  thumbnail?: string;
};

const LS_SAVED = 'akira_saved_programs_v1';
const ALL_PROGRAMS: Program[] = PROGRAMS.map(toIndexCard) as Program[];
const EXISTING_PROGRAMS: Program[] = ALL_PROGRAMS.filter((p) =>
  AVAILABLE_PROGRAM_SLUGS.has(p.slug)
);

/* =========================== LS utils =========================== */

function loadSaved(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_SAVED) || '[]'));
  } catch {
    return new Set();
  }
}

function saveSaved(setIds: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_SAVED, JSON.stringify(Array.from(setIds)));
}

function loadActiveCount(): number {
  if (typeof window === 'undefined') return 0;
  const store = loadActive();
  return store && typeof store === 'object' ? Object.keys(store).length : 0;
}

/* =========================== Config categorías =========================== */

const CATEGORY_CONFIG: Record<
  Category,
  { title: string; subtitle: string; hero: string }
> = {
  salud: {
    title: 'Salud',
    subtitle: 'Programas pensados para mejorar tu salud física y mental.',
    hero: '/images/cat/health.jpg',
  },
  bienestar: {
    title: 'Bienestar',
    subtitle: 'Rutinas suaves para cuidarte y sentirte mejor cada día.',
    hero: '/images/cat/wellbeing.jpg',
  },
  productividad: {
    title: 'Productividad',
    subtitle:
      'Programas para enfocarte mejor, organizarte y aprovechar tu energía.',
    hero: '/images/cat/productivity.jpg',
  },
  'malos-habitos': {
    title: 'Malos hábitos',
    subtitle:
      'Programas amables para dejar atrás lo que ya no te suma en tu vida.',
    hero: '/images/cat/badhabits.jpg',
  },
};

/* =========================== UI: ProgramCard =========================== */

function ProgramCard({
  program,
  saved,
  onToggleSave,
}: {
  program: Program;
  saved: boolean;
  onToggleSave: (id: string) => void;
}) {
  const isAvailable = AVAILABLE_PROGRAM_SLUGS.has(program.slug);
  const href = isAvailable ? `/programas/${program.slug}` : '/404';

  return (
    <Link href={href} className="w-full flex items-start gap-3 py-3">
      {/* Miniatura */}
      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-neutral-100">
        {program.thumbnail ? (
          <Image
            src={program.thumbnail}
            alt={program.title}
            width={128}
            height={128}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <h4 className="text-[15px] font-semibold leading-snug">
          {program.title}
        </h4>
        <p className="text-[13px] text-neutral-500 mt-1 leading-snug line-clamp-2">
          {program.description}
        </p>
        <p className="text-[12px] text-neutral-400 mt-2">
          {program.days} días ·{' '}
          {program.type === 'good'
            ? 'Buen hábito'
            : 'Trabaja un mal hábito'}
        </p>
      </div>

      {/* Guardar */}
      <button
        type="button"
        aria-label={saved ? 'Quitar de guardados' : 'Guardar programa'}
        onClick={(e) => {
          e.preventDefault();
          onToggleSave(program.id);
        }}
        className="p-2 rounded-full hover:bg-neutral-100 active:scale-95 transition"
      >
        {saved ? (
          <BookmarkCheck className="w-5 h-5" />
        ) : (
          <Bookmark className="w-5 h-5" />
        )}
      </button>
    </Link>
  );
}

/* =========================== Página categoría =========================== */

type PageProps = {
  params: { slug: string };
};

export default function ProgramCategoryPage({ params }: PageProps) {
  const slug = params.slug as Category;

  if (!(slug in CATEGORY_CONFIG)) {
    // slug desconocido -> 404
    notFound();
  }

  const config = CATEGORY_CONFIG[slug];

  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [activeCount, setActiveCount] = useState<number>(0);

  useEffect(() => {
    setSaved(loadSaved());
    setActiveCount(loadActiveCount());
  }, []);

  const programsInCategory = useMemo(
    () =>
      EXISTING_PROGRAMS.filter((p) =>
        p.categories.includes(slug)
      ),
    [slug]
  );

  const toggleSave = (id: string) => {
    const next = new Set(saved);
    next.has(id) ? next.delete(id) : next.add(id);
    setSaved(next);
    saveSaved(next);
  };

  return (
    <div className="bg-white">
      {/* Submenú compacto (igual que en Programas) */}
      <SubHeaderTabs
        size="compact"
        tabs={[
          { href: '/programas', label: 'Programas' },
          { href: '/herramientas', label: 'Herramientas' },
          { href: '/programas/crear', label: 'Crear programa' },
        ]}
      />

      {/* Hero por categoría */}
      <div className="w-full overflow-hidden">
        <Image
          src={config.hero}
          alt={config.title}
          width={1920}
          height={640}
          className="w-full h-40 md:h-56 object-cover"
          priority={false}
        />
      </div>

      <div className="px-4 pb-28 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          {config.title}
        </h1>
        <p className="text-sm text-neutral-500 mb-2">
          {config.subtitle}
        </p>
        <p className="text-xs text-neutral-400 mb-4">
          {programsInCategory.length} programas · {activeCount} activos ahora mismo
        </p>

        {/* Lista tipo “Ideales para runners” */}
        <div className="divide-y divide-neutral-100">
          {programsInCategory.length === 0 ? (
            <p className="text-sm text-neutral-500 py-4">
              Todavía no hay programas en esta categoría. Muy pronto habrá novedades.
            </p>
          ) : (
            programsInCategory.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                saved={saved.has(p.id)}
                onToggleSave={toggleSave}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
