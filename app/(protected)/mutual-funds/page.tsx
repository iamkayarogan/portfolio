import db, { type HoldingRow } from "@/lib/db";
import {
  fetchMfFundType,
  fetchPricesForHoldings,
  fetchUsdInr,
} from "@/lib/prices";
import MfsManager from "./MfsManager";

export const dynamic = "force-dynamic";

export default async function MutualFundsPage() {
  let rows = db
    .prepare(`SELECT * FROM holdings WHERE asset_type = 'mf' ORDER BY name`)
    .all() as HoldingRow[];

  const missing = rows.filter((r) => !r.fund_type);
  if (missing.length > 0) {
    const updates = await Promise.all(
      missing.map(async (r) => ({
        id: r.id,
        fund_type: await fetchMfFundType(r.symbol),
      })),
    );
    const stmt = db.prepare(
      `UPDATE holdings SET fund_type = COALESCE(?, fund_type) WHERE id = ?`,
    );
    for (const u of updates) stmt.run(u.fund_type, u.id);
    rows = db
      .prepare(`SELECT * FROM holdings WHERE asset_type = 'mf' ORDER BY name`)
      .all() as HoldingRow[];
  }

  const [quotes, usdInr] = await Promise.all([
    fetchPricesForHoldings(rows),
    fetchUsdInr(),
  ]);
  return <MfsManager initial={rows} initialQuotes={quotes} usdInr={usdInr} />;
}
