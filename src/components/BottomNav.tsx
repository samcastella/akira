'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, User, GraduationCap, Users } from 'lucide-react';
import { COLORS, NAV_HEIGHT } from '@/lib/constants';

export default function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/habitos', label: 'Hábitos', icon: ListChecks },
    { href: '/mizona', label: 'Mi zona', icon: User },
    { href: '/herramientas', label: 'Herramientas', icon: GraduationCap },
    { href: '/amigos', label: 'Amigos', icon: Users },
  ] as const;

  return (
    <nav
      className="bottomnav"
      style={{
        // altura incluye el safe-area; SIN padding-bottom aquí
        height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: COLORS.accent, // amarillo
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;

          // estilo de la "píldora"
          const pillStyle: React.CSSProperties = active
            ? { background: '#fff', color: COLORS.text }
            : href === '/mizona'
            ? { background: COLORS.black, color: '#fff' } // Mi zona negra cuando no está activa
            : { background: 'transparent', color: COLORS.text };

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="bn-item"
            >
              <span className="bn-pill" style={pillStyle}>
                <Icon className="h-5 w-5" />
                <span className="mt-1 text-[12px] leading-none">{label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
