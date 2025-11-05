// src/app/mizona/layout.tsx
'use client';

import type { ReactNode } from 'react';
import SubTabs from '@/components/mizona/SubTabs';

export default function MiZonaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen pb-24">
      <SubTabs
        items={[
          { label: 'Resumen', href: '/mizona/resumen' },
          { label: 'Checks del día', href: '/mizona/checks' },
          { label: 'Estadísticas', href: '/mizona/estadisticas' },
        ]}
      />
      <div className="px-4">{children}</div>
    </div>
  );
}
