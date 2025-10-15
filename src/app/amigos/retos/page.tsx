'use client';

import Link from 'next/link';
import { ChevronRight, PlusSquare, UsersRound, KeySquare } from 'lucide-react';

type RowProps = {
  href: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
};

function ListRow({ href, title, desc, Icon }: RowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 py-4 group"
      style={{ borderColor: 'var(--line)' }}
    >
      {/* Icono circular */}
      <div
        className="h-12 w-12 rounded-full border flex items-center justify-center shrink-0"
        style={{ borderColor: 'var(--line)' }}
      >
        <Icon className="h-6 w-6" />
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{title}</div>
        <div className="text-xs muted mt-1 truncate">{desc}</div>
      </div>

      {/* Chevron */}
      <ChevronRight className="h-5 w-5 opacity-60 group-hover:opacity-100 transition" />
    </Link>
  );
}

export default function RetosIndex() {
  return (
    <main className="container mx-auto px-4">
      {/* Lista */}
      <nav
        className="divide-y"
        style={{ borderColor: 'var(--line)' }}
      >
        <ListRow
          href="/amigos/retos/crear"
          title="Crear reto"
          desc="Diseña un reto y compártelo con un código."
          Icon={PlusSquare}
        />
        <ListRow
          href="/amigos/retos/unirse"
          title="Unirse con código"
          desc="Pega el código que te han compartido."
          Icon={KeySquare}
        />
        <ListRow
          href="/amigos/retos/mis-retos"
          title="Retos con amigos"
          desc="Consulta y edita tus retos activos."
          Icon={UsersRound}
        />
      </nav>
    </main>
  );
}
