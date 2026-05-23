"use client";

import type { HoldingRow } from "@/lib/db";
import type { PriceQuote } from "@/lib/prices";
import { formatCurrency, formatPercent, toInr } from "@/lib/format";

interface Props {
  rows: HoldingRow[];
  quotes: Record<string, PriceQuote>;
  usdInr: number | null;
}

export default function SummaryStats({ rows, quotes, usdInr }: Props) {
  if (rows.length === 0) return null;

  let invested = 0;
  let current = 0;
  for (const r of rows) {
    const q = quotes[r.id];
    const price = q?.price ?? r.current_price ?? null;
    const investedOwn =
      r.avg_buy_price === 0
        ? price !== null
          ? r.quantity * price
          : 0
        : r.quantity * r.avg_buy_price;
    const currentOwn = price !== null ? r.quantity * price : investedOwn;
    invested += toInr(investedOwn, r.currency, usdInr) ?? 0;
    current += toInr(currentOwn, r.currency, usdInr) ?? 0;
  }
  const gain = current - invested;
  const pct = invested > 0 ? (gain / invested) * 100 : 0;
  const tone = gain >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Stat label="Invested" value={formatCurrency(invested)} />
      <Stat label="Current Value" value={formatCurrency(current)} />
      <Stat
        label="P&L"
        value={formatCurrency(gain)}
        sub={formatPercent(pct)}
        toneClass={tone}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  toneClass,
}: {
  label: string;
  value: string;
  sub?: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${toneClass ?? ""}`}>
        {value}
      </div>
      {sub ? (
        <div className={`text-sm mt-1 tabular-nums ${toneClass ?? "text-neutral-400"}`}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}
