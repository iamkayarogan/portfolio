import { NextResponse } from "next/server";
import db, { type HoldingRow } from "@/lib/db";
import { fetchPricesForHoldings } from "@/lib/prices";
import { requireApiAuth } from "@/lib/auth";

export async function GET() {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const rows = db.prepare(`SELECT * FROM holdings`).all() as HoldingRow[];
  const quotes = await fetchPricesForHoldings(rows);
  return NextResponse.json(quotes);
}
