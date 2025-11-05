// src/components/mizona/TodayWheel.tsx
'use client';

type Props = {
  /** Porcentaje 0..100 */
  value: number;
  /** Texto pequeño bajo el porcentaje (centro) */
  label: string;
};

export default function TodayWheel({ value, label }: Props) {
  // Tamaños fijos según tu diseño actual
  const size = 160;
  const stroke = 12;

  // Cálculos geométricos
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // Aseguramos 0..100 y números enteros para evitar jitter
  const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  const off = c * (1 - pct / 100);

  return (
    <div
      className="relative w-[160px] h-[160px] select-none"
      role="img"
      aria-label={`${pct}% ${label}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        {/* pista */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />
        {/* progreso */}
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
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>

      {/* Centro */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center leading-tight">
          <div className="text-2xl font-extrabold tabular-nums">{pct}%</div>
          <div className="text-xs text-neutral-600">{label}</div>
        </div>
      </div>
    </div>
  );
}
