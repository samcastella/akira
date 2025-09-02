// app/LayoutClient.tsx
'use client';

import { usePathname } from 'next/navigation';
import ClientGuard from './ClientGuard';

const HIDE_NAV_PATHS = new Set<string>(['/registro', '/bienvenida']);

export default function LayoutClient({ children, bottomNav }: { children: React.ReactNode; bottomNav: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PATHS.has(pathname);

  return (
    <>
      {/* Redirección a /registro si no hay usuario */}
      <ClientGuard />

      {/* Wrapper con/ sin padding inferior según página */}
      <div
        className="bg-[#FAFAFA]"
        style={{
          minHeight: '100svh',
          paddingBottom: hideNav ? 0 : 'calc(88px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Contenedor centrado tipo móvil */}
        <div className="mx-auto w-full max-w-md">
          {children}
        </div>
      </div>

      {/* BottomNav visible salvo en registro/bienvenida */}
      {!hideNav && bottomNav}
    </>
  );
}
