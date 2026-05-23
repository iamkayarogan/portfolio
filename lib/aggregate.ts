import type { HoldingRow } from "./db";
import type { PriceQuote } from "./prices";
import { toInr } from "./format";

export interface Slice {
  key: string;
  label: string;
  value: number;
}

export function aggregate(
  rows: HoldingRow[],
  quotes: Record<string, PriceQuote>,
  usdInr: number | null,
  keyFn: (r: HoldingRow) => string | null,
  labelFn?: (r: HoldingRow, key: string) => string,
): Slice[] {
  const map = new Map<string, { label: string; value: number }>();
  for (const r of rows) {
    const key = keyFn(r);
    if (!key) continue;
    const q = quotes[r.id];
    const price = q?.price ?? r.current_price ?? null;
    const valueInOwnCurrency =
      price !== null ? r.quantity * price : r.quantity * r.avg_buy_price;
    const inr = toInr(valueInOwnCurrency, r.currency, usdInr);
    if (inr === null || inr <= 0) continue;
    const existing = map.get(key);
    if (existing) {
      existing.value += inr;
    } else {
      map.set(key, { label: labelFn ? labelFn(r, key) : key, value: inr });
    }
  }
  return [...map.entries()].map(([k, v]) => ({ key: k, label: v.label, value: v.value }));
}
