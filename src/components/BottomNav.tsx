// src/components/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, User, Settings, Users } from 'lucide-react';
import { COLORS, NAV_HEIGHT } from '@/lib/constants';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

const ITEMS: Item[] = [
  { href: '/',             label: 'Inicio',       icon: Home },
  { href: '/habitos',      label: 'Hábitos',      icon: ListChecks },
  { href: '/mizona',       label: 'Mi zona',      icon: User },
  { href: '/herramientas', label: 'Herramientas', icon: Settings }, // engranaje
  { href: '/amigos',       label: 'Amigos',       icon: Users },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className="bottomnav fixed inset-x-0 bottom-0 z-50"
      style={{
        height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: COLORS.accent, // rail amarillo
      }}
    >
      <ul className="mx-auto flex h-full w-full max-w-md">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="relative flex-1 h-full">
              {/* Fondo activo: rectángulo que ocupa TODO el botón */}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: COLORS.black, borderRadius: 0 }}
                />
              )}

              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="bn-item relative z-10 grid h-full w-full place-items-center"
              >
                <span className="flex h-full flex-col items-center justify-center gap-1">
                  <Icon
                    size={18}
                    className={active ? 'text-white' : 'text-black'}
                  />
                  <span
                    className={`text-[11px] font-medium leading-none ${
                      active ? 'text-white' : 'text-black'
                    }`}
                  >
                    {label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
