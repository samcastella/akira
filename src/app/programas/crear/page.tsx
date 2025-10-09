'use client';

import SubHeaderTabs from '@/components/nav/SubHeaderTabs';

export default function CrearProgramaPage() {
  return (
    <div className="bg-white">
      <SubHeaderTabs
        tabs={[
          { href: '/programas', label: 'Programas' },
          { href: '/programas/herramientas', label: 'Herramientas' },
          { href: '/programas/crear', label: 'Crear programa' },
        ]}
      />
      <main className="container mx-auto px-4 py-6">
        <h2 className="page-title">Crear programa</h2>
        <p className="muted">Próximamente: asistente para crear tu programa paso a paso.</p>
      </main>
    </div>
  );
}
