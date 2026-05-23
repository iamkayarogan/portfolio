import db, { type HoldingRow } from "@/lib/db";
import { fetchPricesForHoldings, fetchUsdInr } from "@/lib/prices";
import EtfsManager from "./EtfsManager";

export const dynamic = "force-dynamic";

export default async function EtfsPage() {
  const rows = db
    .prepare(`SELECT * FROM holdings WHERE asset_type = 'etf' ORDER BY symbol`)
    .all() as HoldingRow[];
  const [quotes, usdInr] = await Promise.all([
    fetchPricesForHoldings(rows),
    fetchUsdInr(),
  ]);
  return <EtfsManager initial={rows} initialQuotes={quotes} usdInr={usdInr} />;
}
