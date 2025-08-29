'use client';

import MiZona from '@/components/MiZona';

export default function MiZonaPage() {
  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h2 className="page-title">Mi zona</h2>

      {/* Panel blanco, ancho completo dentro del container, SIN borde */}
      <section
        style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-card)',
          padding: 18,
          border: 'none',
        }}
      >
        <MiZona />
      </section>
    </main>
  );
}
