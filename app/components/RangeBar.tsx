interface Props {
  low: number;
  high: number;
  current: number;
}

export default function RangeBar({ low, high, current }: Props) {
  const range = high - low;
  if (!Number.isFinite(low) || !Number.isFinite(high) || range <= 0) return null;
  const clamped = Math.max(low, Math.min(high, current));
  const positionPct = Math.max(0, Math.min(100, ((clamped - low) / range) * 100));

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      title={`${current.toFixed(2)} between 52W ${low.toFixed(2)} – ${high.toFixed(2)}`}
    >
      <div className="tabular-nums">{current.toFixed(2)}</div>
      <div
        className="relative w-[110px] h-1.5 rounded-full"
        style={{
          background:
            "linear-gradient(to right, #10b981 0%, #eab308 50%, #ef4444 100%)",
        }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] h-3 rounded-sm bg-neutral-100 ring-1 ring-neutral-950 shadow"
          style={{ left: `${positionPct}%` }}
        />
      </div>
      <div className="flex justify-between w-[110px] text-[9px] text-neutral-500 tabular-nums">
        <span>{low.toFixed(0)}</span>
        <span>{high.toFixed(0)}</span>
      </div>
    </div>
  );
}
