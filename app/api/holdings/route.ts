import { NextResponse } from "next/server";
import db, {
  ASSET_TYPES,
  type AssetType,
  type HoldingRow,
} from "@/lib/db";
import { fetchStockInfo, fetchMfFundType } from "@/lib/prices";
import { requireApiAuth } from "@/lib/auth";

interface PostBody {
  asset_type?: AssetType;
  symbol?: string;
  name?: string;
  quantity?: number;
  avg_buy_price?: number;
  currency?: string;
  notes?: string | null;
  sector?: string | null;
  region?: "US" | "IN" | null;
  fund_type?: string | null;
  interest_rate?: number | null;
  maturity_date?: string | null;
  commodity_metal?: "gold" | "silver" | null;
  commodity_form?: "physical" | "digital" | "etf" | null;
  current_price?: number | null;
  market_cap_usd?: number | null;
}

export async function GET(req: Request) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const url = new URL(req.url);
  const filter = url.searchParams.get("type") as AssetType | null;
  if (filter && ASSET_TYPES.includes(filter)) {
    const rows = db
      .prepare(
        `SELECT * FROM holdings WHERE asset_type = ? ORDER BY symbol`,
      )
      .all(filter) as HoldingRow[];
    return NextResponse.json(rows);
  }
  const rows = db
    .prepare(`SELECT * FROM holdings ORDER BY asset_type, symbol`)
    .all() as HoldingRow[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const body = (await req.json()) as PostBody;
  const errors = validate(body);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const enriched = await enrich(body);

  const info = db
    .prepare(
      `INSERT INTO holdings
         (asset_type, symbol, name, quantity, avg_buy_price, currency, notes,
          sector, region, fund_type, interest_rate, maturity_date,
          commodity_metal, commodity_form, current_price, market_cap_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      enriched.asset_type,
      enriched.symbol,
      enriched.name,
      enriched.quantity,
      enriched.avg_buy_price,
      enriched.currency,
      enriched.notes,
      enriched.sector,
      enriched.region,
      enriched.fund_type,
      enriched.interest_rate,
      enriched.maturity_date,
      enriched.commodity_metal,
      enriched.commodity_form,
      enriched.current_price,
      enriched.market_cap_usd,
    );

  const row = db
    .prepare(`SELECT * FROM holdings WHERE id = ?`)
    .get(info.lastInsertRowid) as HoldingRow;

  return NextResponse.json(row, { status: 201 });
}

function validate(b: PostBody): string[] {
  const errs: string[] = [];
  if (!b.asset_type || !ASSET_TYPES.includes(b.asset_type))
    errs.push("asset_type invalid");
  if (!b.symbol) errs.push("symbol required");
  if (!b.name) errs.push("name required");
  if (typeof b.quantity !== "number" || b.quantity <= 0)
    errs.push("quantity must be > 0");
  if (typeof b.avg_buy_price !== "number" || b.avg_buy_price < 0)
    errs.push("avg_buy_price must be >= 0");
  if (b.asset_type === "commodity") {
    if (!b.commodity_metal) errs.push("commodity_metal required");
    if (!b.commodity_form) errs.push("commodity_form required");
  }
  return errs;
}

async function enrich(b: PostBody) {
  const base = {
    asset_type: b.asset_type!,
    symbol: b.symbol!.trim(),
    name: b.name!.trim(),
    quantity: b.quantity!,
    avg_buy_price: b.avg_buy_price!,
    currency: b.currency?.trim() || "INR",
    notes: b.notes?.toString().trim() || null,
    sector: b.sector ?? null,
    region: b.region ?? null,
    fund_type: b.fund_type ?? null,
    interest_rate: b.interest_rate ?? null,
    maturity_date: b.maturity_date ?? null,
    commodity_metal: b.commodity_metal ?? null,
    commodity_form: b.commodity_form ?? null,
    current_price: b.current_price ?? null,
    market_cap_usd: b.market_cap_usd ?? null,
  };

  if (base.asset_type === "stock") {
    if (!base.sector || !base.region || base.market_cap_usd === null) {
      const info = await fetchStockInfo(base.symbol);
      base.sector ??= info.sector;
      base.region ??= info.region;
      base.market_cap_usd ??= info.marketCapUsd;
    }
  }
  if (base.asset_type === "etf" && !base.region) {
    base.region = /\.(NS|BO)$/.test(base.symbol) ? "IN" : "US";
  }
  if (base.asset_type === "mf" && !base.fund_type) {
    base.fund_type = await fetchMfFundType(base.symbol);
  }
  return base;
}
