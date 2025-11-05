// src/components/mizona/TodayWheel.tsx
'use client';

type Props = {
  value: number;                // 0..100
  title?: string;               // ej. "ACTIVIDADES PARA HOY"
  totalDone?: number;           // ej. 0
  totalGoal?: number;           // ej. 3
  size?: number;                // diámetro en px (default 240)
};

export default function TodayWheel({
  value,
  title = '',
  totalDone,
  totalGoal,
  size = 240,
}: Props) {
  const stroke = Math.round(size * 0.075); // proporcional
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const off = c * (1 - pct / 100);

  // Ángulo en radianes (parte visible empieza en -90º)
  const ang = ((pct / 100) * 360 - 90) * (Math.PI / 180);
  const cx = size / 2 + r * Math.cos(ang);
  const cy = size / 2 + r * Math.sin(ang);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Base */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progreso */}
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
        {/* Marcador 🔥 en la punta */}
        <g transform={`translate(${cx}, ${cy})`}>
          <circle r={Math.max(2, stroke * 0.18)} fill="white" />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontSize={Math.max(10, Math.round(stroke * 0.9))}
          >
            🔥
          </text>
        </g>
      </svg>

      {/* Contenidos centrados */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center leading-tight">
          {title ? (
            <div className="text-[11px] tracking-[0.12em] text-neutral-500">
              {title}
            </div>
          ) : null}
          <div className="mt-1 text-[32px] font-extrabold tabular-nums text-neutral-900">
            {pct}% completado
          </div>
          {typeof totalDone === 'number' && typeof totalGoal === 'number' ? (
            <div className="mt-1 text-sm text-neutral-500">
              {totalDone}/{totalGoal} checks
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
