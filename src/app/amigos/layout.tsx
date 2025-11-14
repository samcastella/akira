'use client';

import React from 'react';
import SubHeaderTabs from '@/components/SubHeaderTabs';

const TABS = [
  { href: '/amigos', label: 'Comunidad', exact: true },
  { href: '/amigos/retos', label: 'Retos' },
  { href: '/amigos/mis-amigos', label: 'Mis amigos' },
  { href: '/amigos/rankings', label: 'Rankings' },
  { href: '/amigos/articulos', label: 'Artículos' }, // 🆕 ahora es la quinta posición
];

export default function AmigosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="sticky top-0 z-20 bg-white border-b">
        <SubHeaderTabs tabs={TABS} size="compact" ariaLabel="Submenú de Comunidad" />
      </div>
      <div className="pb-4">{children}</div>
    </div>
  );
}
