import "server-only";
import YahooFinance from "yahoo-finance2";
import type { AssetType, HoldingRow } from "./db";

const yahoo = new YahooFinance();

export interface PriceQuote {
  symbol: string;
  price: number | null;
  currency: string | null;
  source: "yahoo" | "mfapi" | "spot" | "manual" | null;
  error?: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  cache.delete(key);
  return undefined;
}

function setCached<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function fetchYahoo(symbol: string): Promise<PriceQuote> {
  try {
    const q = await yahoo.quote(symbol);
    const price =
      (q?.regularMarketPrice as number | undefined) ??
      (q?.postMarketPrice as number | undefined) ??
      (q?.preMarketPrice as number | undefined) ??
      null;
    return {
      symbol,
      price: price ?? null,
      currency: (q?.currency as string | undefined) ?? null,
      source: "yahoo",
    };
  } catch (err) {
    return {
      symbol,
      price: null,
      currency: null,
      source: "yahoo",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchMfApi(schemeCode: string): Promise<PriceQuote> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    if (!res.ok) throw new Error(`mfapi ${res.status}`);
    const json = (await res.json()) as {
      data?: { date: string; nav: string }[];
    };
    const nav = json.data?.[0]?.nav;
    return {
      symbol: schemeCode,
      price: nav ? Number(nav) : null,
      currency: "INR",
      source: "mfapi",
    };
  } catch (err) {
    return {
      symbol: schemeCode,
      price: null,
      currency: null,
      source: "mfapi",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchUsdInr(): Promise<number | null> {
  const cached = getCached<number>("USDINR");
  if (cached !== undefined) return cached;
  try {
    const q = await yahoo.quote("INR=X");
    const rate = (q?.regularMarketPrice as number | undefined) ?? null;
    if (rate) setCached("USDINR", rate, 10 * 60 * 1000);
    return rate;
  } catch {
    return null;
  }
}

interface CommodityRates {
  goldPerGram: number | null;
  silverPerGram: number | null;
  source: string;
}

const GRAMS_PER_TROY_OZ = 31.1034768;

export async function fetchCommodityRates(): Promise<CommodityRates> {
  const cached = getCached<CommodityRates>("COMMODITY");
  if (cached) return cached;
  const usdInr = await fetchUsdInr();
  const [gold, silver] = await Promise.all([
    yahoo.quote("GC=F").catch(() => null),
    yahoo.quote("SI=F").catch(() => null),
  ]);
  const goldUsdPerOz = (gold?.regularMarketPrice as number | undefined) ?? null;
  const silverUsdPerOz = (silver?.regularMarketPrice as number | undefined) ?? null;
  const out: CommodityRates = {
    goldPerGram:
      goldUsdPerOz && usdInr ? (goldUsdPerOz * usdInr) / GRAMS_PER_TROY_OZ : null,
    silverPerGram:
      silverUsdPerOz && usdInr
        ? (silverUsdPerOz * usdInr) / GRAMS_PER_TROY_OZ
        : null,
    source: "Yahoo futures × USD/INR",
  };
  setCached("COMMODITY", out, 30 * 60 * 1000);
  return out;
}

export async function fetchPriceForHolding(
  row: HoldingRow,
): Promise<PriceQuote> {
  if (row.asset_type === "mf") return fetchMfApi(row.symbol);
  if (row.asset_type === "stock" || row.asset_type === "etf") {
    return fetchYahoo(row.symbol);
  }
  if (row.asset_type === "commodity") {
    if (row.commodity_form === "etf") return fetchYahoo(row.symbol);
    const rates = await fetchCommodityRates();
    const perGram =
      row.commodity_metal === "silver"
        ? rates.silverPerGram
        : rates.goldPerGram;
    return {
      symbol: row.symbol,
      price: perGram,
      currency: "INR",
      source: "spot",
    };
  }
  if (row.current_price !== null) {
    return {
      symbol: row.symbol,
      price: row.current_price,
      currency: row.currency,
      source: "manual",
    };
  }
  return {
    symbol: row.symbol,
    price: row.avg_buy_price,
    currency: row.currency,
    source: "manual",
  };
}

export async function fetchPricesForHoldings(
  rows: HoldingRow[],
): Promise<Record<string, PriceQuote>> {
  const entries = await Promise.all(
    rows.map(async (r) => [r.id, await fetchPriceForHolding(r)] as const),
  );
  return Object.fromEntries(entries);
}

export async function fetchAllocationPrices(
  symbols: string[],
): Promise<Record<string, PriceQuote>> {
  const unique = [...new Set(symbols.filter(Boolean))];
  const results = await Promise.all(
    unique.map(async (s) => {
      if (/^\d+$/.test(s)) return [s, await fetchMfApi(s)] as const;
      return [s, await fetchYahoo(s)] as const;
    }),
  );
  return Object.fromEntries(results);
}

export async function fetchStockInfo(
  symbol: string,
): Promise<{
  sector: string | null;
  region: "US" | "IN" | null;
  marketCapUsd: number | null;
}> {
  const region: "US" | "IN" | null = /\.(NS|BO)$/.test(symbol)
    ? "IN"
    : /^[A-Z.]+$/.test(symbol)
      ? "US"
      : null;
  try {
    const summary = (await yahoo.quoteSummary(symbol, {
      modules: ["assetProfile", "price"],
    })) as {
      assetProfile?: { sector?: string };
      price?: {
        marketCap?: number | { raw?: number };
        currency?: string;
      };
    };
    const sector = summary.assetProfile?.sector ?? null;
    const mcRaw = summary.price?.marketCap;
    const marketCapNative =
      typeof mcRaw === "number"
        ? mcRaw
        : typeof mcRaw === "object" && mcRaw?.raw
          ? mcRaw.raw
          : null;
    const currency = summary.price?.currency ?? null;

    let marketCapUsd: number | null = null;
    if (marketCapNative && currency) {
      if (currency === "USD") {
        marketCapUsd = marketCapNative;
      } else if (currency === "INR") {
        const rate = await fetchUsdInr();
        if (rate) marketCapUsd = marketCapNative / rate;
      } else {
        marketCapUsd = marketCapNative;
      }
    }
    return { sector, region, marketCapUsd };
  } catch {
    return { sector: null, region, marketCapUsd: null };
  }
}

export { marketCapBucket } from "./market-cap";

export async function fetchMfFundType(
  schemeCode: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      meta?: { scheme_category?: string };
    };
    return json.meta?.scheme_category ?? null;
  } catch {
    return null;
  }
}

export type { AssetType };
