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
    (r) => !r.sector || !r.region || r.market_cap_usd === null,
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
              market_cap_usd = COALESCE(?, market_cap_usd)
        WHERE id = ?`,
    );
    for (const u of updates)
      stmt.run(u.info.sector, u.info.region, u.info.marketCapUsd, u.id);
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
