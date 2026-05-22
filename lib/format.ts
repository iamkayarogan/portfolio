export function formatCurrency(value: number, currency = "INR"): string {
  const code = currency || "INR";
  try {
    const locale = code === "INR" ? "en-IN" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function toInr(
  amount: number,
  currency: string,
  usdInr: number | null,
): number | null {
  if (currency === "INR") return amount;
  if (currency === "USD" && usdInr) return amount * usdInr;
  return null;
}
