import type { AllocationRow, Frequency } from "./db";

export async function createAllocation(payload: {
  broker_id: number;
  label: string;
  amount: number;
  target_symbol?: string | null;
  deadline_days?: number | null;
  frequency?: Frequency | null;
}): Promise<AllocationRow> {
  const res = await fetch("/api/allocations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateAllocation(
  id: number,
  payload: Partial<{
    label: string;
    amount: number;
    target_symbol: string | null;
    deadline_days: number | null;
    frequency: Frequency | null;
  }>,
): Promise<AllocationRow> {
  const res = await fetch(`/api/allocations/${id}`, {
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

export async function deleteAllocation(id: number): Promise<void> {
  const res = await fetch(`/api/allocations/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
