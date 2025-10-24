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
  const pathname = (usePathname() ?? '').replace(/\/+$/, '') || '/'; // sin barra final
  const hCls = size === 'compact' ? 'h-10' : 'h-11';
  const txt = size === 'compact' ? 'text-[13px]' : 'text-sm';

  // --- Single-active por "longest prefix" ---
  // Normaliza hrefs (sin barra final) y calcula el que mejor encaja con el pathname.
  const normTabs = tabs.map(t => ({ ...t, nhref: (t.href.replace(/\/+$/, '') || '/') }));

  // Candidato: debe ser prefijo del pathname (o exacto). Para '/amigos' pedimos exacto.
  const candidates = normTabs.filter(t => {
    if (t.nhref === '/amigos') return pathname === '/amigos';
    return pathname === t.nhref || pathname.startsWith(t.nhref + '/');
  });

  // Elegimos el de href más largo (el más específico). Si no hay ninguno, ninguno activo.
  const activeHref =
    candidates.sort((a, b) => b.nhref.length - a.nhref.length)[0]?.nhref ?? '__none__';

  return (
    <div className="bg-white border-b" role="navigation" aria-label="Submenú de Comunidad">
      <div className="container mx-auto px-4">
        <nav className={`flex gap-5 ${hCls} items-center`}>
          {normTabs.map((t) => {
            const active = t.nhref === activeHref;
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
