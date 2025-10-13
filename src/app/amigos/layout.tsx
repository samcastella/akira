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
      {/* sticky arriba como en Programas, con subrayado minimalista */}
      <div className="sticky top-0 z-20 bg-white border-b">
        <SubHeaderTabs tabs={TABS} size="compact" />
      </div>

      <div className="container mx-auto px-4 py-4">
        {children}
      </div>
    </div>
  );
}
