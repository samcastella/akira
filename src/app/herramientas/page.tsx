'use client';

import Link from 'next/link';
import {
  Notebook, Heart, Activity as ActivityIcon, Utensils, Dumbbell,
  Target, BookOpen, ChevronRight
} from 'lucide-react';

const TOOLS = [
  { slug: 'notas', label: 'Mis notas', Icon: Notebook },
  { slug: 'gratitud', label: 'Diario de gratitud', Icon: Heart },
  { slug: 'conductas', label: 'Registro de conductas', Icon: ActivityIcon },
  { slug: 'comidas', label: 'Registro de comidas', Icon: Utensils },
  { slug: 'ejercicio', label: 'Registro de ejercicio', Icon: Dumbbell },
  { slug: 'objetivos', label: 'Objetivos para hoy', Icon: Target },
  { slug: 'libros', label: 'Mis libros', Icon: BookOpen },
] as const;

export default function HerramientasListPage() {
  return (
    <main className="container mx-auto px-4 py-6">
      <h2 className="page-title">Herramientas</h2>
      <p className="muted mb-4">Tu caja de herramientas: simple, clara y directa.</p>

      <div role="list" aria-label="Lista de herramientas" className="rounded-2xl border overflow-hidden">
        {TOOLS.map(t => (
          <Link
            key={t.slug}
            role="listitem"
            href={`/herramientas/${t.slug}`}
            className="flex items-center justify-between p-4 hover:bg-neutral-50 focus:bg-neutral-50 outline-none"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border">
                <t.Icon className="h-5 w-5" />
              </span>
              <span className="text-[15px]">{t.label}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-400" />
          </Link>
        ))}
      </div>
    </main>
  );
}
