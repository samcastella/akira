// src/components/mizona/TodayWheel.tsx
'use client';

export default function TodayWheel({
  value,
  title = 'ACTIVIDADES PARA HOY',
  totalDone = 0,
  totalGoal = 0,
  size = 260,
}: {
  value: number;
  title?: string;
  totalDone?: number;
  totalGoal?: number;
  size?: number;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const off = c * (1 - pct / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#f59e0b"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {/* Fuego en cabeza de la circunferencia */}
      <div
        aria-hidden
        className="absolute z-[1]"
        style={{
          left: '50%',
          top: 2,
          transform: 'translateX(-50%)',
        }}
      >
        <span className="select-none text-xl">🔥</span>
      </div>

      {/* Contenido centrado */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center leading-tight">
          <div className="text-[10px] tracking-[0.12em] text-neutral-500">{title}</div>
          {/* % en UNA sola línea */}
          <div className="mt-1 text-xl font-extrabold tabular-nums whitespace-nowrap">
            {pct}% completado
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            {totalDone}/{totalGoal} checks
          </div>
        </div>
      </div>
    </div>
  );
}
