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
  const pathname = usePathname() ?? ''; // seguro
  const hCls = size === 'compact' ? 'h-10' : 'h-11';
  const txt = size === 'compact' ? 'text-[13px]' : 'text-sm';

  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
      <div className="container mx-auto px-4">
        <nav className={`flex gap-5 ${hCls} items-center`}>
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`${txt} relative inline-flex items-center px-1.5 py-0.5 text-neutral-600 hover:text-black transition`}
              >
                <span className={active ? 'font-semibold text-black' : ''}>
                  {t.label}
                </span>

                {/* subrayado minimalista (corto y fino) */}
                <span
                  aria-hidden
                  className={`absolute left-1/2 -translate-x-1/2 bottom-0 h-px rounded
                    transition-all duration-200
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
