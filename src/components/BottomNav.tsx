'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_HEIGHT } from '@/lib/constants';
import {
  HomeIcon as HomeSolid,
  PlayCircleIcon as PlaySolid,
  ChartBarIcon as ChartBarSolid,
  UsersIcon as UsersSolid,
} from '@heroicons/react/24/solid';
import {
  HomeIcon as HomeOutline,
  PlayCircleIcon as PlayOutline,
  ChartBarIcon as ChartBarOutline,
  UsersIcon as UsersOutline,
} from '@heroicons/react/24/outline';

type Item = {
  href: string;
  label: string;
  outline: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  solid: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export default function BottomNav() {
  const pathname = usePathname();

  const items: Item[] = [
    { href: '/',          label: 'Home',         outline: HomeOutline,     solid: HomeSolid },
    { href: '/programas', label: 'Programas',    outline: PlayOutline,     solid: PlaySolid },
    { href: '/mizona',    label: 'Mi actividad', outline: ChartBarOutline, solid: ChartBarSolid },
    { href: '/amigos',    label: 'Comunidad',    outline: UsersOutline,    solid: UsersSolid },
  ];

  const INACTIVE = 'text-gray-500';
  const ACTIVE = 'text-black';

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && (pathname?.startsWith(href + '/') ?? false));

  return (
    <nav
      aria-label="Navegación inferior"
      role="navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t"
      style={{
        // Altura fija (sin safe-area). El espacio real se reserva en LayoutClient
        height: `${NAV_HEIGHT}px`,
        borderColor: 'var(--line)',
        // Estabiliza en iOS / evita repintados raros
        transform: 'translateZ(0)',
        contain: 'paint',
        willChange: 'transform',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        pointerEvents: 'auto',
      }}
      // Bloquea cualquier tap-through al contenido inferior
      onPointerDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
      onClickCapture={(e) => e.stopPropagation()}
    >
      <ul
        className="mx-auto flex h-full w-full max-w-md items-stretch justify-between px-4"
        // Safe area solo como padding interno (no cambia la altura)
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {items.map(({ href, label, outline: Outline, solid: Solid }) => {
          const active = isActive(href);
          const Icon = active ? Solid : Outline;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch={false} // evita primer click a rutas prefetcheadas (p.ej. detox)
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
                  aria-hidden="true"
                />
                <span className="text-[12px] leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
