'use client';

import SubHeaderTabs from '@/components/nav/SubHeaderTabs';
import Link from 'next/link';
import {
  Notebook, Heart, Activity as ActivityIcon, Utensils, Dumbbell,
  Target, BookOpen, ChevronRight
} from 'lucide-react';

type ToolItem = {
  slug: string;
  label: string;
  Icon: React.ComponentType<any>;
  href?: string; // opcional: permite rutas personalizadas
};

const TOOLS: readonly ToolItem[] = [
  { slug: 'notas', label: 'Mis notas', Icon: Notebook },
  { slug: 'gratitud', label: 'Diario de gratitud', Icon: Heart },
  { slug: 'conductas', label: 'Registro de conductas', Icon: ActivityIcon },
  { slug: 'comidas', label: 'Registro de comidas', Icon: Utensils },
  { slug: 'ejercicio', label: 'Registro de ejercicio', Icon: Dumbbell },
  { slug: 'objetivos', label: 'Objetivos para hoy', Icon: Target },
  { slug: 'libros', label: 'Mis libros', Icon: BookOpen },

  // 🔥 Acceso directo al configurador del Détox Tecnológico
  {
    slug: 'detox-config',
    label: 'Configurar límites (Détox Tecnológico)',
    Icon: Target,
    href: '/programas/detox-tecnologico-30/configurar',
  },
] as const;

export default function HerramientasDentroDeHabitos() {
  return (
    <div className="bg-white">
      <SubHeaderTabs
        tabs={[
          { href: '/programas', label: 'Programas' },
          { href: '/herramientas', label: 'Herramientas' },
          { href: '/habitos/crear', label: 'Crear programa' },
        ]}
      />

      <main className="container mx-auto px-4 py-6">
        <h2 className="page-title">Herramientas</h2>
        <p className="muted mb-4">Tu caja de herramientas: simple, clara y directa.</p>

        <nav role="list" aria-label="Lista de herramientas">
          {TOOLS.map((t, i) => {
            const href = t.href ?? `/herramientas/${t.slug}`;
            const isLast = i === TOOLS.length - 1;
            return (
              <Link
                key={t.slug}
                role="listitem"
                href={href}
                className="flex items-center justify-between py-4 focus:bg-neutral-50 hover:bg-neutral-50 outline-none"
                style={{ borderBottom: isLast ? 'none' : '1px solid var(--line)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border" aria-hidden>
                    <t.Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[15px]">{t.label}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-400" aria-hidden />
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
