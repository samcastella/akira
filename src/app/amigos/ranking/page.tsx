'use client';

import React from 'react';

const mockAroundYou = Array.from({ length: 11 }).map((_, i) => ({
  pos: 120 + (i - 5),
  user: i === 5 ? 'tú' : `usuario_${120 + (i - 5)}`,
  puntos: 1000 - Math.abs(i - 5) * 3,
}));

export default function RankingPage() {
  return (
    <main className="space-y-3">
      <h2 className="page-title">Ranking mensual</h2>

      <section className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--line)' }}>
        <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
          {mockAroundYou.map((r) => (
            <li key={r.pos} className="py-2 flex items-center justify-between">
              <span className="text-xs tabular-nums w-12">#{r.pos}</span>
              <span className={`flex-1 ${r.user === 'tú' ? 'font-semibold' : ''}`}>{r.user}</span>
              <span className="text-xs tabular-nums">{r.puntos} pts</span>
            </li>
          ))}
        </ul>
        <button className="btn mt-3 w-full">Ver ranking</button>
      </section>
    </main>
  );
}
