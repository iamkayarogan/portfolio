import db, { type HoldingRow } from "@/lib/db";
import { fetchPricesForHoldings, fetchUsdInr, fetchCommodityRates } from "@/lib/prices";
import CommoditiesManager from "./CommoditiesManager";

export const dynamic = "force-dynamic";

export default async function CommoditiesPage() {
  const rows = db
    .prepare(
      `SELECT * FROM holdings WHERE asset_type = 'commodity' ORDER BY commodity_metal, name`,
    )
    .all() as HoldingRow[];
  const [quotes, usdInr, rates] = await Promise.all([
    fetchPricesForHoldings(rows),
    fetchUsdInr(),
    fetchCommodityRates(),
  ]);
  return (
    <CommoditiesManager
      initial={rows}
      initialQuotes={quotes}
      usdInr={usdInr}
      rates={rates}
    />
  );
}
