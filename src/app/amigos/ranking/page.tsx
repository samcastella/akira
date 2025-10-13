'use client';
export default function RankingPage() {
  return (
    <div className="text-sm">
      <div className="mb-2 font-semibold">Ranking mensual</div>
      <p className="text-xs muted">Aquí mostraremos 5 por encima y 5 por debajo de tu posición, con botón para ver top 1000.</p>
      <button className="btn mt-3">Ver ranking</button>
    </div>
  );
}