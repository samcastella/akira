'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string };

export default function SubHeaderTabs({
  tabs,
  size = 'compact',
}: {
  tabs: Tab[];
  size?: 'compact' | 'default';
}) {
  const pathname = usePathname() ?? '';
  const hCls = size === 'compact' ? 'h-10' : 'h-11';
  const txt = size === 'compact' ? 'text-[13px]' : 'text-sm';

  // Activo: para '/amigos' exige coincidencia EXACTA; para el resto, exacta o subruta
  const isActive = (href: string) => {
    if (href === '/amigos') {
      return pathname === '/amigos' || pathname === '/amigos/';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="bg-white border-b" role="navigation" aria-label="Submenú de Comunidad">
      <div className="container mx-auto px-4">
        <nav className={`flex gap-5 ${hCls} items-center`}>
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`group ${txt} relative inline-flex items-center px-1.5 py-0.5 text-neutral-600 hover:text-black transition`}
                aria-current={active ? 'page' : undefined}
              >
                <span className={active ? 'font-semibold text-black' : ''}>{t.label}</span>

                {/* subrayado corto y fino */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-[2px] h-px rounded transition-all duration-200
                    ${active ? 'w-6 bg-black opacity-100' : 'w-0 bg-black/80 opacity-0 group-hover:opacity-100'}
                  `}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
