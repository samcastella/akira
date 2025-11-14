'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import SubHeaderTabs from '@/components/nav/SubHeaderTabs';

import {
  PROGRAMS,
  AVAILABLE_PROGRAM_SLUGS,
  toIndexCard,
  type ThematicCategory,
} from '@/data/programs';
import { loadActive } from '@/lib/programsLocal';

/* ===== Tipos ===== */
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

/* ===== LS utils ===== */
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

/* ===== UI: ProgramCard ===== */
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

      <div className="flex-1 min-w-0">
        <h4 className="text-[15px] font-semibold leading-snug">{program.title}</h4>
        <p className="text-[13px] text-neutral-500 mt-1 leading-snug line-clamp-2">
          {program.description}
        </p>
        <p className="text-[12px] text-neutral-400 mt-2">
          {program.days} días ·{' '}
          {program.type === 'good' ? 'Buen hábito' : 'Trabaja un mal hábito'}
        </p>
      </div>

      <button
        type="button"
        aria-label={saved ? 'Quitar de guardados' : 'Guardar programa'}
        onClick={(e) => {
          e.preventDefault();
          onToggleSave(program.id);
        }}
        className="p-2 rounded-full hover:bg-neutral-100 active:scale-95 transition"
      >
        {saved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
      </button>
    </Link>
  );
}

/* ===== Página ===== */
export default function TodosProgramasPage() {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [activeCount, setActiveCount] = useState<number>(0);

  useEffect(() => {
    setSaved(loadSaved());
    setActiveCount(loadActiveCount());
  }, []);

  const existingPrograms = useMemo(() => EXISTING_PROGRAMS, []);
  const toggleSave = (id: string) => {
    const next = new Set(saved);
    next.has(id) ? next.delete(id) : next.add(id);
    setSaved(next);
    saveSaved(next);
  };

  return (
    <div className="bg-white">
      <SubHeaderTabs
        size="compact"
        tabs={[
          { href: '/programas', label: 'Programas' },
          { href: '/herramientas', label: 'Herramientas' },
          { href: '/programas/crear', label: 'Crear programa' },
        ]}
      />

      <div className="px-4 pb-28 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">
          Todos los programas
        </h1>
        <p className="text-sm text-neutral-500 mb-1">
          Explora todos los programas disponibles en Akira.
        </p>
        <p className="text-xs text-neutral-400 mb-4">
          {existingPrograms.length} programas en total · {activeCount} activos ahora mismo
        </p>

        <div className="divide-y divide-neutral-100">
          {existingPrograms.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              saved={saved.has(p.id)}
              onToggleSave={toggleSave}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
