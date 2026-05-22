import { formatCurrency } from "@/lib/format";

export interface AllocationSlice {
  key: string;
  label: string;
  value: number;
}

const COLORS = [
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#a855f7",
  "#f43f5e",
  "#14b8a6",
  "#eab308",
  "#6366f1",
];

const SIZE = 240;
const RADIUS = 110;
const CENTER = SIZE / 2;

function r4(n: number): string {
  return n.toFixed(4);
}

function polar(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const sweep = endDeg - startDeg;
  if (sweep >= 360 - 1e-6) {
    return `M ${CENTER - RADIUS} ${CENTER} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER + RADIUS} ${CENTER} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - RADIUS} ${CENTER} Z`;
  }
  const [x1, y1] = polar(startDeg, RADIUS);
  const [x2, y2] = polar(endDeg, RADIUS);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${r4(x1)} ${r4(y1)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${r4(x2)} ${r4(y2)} Z`;
}

export default function AllocationPie({
  slices,
}: {
  slices: AllocationSlice[];
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0 || slices.length === 0) return null;

  const sorted = [...slices].sort((a, b) => b.value - a.value);

  const cumulative: number[] = [];
  sorted.reduce((acc, s) => {
    cumulative.push(acc);
    return acc + (s.value / total) * 360;
  }, 0);

  const segments = sorted.map((s, i) => {
    const start = cumulative[i];
    const sweep = (s.value / total) * 360;
    return {
      ...s,
      path: arcPath(start, start + sweep),
      color: COLORS[i % COLORS.length],
      pct: (s.value / total) * 100,
    };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="shrink-0"
      >
        {segments.map((seg) => (
          <path
            key={seg.key}
            d={seg.path}
            fill={seg.color}
            stroke="#0a0a0a"
            strokeWidth={2}
          />
        ))}
        <circle cx={CENTER} cy={CENTER} r={56} fill="#0a0a0a" />
        <text
          x={CENTER}
          y={CENTER - 6}
          textAnchor="middle"
          className="fill-neutral-400 text-[10px] uppercase tracking-wider"
        >
          Total
        </text>
        <text
          x={CENTER}
          y={CENTER + 14}
          textAnchor="middle"
          className="fill-neutral-100 text-sm font-semibold"
        >
          {formatCurrency(total)}
        </text>
      </svg>
      <ul className="w-full md:w-auto space-y-2 min-w-[220px]">
        {segments.map((seg) => (
          <li
            key={seg.key}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ background: seg.color }}
              />
              <span className="text-neutral-200 truncate">{seg.label}</span>
            </span>
            <span className="text-neutral-400 whitespace-nowrap tabular-nums">
              {seg.pct.toFixed(1)}% · {formatCurrency(seg.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
