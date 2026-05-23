import { NextResponse } from "next/server";
import { fetchUsdInr } from "@/lib/prices";
import { requireApiAuth } from "@/lib/auth";

export async function GET() {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const rate = await fetchUsdInr();
  return NextResponse.json({ usdInr: rate });
}
