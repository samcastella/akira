'use client';

export default function AmigosPage() {
  return (
    <main className="container">
      <h2 style={{ margin: '8px 0 12px' }}>Amigos</h2>
      <p className="muted" style={{ margin: '0 0 16px' }}>
        Comparte retos y rachas con tu gente.
      </p>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Pronto</h3>
        <p className="muted" style={{ marginTop: 4 }}>
          Podrás invitar amigos, ver su progreso y celebrar rachas juntos.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn">Invitar amigos</button>
          <button className="btn ghost">Copiar enlace</button>
        </div>
      </section>
    </main>
  );
}
