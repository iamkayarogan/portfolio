import { NextResponse } from "next/server";
import db, { type AllocationRow, type HoldingRow } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";

export async function GET() {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const rows = db
    .prepare(`SELECT * FROM allocations ORDER BY broker_id, created_at`)
    .all() as AllocationRow[];
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const body = (await req.json()) as Partial<AllocationRow>;
  if (!body.broker_id || typeof body.broker_id !== "number") {
    return NextResponse.json({ error: "broker_id required" }, { status: 400 });
  }
  if (!body.label || typeof body.label !== "string") {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }
  if (typeof body.amount !== "number" || body.amount <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }
  const broker = db
    .prepare(`SELECT * FROM holdings WHERE id = ? AND asset_type = 'cash'`)
    .get(body.broker_id) as HoldingRow | undefined;
  if (!broker) {
    return NextResponse.json({ error: "broker not found" }, { status: 404 });
  }
  const info = db
    .prepare(
      `INSERT INTO allocations (broker_id, label, target_symbol, amount, notes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      body.broker_id,
      body.label.trim(),
      body.target_symbol?.trim() || null,
      body.amount,
      body.notes?.trim() || null,
    );
  const row = db
    .prepare(`SELECT * FROM allocations WHERE id = ?`)
    .get(info.lastInsertRowid) as AllocationRow;
  return NextResponse.json(row, { status: 201 });
}
