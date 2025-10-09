'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, SquarePlay, BarChart3, Users } from 'lucide-react';
import { NAV_HEIGHT } from '@/lib/constants';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export default function BottomNav() {
  const pathname = usePathname();

  const items: Item[] = [
    { href: '/',            label: 'Home',        icon: Home },
    { href: '/programas',   label: 'Programas',   icon: SquarePlay },   // (antes Hábitos)
    { href: '/mi-actividad',label: 'Mi actividad',icon: BarChart3 },
    { href: '/community',   label: 'Comunidad',   icon: Users },
  ];

  // gris medio para inactivos
  const INACTIVE = 'text-gray-500';
  const ACTIVE = 'text-black';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
      style={{ height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom,0px))` }}
      aria-label="Navegación inferior"
    >
      <ul className="mx-auto flex h-full w-full max-w-md items-stretch justify-between px-4 pb-[env(safe-area-inset-bottom,0px)]">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== '/' && pathname?.startsWith(href));

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'group flex h-full flex-col items-center justify-center gap-1',
                  active ? ACTIVE : INACTIVE,
                ].join(' ')}
              >
                {/* Icono limpio y minimalista */}
                <Icon
                  className={[
                    'h-6 w-6 transition-transform duration-150',
                    active ? 'scale-105' : 'scale-100',
                  ].join(' ')}
                  // Nota: lucide es “stroke”. Para sensación de “relleno” visual,
                  // mantenemos color negro en activo y gris en inactivo.
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="text-[12px] leading-none">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
