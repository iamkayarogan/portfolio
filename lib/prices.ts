import "server-only";
import YahooFinance from "yahoo-finance2";
import type { AssetType, HoldingRow } from "./db";

const yahoo = new YahooFinance();

export interface PriceQuote {
  symbol: string;
  price: number | null;
  currency: string | null;
  source: "yahoo" | "mfapi" | "spot" | "manual" | null;
  weekHigh52: number | null;
  weekLow52: number | null;
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
      weekHigh52: (q?.fiftyTwoWeekHigh as number | undefined) ?? null,
      weekLow52: (q?.fiftyTwoWeekLow as number | undefined) ?? null,
    };
  } catch (err) {
    return {
      symbol,
      price: null,
      currency: null,
      source: "yahoo",
      weekHigh52: null,
      weekLow52: null,
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
      weekHigh52: null,
      weekLow52: null,
    };
  } catch (err) {
    return {
      symbol: schemeCode,
      price: null,
      currency: null,
      source: "mfapi",
      weekHigh52: null,
      weekLow52: null,
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
      weekHigh52: null,
      weekLow52: null,
    };
  }
  if (row.current_price !== null) {
    return {
      symbol: row.symbol,
      price: row.current_price,
      currency: row.currency,
      source: "manual",
      weekHigh52: null,
      weekLow52: null,
    };
  }
  return {
    symbol: row.symbol,
    price: row.avg_buy_price,
    currency: row.currency,
    source: "manual",
    weekHigh52: null,
    weekLow52: null,
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

export interface StockInfo {
  sector: string | null;
  region: "US" | "IN" | null;
  marketCapUsd: number | null;
  roe: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  bookValue: number | null;
  pegRatio: number | null;
  roce: number | null;
}

export async function fetchStockInfo(symbol: string): Promise<StockInfo> {
  const region: "US" | "IN" | null = /\.(NS|BO)$/.test(symbol)
    ? "IN"
    : /^[A-Z.]+$/.test(symbol)
      ? "US"
      : null;
  try {
    const summary = (await yahoo.quoteSummary(symbol, {
      modules: [
        "assetProfile",
        "price",
        "financialData",
        "defaultKeyStatistics",
        "summaryDetail",
      ],
    })) as {
      assetProfile?: { sector?: string };
      price?: {
        marketCap?: number | { raw?: number };
        currency?: string;
      };
      financialData?: {
        returnOnEquity?: number | { raw?: number };
        debtToEquity?: number | { raw?: number };
        currentRatio?: number | { raw?: number };
        earningsGrowth?: number | { raw?: number };
      };
      defaultKeyStatistics?: {
        bookValue?: number | { raw?: number };
        pegRatio?: number | { raw?: number };
        earningsQuarterlyGrowth?: number | { raw?: number };
      };
      summaryDetail?: {
        trailingPE?: number | { raw?: number };
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

    let roe = unwrapNumber(summary.financialData?.returnOnEquity);
    const debtToEquityPct = unwrapNumber(summary.financialData?.debtToEquity);
    let currentRatio = unwrapNumber(summary.financialData?.currentRatio);
    // Yahoo's debtToEquity comes in as percentage points (e.g. 79.548 = 79.548%).
    // Normalize to a true ratio (0.79548) so the < 0.5 threshold reads naturally.
    let debtToEquity = debtToEquityPct !== null ? debtToEquityPct / 100 : null;

    // For Indian small/mid-caps Yahoo's financialData is sparse — fall back to
    // computing from the raw balance sheet + income statement. ROCE is always
    // computed from fundamentals (Yahoo doesn't expose it directly).
    let roce: number | null = null;
    const fund = await fetchFundamentals(symbol);
    if (fund) {
      if (roe === null && fund.netIncome !== null && fund.equity)
        roe = fund.netIncome / fund.equity;
      if (debtToEquity === null && fund.totalDebt !== null && fund.equity)
        debtToEquity = fund.totalDebt / fund.equity;
      if (
        currentRatio === null &&
        fund.currentAssets !== null &&
        fund.currentLiabilities
      ) {
        currentRatio = fund.currentAssets / fund.currentLiabilities;
      }
      if (
        fund.operatingIncome !== null &&
        fund.totalAssets !== null &&
        fund.currentLiabilities !== null
      ) {
        const capitalEmployed = fund.totalAssets - fund.currentLiabilities;
        if (capitalEmployed > 0)
          roce = fund.operatingIncome / capitalEmployed;
      }
    }

    const bookValue = unwrapNumber(summary.defaultKeyStatistics?.bookValue);
    let pegRatio = unwrapNumber(summary.defaultKeyStatistics?.pegRatio);
    if (pegRatio === null) {
      // Fallback: PEG = trailingPE / (earnings growth %)
      const pe = unwrapNumber(summary.summaryDetail?.trailingPE);
      const growth =
        unwrapNumber(summary.financialData?.earningsGrowth) ??
        unwrapNumber(summary.defaultKeyStatistics?.earningsQuarterlyGrowth);
      if (pe !== null && pe > 0 && growth !== null && growth > 0) {
        pegRatio = pe / (growth * 100);
      }
    }

    return {
      sector,
      region,
      marketCapUsd,
      roe,
      debtToEquity,
      currentRatio,
      bookValue,
      pegRatio,
      roce,
    };
  } catch {
    return {
      sector: null,
      region,
      marketCapUsd: null,
      roe: null,
      debtToEquity: null,
      currentRatio: null,
      bookValue: null,
      pegRatio: null,
      roce: null,
    };
  }
}

interface FundamentalsRow {
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  equity: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
  totalAssets: number | null;
}

async function fetchFundamentals(symbol: string): Promise<FundamentalsRow | null> {
  try {
    const period1 = new Date(Date.now() - 2 * 365 * 86400_000)
      .toISOString()
      .slice(0, 10);
    const series = (await yahoo.fundamentalsTimeSeries(symbol, {
      period1,
      type: "annual",
      module: "all",
    })) as Array<{
      currentAssets?: number;
      currentLiabilities?: number;
      totalDebt?: number;
      stockholdersEquity?: number;
      totalEquityGrossMinorityInterest?: number;
      netIncome?: number;
      operatingIncome?: number;
      ebit?: number;
      totalAssets?: number;
    }>;
    const latest = series?.[series.length - 1];
    if (!latest) return null;
    return {
      currentAssets: latest.currentAssets ?? null,
      currentLiabilities: latest.currentLiabilities ?? null,
      totalDebt: latest.totalDebt ?? null,
      equity:
        latest.stockholdersEquity ??
        latest.totalEquityGrossMinorityInterest ??
        null,
      netIncome: latest.netIncome ?? null,
      operatingIncome: latest.operatingIncome ?? latest.ebit ?? null,
      totalAssets: latest.totalAssets ?? null,
    };
  } catch {
    return null;
  }
}

function unwrapNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (
    typeof v === "object" &&
    v !== null &&
    "raw" in v &&
    typeof (v as { raw?: unknown }).raw === "number"
  ) {
    return (v as { raw: number }).raw;
  }
  return null;
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
