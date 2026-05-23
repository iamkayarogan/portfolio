import db, {
  ASSET_LABEL,
  type AllocationRow,
  type AssetType,
  type HoldingRow,
} from "@/lib/db";
import {
  fetchAllocationPrices,
  fetchPricesForHoldings,
  fetchUsdInr,
} from "@/lib/prices";
import type { PriceQuote } from "@/lib/prices";
import {
  formatCurrency,
  formatPercent,
  toInr,
} from "@/lib/format";
import { aggregate } from "@/lib/aggregate";
import AllocationPie from "@/app/components/AllocationPie";
import { PieCard } from "@/app/components/FormField";
import AvailableFunds from "./AvailableFunds";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const rows = db
    .prepare(`SELECT * FROM holdings ORDER BY asset_type, symbol`)
    .all() as HoldingRow[];
  const brokers = rows.filter((r) => r.asset_type === "cash");
  const allocations = db
    .prepare(`SELECT * FROM allocations ORDER BY broker_id, created_at`)
    .all() as AllocationRow[];

  const targetSymbols = allocations
    .map((a) => a.target_symbol)
    .filter((s): s is string => !!s);

  const [usdInr, allocPrices] = await Promise.all([
    fetchUsdInr(),
    fetchAllocationPrices(targetSymbols),
  ]);

  if (rows.length === 0) {
    return (
      <section className="space-y-8">
        <AvailableFunds
          brokers={brokers}
          allocations={allocations}
          allocPrices={allocPrices}
          usdInr={usdInr}
        />
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold mb-2">No holdings yet</h1>
          <p className="text-neutral-400 mb-6">
            Pick a tab above to add stocks, ETFs, mutual funds, debt, or commodities.
          </p>
        </div>
      </section>
    );
  }

  const investedRows = rows.filter((r) => r.asset_type !== "cash");
  const quotes: Record<string, PriceQuote> =
    await fetchPricesForHoldings(investedRows);

  let totalInvestedInr = 0;
  let totalCurrentInr = 0;
  const byType = new Map<AssetType, { invested: number; current: number; count: number }>();

  for (const r of investedRows) {
    const q = quotes[r.id];
    const price = q?.price ?? r.current_price ?? null;
    const currentRaw = price !== null ? r.quantity * price : null;
    const invested =
      r.avg_buy_price === 0
        ? (currentRaw ?? 0)
        : r.quantity * r.avg_buy_price;
    const current = currentRaw !== null ? currentRaw : invested;
    const investedInr = toInr(invested, r.currency, usdInr) ?? 0;
    const currentInr = toInr(current, r.currency, usdInr) ?? 0;
    totalInvestedInr += investedInr;
    totalCurrentInr += currentInr;
    const slot = byType.get(r.asset_type) ?? { invested: 0, current: 0, count: 0 };
    slot.invested += investedInr;
    slot.current += currentInr;
    slot.count += 1;
    byType.set(r.asset_type, slot);
  }

  const totalGainInr = totalCurrentInr - totalInvestedInr;
  const totalGainPct =
    totalInvestedInr > 0 ? (totalGainInr / totalInvestedInr) * 100 : 0;

  const typeSlices = aggregate(
    investedRows,
    quotes,
    usdInr,
    (r) => r.asset_type,
    (_r, k) => ASSET_LABEL[k as AssetType] ?? k,
  );

  const regionSlices = aggregate(
    rows.filter((r) => r.asset_type === "stock" || r.asset_type === "etf"),
    quotes,
    usdInr,
    (r) => r.region,
    (_r, k) => (k === "IN" ? "India" : k === "US" ? "United States" : "Other"),
  );
  const showRegions = regionSlices.length > 1;

  return (
    <section className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Invested" value={formatCurrency(totalInvestedInr)} />
        <StatCard
          label="Current Value"
          value={formatCurrency(totalCurrentInr)}
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(totalGainInr)}
          sub={formatPercent(totalGainPct)}
          tone={totalGainInr >= 0 ? "positive" : "negative"}
        />
      </div>

      <AvailableFunds
        brokers={brokers}
        allocations={allocations}
        allocPrices={allocPrices}
        usdInr={usdInr}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PieCard title="Allocation by asset type">
          <AllocationPie slices={typeSlices} />
        </PieCard>
        {showRegions && (
          <PieCard title="Region (US / IN equities)">
            <AllocationPie slices={regionSlices} />
          </PieCard>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">By segment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...byType.entries()].map(([type, data]) => {
            const gain = data.current - data.invested;
            const pct = data.invested > 0 ? (gain / data.invested) * 100 : 0;
            const tone =
              gain >= 0 ? "text-emerald-400" : "text-rose-400";
            return (
              <div
                key={type}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-sm text-neutral-300">
                    {ASSET_LABEL[type]}
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {data.count} holding{data.count === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="text-xl font-semibold tabular-nums">
                  {formatCurrency(data.current)}
                </div>
                <div className={`text-xs tabular-nums ${tone}`}>
                  {formatCurrency(gain)} ({formatPercent(pct)})
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Invested {formatCurrency(data.invested)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  const subColor =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-rose-400"
        : "text-neutral-400";
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {sub ? <div className={`text-sm mt-1 tabular-nums ${subColor}`}>{sub}</div> : null}
    </div>
  );
}
