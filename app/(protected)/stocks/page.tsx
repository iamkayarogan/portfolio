import db, { type HoldingRow } from "@/lib/db";
import {
  fetchPricesForHoldings,
  fetchStockInfo,
  fetchUsdInr,
} from "@/lib/prices";
import StocksManager from "./StocksManager";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  let rows = db
    .prepare(`SELECT * FROM holdings WHERE asset_type = 'stock' ORDER BY symbol`)
    .all() as HoldingRow[];

  const missing = rows.filter(
    (r) =>
      !r.sector ||
      !r.region ||
      r.market_cap_usd === null ||
      r.roe === null ||
      r.debt_to_equity === null ||
      r.current_ratio === null ||
      r.book_value === null ||
      r.peg_ratio === null ||
      r.roce === null,
  );
  if (missing.length > 0) {
    const updates = await Promise.all(
      missing.map(async (r) => ({
        id: r.id,
        info: await fetchStockInfo(r.symbol),
      })),
    );
    const stmt = db.prepare(
      `UPDATE holdings
          SET sector = COALESCE(?, sector),
              region = COALESCE(?, region),
              market_cap_usd = COALESCE(?, market_cap_usd),
              roe = COALESCE(?, roe),
              debt_to_equity = COALESCE(?, debt_to_equity),
              current_ratio = COALESCE(?, current_ratio),
              book_value = COALESCE(?, book_value),
              peg_ratio = COALESCE(?, peg_ratio),
              roce = COALESCE(?, roce)
        WHERE id = ?`,
    );
    for (const u of updates)
      stmt.run(
        u.info.sector,
        u.info.region,
        u.info.marketCapUsd,
        u.info.roe,
        u.info.debtToEquity,
        u.info.currentRatio,
        u.info.bookValue,
        u.info.pegRatio,
        u.info.roce,
        u.id,
      );
    rows = db
      .prepare(`SELECT * FROM holdings WHERE asset_type = 'stock' ORDER BY symbol`)
      .all() as HoldingRow[];
  }

  const [quotes, usdInr] = await Promise.all([
    fetchPricesForHoldings(rows),
    fetchUsdInr(),
  ]);
  return (
    <StocksManager initial={rows} initialQuotes={quotes} usdInr={usdInr} />
  );
}
