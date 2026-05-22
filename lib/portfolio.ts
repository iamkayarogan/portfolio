import type { HoldingRow } from "./db";
import type { PriceQuote } from "./prices";
import { toInr } from "./format";

export interface EnrichedHolding {
  row: HoldingRow;
  price: number | null;
  invested: number;
  current: number | null;
  investedInr: number | null;
  currentInr: number | null;
}

export function enrich(
  rows: HoldingRow[],
  quotes: Record<string, PriceQuote>,
  usdInr: number | null,
): EnrichedHolding[] {
  return rows.map((r) => {
    const q = quotes[r.id];
    const price = q?.price ?? r.current_price ?? null;
    const invested = r.quantity * r.avg_buy_price;
    const current = price !== null ? r.quantity * price : null;
    return {
      row: r,
      price,
      invested,
      current,
      investedInr: toInr(invested, r.currency, usdInr),
      currentInr: current !== null ? toInr(current, r.currency, usdInr) : null,
    };
  });
}

export function sumInr(items: EnrichedHolding[], field: "investedInr" | "currentInr") {
  return items.reduce((acc, e) => acc + (e[field] ?? 0), 0);
}
