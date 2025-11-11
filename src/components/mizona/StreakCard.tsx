// src/components/mizona/StreakCard.tsx
'use client';

import { useEffect, useRef } from 'react';

export default function StreakCard() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // confeti sencillo (sin lib) – discreto
    const el = host.current;
    if (!el) return;
    const piece = document.createElement('div');
    piece.style.position = 'absolute';
    piece.style.left = '10%';
    piece.style.top = '-8px';
    piece.style.width = '6px';
    piece.style.height = '10px';
    piece.style.background = '#16a34a';
    piece.style.opacity = '0.6';
    piece.style.transform = 'rotate(12deg)';
    piece.style.animation = 'fall 1.2s ease-out forwards';
    el.appendChild(piece);
    const css = document.createElement('style');
    css.textContent = '@keyframes fall{to{transform:translateY(26px) rotate(18deg);opacity:.0}}';
    el.appendChild(css);
    const t = setTimeout(()=>{ piece.remove(); css.remove(); }, 1400);
    return ()=> clearTimeout(t);
  }, []);

  // TODO: racha real desde DB. De momento demo estable (X días seguidos).
  const streakDays = 7;

  return (
    <div ref={host} className="rounded-2xl border border-green-200 bg-green-50 p-4 relative overflow-hidden">
      <div className="text-[15px] font-semibold text-green-800">¡Racha activa!</div>
      <div className="text-sm text-green-700 mt-1">{streakDays} días seguidos completando checks</div>
    </div>
  );
}
