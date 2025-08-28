'use client';
import React from 'react';
import { NAV_HEIGHT } from '@/lib/constants';

export default function SafeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4"
         style={{ paddingBottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}>
      {children}
    </div>
  );
}
