'use client';

import Link from 'next/link';

const Card = ({ href, title, desc }: { href: string; title: string; desc: string }) => (
  <Link
    href={href}
    className="block rounded-2xl border p-4 hover:bg-black/5 transition"
    style={{ borderColor: 'var(--line)' }}
  >
    <div className="font-semibold">{title}</div>
    <div className="text-xs muted mt-1">{desc}</div>
  </Link>
);

export default function RetosIndex() {
  return (
    <main className="space-y-3">
      <Card href="/amigos/retos/crear" title="Crear reto" desc="Diseña un reto y compártelo con un código." />
      <Card href="/amigos/retos/unirse" title="Unirse con código" desc="Pega el código que te han compartido." />
      <Card href="/amigos/retos/mis-retos" title="Retos con amigos" desc="Consulta y edita tus retos activos." />
    </main>
  );
}
