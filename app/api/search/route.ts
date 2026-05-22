import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import type { AssetType } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth";

const yahoo = new YahooFinance();

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  type: AssetType;
}

interface YahooQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
}

interface MfApiHit {
  schemeCode: number | string;
  schemeName: string;
}

const VALID_TYPES: AssetType[] = ["stock", "etf", "mf"];

export async function GET(req: Request) {
  const unauth = await requireApiAuth();
  if (unauth) return unauth;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as AssetType | null;
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!type || !VALID_TYPES.includes(type) || q.length < 1) {
    return NextResponse.json([]);
  }

  if (type === "mf") {
    try {
      const res = await fetch(
        `https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`,
        { next: { revalidate: 300 } },
      );
      if (!res.ok) return NextResponse.json([]);
      const json = (await res.json()) as MfApiHit[];
      const items: SearchResult[] = json.slice(0, 25).map((it) => ({
        symbol: String(it.schemeCode),
        name: it.schemeName,
        exchange: "MF",
        currency: "INR",
        type: "mf",
      }));
      return NextResponse.json(items);
    } catch {
      return NextResponse.json([]);
    }
  }

  try {
    const queries = [q];
    if (!/\.[A-Z]+$/.test(q)) {
      queries.push(`${q}.NS`, `${q}.BO`);
    }
    const responses = await Promise.allSettled(
      queries.map((query) =>
        yahoo.search(
          query,
          { quotesCount: 15, newsCount: 0 },
          { validateResult: false },
        ) as Promise<{ quotes?: YahooQuote[] }>,
      ),
    );

    const seen = new Set<string>();
    const items: SearchResult[] = [];
    for (const r of responses) {
      if (r.status !== "fulfilled") continue;
      for (const it of r.value.quotes ?? []) {
        if (
          !it.symbol ||
          seen.has(it.symbol) ||
          (it.quoteType !== "EQUITY" && it.quoteType !== "ETF")
        ) {
          continue;
        }
        seen.add(it.symbol);
        const sym = it.symbol;
        const isIndia = /\.(NS|BO)$/.test(sym);
        items.push({
          symbol: sym,
          name: it.longname || it.shortname || sym,
          exchange: it.exchDisp || it.exchange || "",
          currency: isIndia ? "INR" : "USD",
          type,
        });
      }
    }

    items.sort((a, b) => {
      const aIndia = /\.(NS|BO)$/.test(a.symbol) ? 0 : 1;
      const bIndia = /\.(NS|BO)$/.test(b.symbol) ? 0 : 1;
      return aIndia - bIndia;
    });

    return NextResponse.json(items.slice(0, 25));
  } catch {
    return NextResponse.json([]);
  }
}
