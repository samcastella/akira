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
  ];

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30"
      style={{
        height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        background: COLORS.accent,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mx-auto grid h-full max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;

          // Estilo especial para "Mi zona" (negro cuando no está activo)
          let bg = isActive ? '#fff' : COLORS.accent;
          let fg = COLORS.text;
          if (href === '/mizona') {
            bg = isActive ? '#fff' : COLORS.black;
            fg = isActive ? COLORS.text : '#fff';
          }

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="flex h-full flex-col items-center justify-center transition-colors"
              style={{ background: bg, color: fg }}
            >
              <Icon className="h-6 w-6" />
              <span className="mt-1 text-[12px] leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
