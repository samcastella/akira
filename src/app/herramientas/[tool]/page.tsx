'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';

// Componentes
import NotasTool from '@/components/tools/NotasTool';
import GratitudTool from '@/components/tools/GratitudTool';
import ConductasTool from '@/components/tools/ConductasTool';
import ComidasTool from '@/components/tools/ComidasTool';
import ExerciseLog from '@/components/ExerciseLog';
import GoalsTool from '@/components/tools/GoalsTool';
import BooksTool from '@/components/tools/BooksTool';
import BloqueoToolPage from '@/app/herramientas/bloqueo/page'; // nuevo import directo

const MAP: Record<string, { label: string; Render: React.ComponentType }> = {
  notas:      { label: 'Mis notas',             Render: NotasTool },
  gratitud:   { label: 'Diario de gratitud',    Render: GratitudTool },
  conductas:  { label: 'Registro de conductas', Render: ConductasTool },
  comidas:    { label: 'Registro de comidas',   Render: ComidasTool },
  ejercicio:  { label: 'Registro de ejercicio', Render: ExerciseLog },
  objetivos:  { label: 'Objetivos para hoy',    Render: GoalsTool },
  libros:     { label: 'Mis libros',            Render: BooksTool },

  // ⚙️ Configurador de límites
  'detox-config': {
    label: 'Configurador de límites',
    Render: function RedirectDetoxConfig() {
      if (typeof window !== 'undefined') {
        window.location.href = '/programas/detox-tecnologico-30/configurar';
      }
      return (
        <div className="p-4 text-sm text-neutral-600">
          Redirigiendo al configurador de límites…
        </div>
      );
    },
  },

  // 🔒 Bloqueo de uso
  bloqueo: {
    label: 'Bloqueo de uso',
    Render: BloqueoToolPage,
  },
};

export default function ToolPage({ params }: { params: { tool: string } }) {
  const entry = MAP[params.tool];
  if (!entry) return notFound();

  const { label, Render } = entry;

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="mb-4">
        <Link
          href="/herramientas"
          className="text-sm inline-flex items-center gap-2 hover:underline"
        >
          ← Volver
        </Link>
      </div>
      <h2 className="page-title">{label}</h2>
      <section className="card mt-3">
        <Render />
      </section>
    </main>
  );
}
