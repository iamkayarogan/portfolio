import type { HoldingRow } from "./db";

export async function createHolding(payload: Partial<HoldingRow>): Promise<HoldingRow> {
  const res = await fetch("/api/holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.errors?.join(", ") || body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateHolding(
  id: number,
  payload: Partial<HoldingRow>,
): Promise<HoldingRow> {
  const res = await fetch(`/api/holdings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteHolding(id: number): Promise<void> {
  const res = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
