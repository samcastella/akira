'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string };

export default function SubHeaderTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
      <div className="container mx-auto px-4">
        <nav className="flex gap-4 h-11 items-center">
          {tabs.map(t => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`text-sm px-2 py-1 rounded-md border-b-2 transition ${
                  active ? 'border-black font-semibold' : 'border-transparent text-neutral-500 hover:text-black'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
