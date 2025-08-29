'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { listPrograms } from '@/lib/programs_catalog'; // catálogo nuevo (no reemplaza tu motor legacy)

// Fallback visual de tus 4 cards antiguas (sección "Próximamente")
type HabitCardData = {
  key: string;
  title: string;
  subtitle: string;
  image: string; // ruta pública
};
const FALLBACK_FEATURED: HabitCardData[] = [
  { key: 'lectura',    title: 'La máquina lectora',  subtitle: 'Conviértete en un superlector',  image: '/reading.jpg' },
  { key: 'burpees',    title: 'Unos f*kn burpees',   subtitle: 'Comienza hoy y no pares',         image: '/burpees.jpg' },
  { key: 'finanzas',   title: 'Finanzas en orden',   subtitle: '30 días para tu dinero',          image: '/finanzas.jpg' },
  { key: 'meditacion', title: 'Meditación esencial', subtitle: 'Respira. 10 min diarios',         image: '/meditacion.jpg' },
];

export default function HabitosPage() {
  // Programas reales del catálogo (por ahora aparecerá Lectura 21d)
  const programs = useMemo(() => listPrograms(), []);

  return (
    <main className="container">
      {/* Destacados desde el catálogo */}
      <h2 style={{ margin: '8px 0 12px' }}>Programas destacados</h2>
      <div className="grid grid-2">
        {programs.map((p) => (
          <Link key={p.slug} href={`/habitos/${p.slug}`} className="card" aria-label={p.title}>
            {/* Para imágenes estáticas desde /public en móvil usamos <img src="/file.jpg" /> */}
            <img
              src={p.cover || '/placeholder.jpg'}
              alt={p.title}
              style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, border: '1px solid #eee' }}
            />
            <h3 style={{ margin: '10px 0 4px' }}>{p.title}</h3>
            <p style={{ margin: 0, color: '#666' }}>{p.subtitle ?? ''}</p>
          </Link>
        ))}
      </div>

      {/* Próximamente: conserva tus 4 cards antiguas sin enlace (hasta crear sus páginas /habitos/[slug]) */}
      <h2 style={{ margin: '20px 0 12px' }}>Próximamente</h2>
      <div className="grid grid-2">
        {FALLBACK_FEATURED.map((h) => (
          <article key={h.key} className="card" aria-label={`${h.title} (próximamente)`}>
            <img
              src={h.image}
              alt={h.title}
              style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12, border: '1px solid #eee', opacity: 0.9 }}
            />
            <h3 style={{ margin: '10px 0 4px' }}>{h.title}</h3>
            <p style={{ margin: 0, color: '#666' }}>{h.subtitle}</p>
            <span
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '4px 8px',
                borderRadius: 999,
                fontSize: 12,
                border: '1px solid #ddd',
                color: '#555',
                background: '#fafafa',
              }}
            >
              Próximamente
            </span>
          </article>
        ))}
      </div>
    </main>
  );
}
