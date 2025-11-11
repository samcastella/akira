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

  // Cabeza de la barra (ángulo desde -90º + progreso)
  const theta = (-90 + (pct / 100) * 360) * (Math.PI / 180);
  const cx = size / 2;
  const cy = size / 2;
  const headX = cx + r * Math.cos(theta);
  const headY = cy + r * Math.sin(theta);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Pista */}
        <circle cx={cx} cy={cy} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        {/* Progreso */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#f59e0b"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>

      {/* Fuego en la cabeza del progreso */}
      <div
        aria-hidden
        className="absolute z-[2] pointer-events-none select-none"
        style={{
          left: headX,
          top: headY,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span className="text-2xl">🔥</span>
      </div>

      {/* Contenido centrado */}
      <div className="absolute inset-0 flex items-center justify-center z-[1]">
        <div className="text-center leading-tight">
          <div className="text-[10px] tracking-[0.12em] text-neutral-500">{title}</div>
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
