export function marketCapBucket(usd: number | null): string {
  if (usd === null || !Number.isFinite(usd)) return "Unknown";
  if (usd >= 10_000_000_000) return "Large Cap";
  if (usd >= 2_000_000_000) return "Mid Cap";
  if (usd > 0) return "Small Cap";
  return "Unknown";
}
