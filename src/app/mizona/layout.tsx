// src/app/mizona/layout.tsx
'use client';

import React from 'react';
import SubHeaderTabs from '@/components/SubHeaderTabs';

const TABS = [
  { href: '/mizona/resumen', label: 'Resumen', exact: true },
  { href: '/mizona/checks', label: 'Checks del día' },
  { href: '/mizona/estadisticas', label: 'Estadísticas' },
];

export default function MiZonaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Subheader sticky con el MISMO estilo que /amigos */}
      <div className="sticky top-0 z-20 bg-white border-b">
        <SubHeaderTabs tabs={TABS as any} size="compact" ariaLabel="Submenú Mi zona" />
      </div>

      {/* Contenido con aire lateral consistente */}
      <div className="px-4 pt-2 pb-4">
        {children}
      </div>
    </div>
  );
}
