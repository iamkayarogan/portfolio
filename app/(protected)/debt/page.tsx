import db, { type HoldingRow } from "@/lib/db";
import { fetchPricesForHoldings, fetchUsdInr } from "@/lib/prices";
import DebtManager from "./DebtManager";

export const dynamic = "force-dynamic";

export default async function DebtPage() {
  const rows = db
    .prepare(
      `SELECT * FROM holdings
        WHERE asset_type IN ('bond','fd','rd')
        ORDER BY asset_type, name`,
    )
    .all() as HoldingRow[];
  const [quotes, usdInr] = await Promise.all([
    fetchPricesForHoldings(rows),
    fetchUsdInr(),
  ]);
  return <DebtManager initial={rows} initialQuotes={quotes} usdInr={usdInr} />;
}
