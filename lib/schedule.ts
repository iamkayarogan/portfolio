import type { Frequency } from "./db";

export type { Frequency } from "./db";

export function periodsInPlan(deadlineDays: number, freq: Frequency): number {
  if (deadlineDays <= 0) return 0;
  return freq === "daily" ? deadlineDays : Math.max(1, Math.ceil(deadlineDays / 7));
}

export function perPeriodAmount(
  totalAmount: number,
  deadlineDays: number,
  freq: Frequency,
): number {
  const n = periodsInPlan(deadlineDays, freq);
  return n > 0 ? totalAmount / n : totalAmount;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysElapsed(createdAt: string, now: Date = new Date()): number {
  const start = startOfDay(new Date(createdAt));
  const today = startOfDay(now);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

export function isExpired(
  createdAt: string,
  deadlineDays: number,
  now: Date = new Date(),
): boolean {
  return daysElapsed(createdAt, now) >= deadlineDays;
}

export function isBuyDayToday(
  createdAt: string,
  freq: Frequency,
  deadlineDays: number,
  now: Date = new Date(),
): boolean {
  if (isExpired(createdAt, deadlineDays, now)) return false;
  if (freq === "daily") return true;
  return new Date(createdAt).getDay() === now.getDay();
}

export function cumulativeTarget(
  totalAmount: number,
  deadlineDays: number,
  freq: Frequency,
  createdAt: string,
  now: Date = new Date(),
): number {
  const elapsed = daysElapsed(createdAt, now);
  if (elapsed <= 0) return 0;
  if (elapsed >= deadlineDays) return totalAmount;
  const per = perPeriodAmount(totalAmount, deadlineDays, freq);
  const periodsDone =
    freq === "daily" ? elapsed : Math.floor(elapsed / 7);
  return Math.min(totalAmount, per * periodsDone);
}
