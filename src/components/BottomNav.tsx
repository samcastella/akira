'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, User, Settings, Users } from 'lucide-react';
import { COLORS, NAV_HEIGHT } from '@/lib/constants';

export default function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/habitos', label: 'Hábitos', icon: ListChecks },
    { href: '/mizona', label: 'Mi zona', icon: User },
    { href: '/herramientas', label: 'Herramientas', icon: Settings }, // engranaje
    { href: '/amigos', label: 'Amigos', icon: Users },
  ] as const;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className="bottomnav"
      style={{
        height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: COLORS.accent, // amarillo rail
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="bn-item relative grid h-full w-full flex-1 place-items-center"
            >
              {/* Fondo activo: cuadrado, ocupa todo el botón */}
              {active && (
                <span
                  aria-hidden
                  className="bn-pill absolute inset-0 rounded-none"
                  style={{ background: COLORS.black }}
                />
              )}

              {/* Contenido */}
              <span className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  className="h-[18px] w-[18px]"
                  style={{ color: active ? '#fff' : COLORS.text }}
                />
                <span
                  className="leading-none text-[11px] font-medium"
                  style={{ color: active ? '#fff' : COLORS.text }}
                >
                  {label}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
