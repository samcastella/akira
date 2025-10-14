// src/app/amigos/layout.tsx
'use client';

import React from 'react';
import SubHeaderTabs from '@/components/SubHeaderTabs';

const TABS = [
  { href: '/amigos', label: 'Comunidad' },
  { href: '/amigos/retos', label: 'Retos' },
  { href: '/amigos/mis-amigos', label: 'Mis amigos' },
  { href: '/amigos/ranking', label: 'Rankings' },
];

export default function AmigosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="sticky top-0 z-20 bg-white border-b">
        <SubHeaderTabs tabs={TABS} size="compact" />
      </div>

      {/* Sin container ni px-4 para permitir secciones a sangre */}
      <div className="pb-4">
        {children}
      </div>
    </div>
  );
}
