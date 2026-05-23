import { NextResponse } from "next/server";
import db, {
  ASSET_TYPES,
  type AssetType,
  type HoldingRow,
} from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";

function getId(idParam: string): number | null {
  const n = Number(idParam);
  return Number.isInteger(n) && n > 0 ? n : null;
}

interface PutBody {
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const { id } = await ctx.params;
  const numId = getId(id);
  if (!numId) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const row = db.prepare(`SELECT * FROM holdings WHERE id = ?`).get(numId) as
    | HoldingRow
    | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const { id } = await ctx.params;
  const numId = getId(id);
  if (!numId) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const body = (await req.json()) as PutBody;
  const existing = db
    .prepare(`SELECT * FROM holdings WHERE id = ?`)
    .get(numId) as HoldingRow | undefined;
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const next: HoldingRow = {
    ...existing,
    ...body,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  };

  if (!ASSET_TYPES.includes(next.asset_type)) {
    return NextResponse.json({ error: "invalid asset_type" }, { status: 400 });
  }
  if (!next.symbol || !next.name || next.quantity <= 0 || next.avg_buy_price < 0) {
    return NextResponse.json({ error: "invalid fields" }, { status: 400 });
  }

  db.prepare(
    `UPDATE holdings
       SET asset_type = ?, symbol = ?, name = ?, quantity = ?, avg_buy_price = ?,
           currency = ?, notes = ?, sector = ?, region = ?, fund_type = ?,
           interest_rate = ?, maturity_date = ?, commodity_metal = ?,
           commodity_form = ?, current_price = ?, market_cap_usd = ?,
           book_value = ?, peg_ratio = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    next.asset_type,
    next.symbol.trim(),
    next.name.trim(),
    next.quantity,
    next.avg_buy_price,
    next.currency,
    next.notes,
    next.sector,
    next.region,
    next.fund_type,
    next.interest_rate,
    next.maturity_date,
    next.commodity_metal,
    next.commodity_form,
    next.current_price,
    next.market_cap_usd,
    next.book_value,
    next.peg_ratio,
    next.updated_at,
    numId,
  );

  const row = db.prepare(`SELECT * FROM holdings WHERE id = ?`).get(numId) as HoldingRow;
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const { id } = await ctx.params;
  const numId = getId(id);
  if (!numId) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const info = db.prepare(`DELETE FROM holdings WHERE id = ?`).run(numId);
  if (info.changes === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
