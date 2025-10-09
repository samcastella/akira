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
    { href: '/',          label: 'Home',         icon: Home },
    { href: '/programas', label: 'Programas',    icon: SquarePlay }, // antes Hábitos
    { href: '/mizona',    label: 'Mi actividad', icon: BarChart3 },  // antes Mi zona
    { href: '/amigos',    label: 'Comunidad',    icon: Users },      // antes Mis amigos
  ];

  const INACTIVE = 'text-gray-500';
  const ACTIVE = 'text-black';

  // helper para marcar activo en rutas hijas
  const isActive = (href: string) =>
    pathname === href ||
    (href !== '/' && (pathname?.startsWith(href + '/') ?? false));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
      style={{ height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom,0px))` }}
      aria-label="Navegación inferior"
    >
      <ul className="mx-auto flex h-full w-full max-w-md items-stretch justify-between px-4 pb-[env(safe-area-inset-bottom,0px)]">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
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
                <Icon
                  className={[
                    'h-6 w-6 transition-transform duration-150',
                    active ? 'scale-105' : 'scale-100',
                  ].join(' ')}
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
