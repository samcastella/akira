// src/components/mizona/TodayWheel.tsx
'use client';

export default function TodayWheel({ value, label }: { value: number; label: string }) {
  const size = 160;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className="relative w-[160px] h-[160px]">
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke="#f59e0b" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-extrabold tabular-nums">{value}%</div>
          <div className="text-xs text-neutral-600">{label}</div>
        </div>
      </div>
    </div>
  );
}
