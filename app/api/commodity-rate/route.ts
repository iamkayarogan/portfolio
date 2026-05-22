import { NextResponse } from "next/server";
import { fetchCommodityRates } from "@/lib/prices";
import { requireApiAuth } from "@/lib/auth";

export async function GET() {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const rates = await fetchCommodityRates();
  return NextResponse.json(rates);
}
