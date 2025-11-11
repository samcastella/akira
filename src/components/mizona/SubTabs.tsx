// src/components/mizona/SubTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SubTabs({ items }: { items: { label: string; href: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-white sticky top-[48px] z-10 -mt-px">
      <div className="flex gap-2 px-4 overflow-x-auto">
        {items.map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`relative py-3 px-3 text-sm whitespace-nowrap transition ${
                active
                  ? 'font-semibold text-black after:absolute after:left-0 after:right-0 after:-bottom-[1px] after:h-[2px] after:bg-black'
                  : 'text-neutral-500 hover:text-black'
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
