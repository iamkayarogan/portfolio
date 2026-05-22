"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AllocationRow, HoldingRow } from "@/lib/db";
import {
  createHolding,
  deleteHolding,
  updateHolding,
} from "@/lib/api-client";
import {
  createAllocation,
  deleteAllocation,
} from "@/lib/allocations-client";
import { formatCurrency, formatNumber, toInr } from "@/lib/format";
import type { PriceQuote } from "@/lib/prices";
import {
  Field,
  SelectField,
  ErrorMessage,
  SubmitButton,
} from "@/app/components/FormField";
import SymbolSearch, {
  type SymbolSearchResult,
} from "@/app/components/SymbolSearch";
import AllocationPie, {
  type AllocationSlice,
} from "@/app/components/AllocationPie";
import type { AssetType } from "@/lib/db";

interface Props {
  brokers: HoldingRow[];
  allocations: AllocationRow[];
  allocPrices: Record<string, PriceQuote>;
  usdInr: number | null;
}

const BROKERS = [
  "Zerodha",
  "Groww",
  "Angel One",
  "Upstox",
  "ICICI Direct",
  "HDFC Securities",
  "Kotak Securities",
  "IIFL Securities",
  "Custom",
] as const;

const EMPTY_FUND = {
  broker: "Zerodha" as (typeof BROKERS)[number],
  custom: "",
  amount: "",
  currency: "INR",
};

interface AllocForm {
  label: string;
  amount: string;
  target_symbol: string;
  asset_type: AssetType;
}

export default function AvailableFunds({
  brokers,
  allocations,
  allocPrices,
  usdInr,
}: Props) {
  const router = useRouter();
  const [funds, setFunds] = useState(brokers);
  const [allocs, setAllocs] = useState(allocations);
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundForm, setFundForm] = useState({ ...EMPTY_FUND });
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundBusy, setFundBusy] = useState(false);

  const [editingBalanceId, setEditingBalanceId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const [allocBrokerId, setAllocBrokerId] = useState<number | null>(null);
  const [allocForm, setAllocForm] = useState<AllocForm>({
    label: "",
    amount: "",
    target_symbol: "",
    asset_type: "stock",
  });
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocBusy, setAllocBusy] = useState(false);

  function refresh() {
    router.refresh();
  }

  async function submitFund(e: React.FormEvent) {
    e.preventDefault();
    setFundBusy(true);
    setFundError(null);
    try {
      const brokerName =
        fundForm.broker === "Custom" ? fundForm.custom.trim() : fundForm.broker;
      if (!brokerName) throw new Error("Broker name required");
      const saved = await createHolding({
        asset_type: "cash",
        symbol: `cash-${brokerName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        name: brokerName,
        quantity: 1,
        avg_buy_price: Number(fundForm.amount),
        currency: fundForm.currency,
      });
      setFunds((prev) =>
        [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setFundForm({ ...EMPTY_FUND });
      setShowFundForm(false);
      refresh();
    } catch (err) {
      setFundError(err instanceof Error ? err.message : String(err));
    } finally {
      setFundBusy(false);
    }
  }

  async function saveBalance(id: number) {
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      setFundError("Amount must be a positive number");
      return;
    }
    try {
      const updated = await updateHolding(id, { avg_buy_price: amt });
      setFunds((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setEditingBalanceId(null);
      setFundError(null);
      refresh();
    } catch (err) {
      setFundError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeFund(id: number) {
    if (!confirm("Remove this broker (and all its planned allocations)?")) return;
    try {
      await deleteHolding(id);
      setFunds((prev) => prev.filter((f) => f.id !== id));
      setAllocs((prev) => prev.filter((a) => a.broker_id !== id));
      refresh();
    } catch (err) {
      setFundError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitAllocation(brokerId: number, e: React.FormEvent) {
    e.preventDefault();
    setAllocBusy(true);
    setAllocError(null);
    try {
      const saved = await createAllocation({
        broker_id: brokerId,
        label: allocForm.label.trim(),
        amount: Number(allocForm.amount),
        target_symbol: allocForm.target_symbol.trim() || null,
      });
      setAllocs((prev) => [...prev, saved]);
      setAllocForm({
        label: "",
        amount: "",
        target_symbol: "",
        asset_type: "stock",
      });
      setAllocBrokerId(null);
      refresh();
    } catch (err) {
      setAllocError(err instanceof Error ? err.message : String(err));
    } finally {
      setAllocBusy(false);
    }
  }

  async function removeAllocation(id: number) {
    try {
      await deleteAllocation(id);
      setAllocs((prev) => prev.filter((a) => a.id !== id));
      refresh();
    } catch (err) {
      setAllocError(err instanceof Error ? err.message : String(err));
    }
  }

  const totalAvailable = funds.reduce(
    (sum, f) => sum + (toInr(f.avg_buy_price, f.currency, usdInr) ?? 0),
    0,
  );
  const totalAllocated = allocs.reduce((sum, a) => sum + a.amount, 0);
  const totalUnallocated = totalAvailable - totalAllocated;

  const planSlices: AllocationSlice[] = allocs.map((a) => ({
    key: `${a.id}`,
    label: a.target_symbol ? `${a.label} [${a.target_symbol}]` : a.label,
    value: a.amount,
  }));
  if (totalUnallocated > 0) {
    planSlices.push({
      key: "unallocated",
      label: "Unallocated",
      value: totalUnallocated,
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Available Funds</h2>
        <button
          onClick={() => setShowFundForm((s) => !s)}
          className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium px-3 py-1.5 text-sm"
        >
          {showFundForm ? "Cancel" : "+ Add funds"}
        </button>
      </div>

      {funds.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SmallStat label="Available" value={formatCurrency(totalAvailable)} />
          <SmallStat
            label="Planned Allocations"
            value={formatCurrency(totalAllocated)}
          />
          <SmallStat
            label="Unallocated"
            value={formatCurrency(totalUnallocated)}
            tone={totalUnallocated < 0 ? "negative" : "neutral"}
          />
        </div>
      )}

      {planSlices.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h3 className="text-sm font-medium text-neutral-300 mb-3">
            Allocation plan
          </h3>
          <AllocationPie slices={planSlices} />
        </div>
      )}

      {showFundForm && (
        <form
          onSubmit={submitFund}
          className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <SelectField
              className="md:col-span-2"
              label="Broker"
              value={fundForm.broker}
              onChange={(v) => setFundForm({ ...fundForm, broker: v })}
              options={BROKERS.map((b) => ({ value: b, label: b }))}
            />
            {fundForm.broker === "Custom" && (
              <Field
                className="md:col-span-2"
                label="Broker name"
                value={fundForm.custom}
                onChange={(v) => setFundForm({ ...fundForm, custom: v })}
                required
              />
            )}
            <Field
              className="md:col-span-2"
              label="Amount available"
              type="number"
              value={fundForm.amount}
              onChange={(v) => setFundForm({ ...fundForm, amount: v })}
              required
            />
            <Field
              className="md:col-span-2"
              label="Currency"
              value={fundForm.currency}
              onChange={(v) =>
                setFundForm({ ...fundForm, currency: v.toUpperCase() })
              }
            />
          </div>
          <ErrorMessage error={fundError} />
          <SubmitButton busy={fundBusy} label="Add broker" />
        </form>
      )}

      {funds.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 p-6 text-center text-neutral-500 text-sm">
          No broker funds tracked yet. Click + Add funds to start.
        </div>
      ) : (
        <div className="space-y-3">
          {funds.map((b) => {
            const brokerAllocs = allocs.filter((a) => a.broker_id === b.id);
            const allocated = brokerAllocs.reduce((s, a) => s + a.amount, 0);
            const balanceInr = toInr(b.avg_buy_price, b.currency, usdInr) ?? 0;
            const unallocated = balanceInr - allocated;
            const isEditing = editingBalanceId === b.id;
            const showAlloc = allocBrokerId === b.id;
            return (
              <div
                key={b.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-neutral-100">
                      {b.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      Allocated {formatCurrency(allocated)} ·{" "}
                      <span
                        className={
                          unallocated < 0 ? "text-rose-400" : "text-emerald-400"
                        }
                      >
                        Unallocated {formatCurrency(unallocated)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    {isEditing ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(e) =>
                          setEditAmount(e.target.value.replace(/[^\d.-]/g, ""))
                        }
                        autoFocus
                        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm w-32 text-right"
                      />
                    ) : (
                      <span className="text-lg font-semibold tabular-nums">
                        {formatCurrency(b.avg_buy_price, b.currency)}
                      </span>
                    )}
                    <div className="flex gap-2 text-xs">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveBalance(b.id)}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingBalanceId(null)}
                            className="text-neutral-400 hover:text-neutral-200"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingBalanceId(b.id);
                              setEditAmount(String(b.avg_buy_price));
                            }}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeFund(b.id)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {brokerAllocs.length > 0 && (
                  <ul className="space-y-1">
                    {brokerAllocs.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between text-sm bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5"
                      >
                        <span className="min-w-0">
                          <span className="text-neutral-100">{a.label}</span>
                          {a.target_symbol ? (
                            <span className="ml-2 font-mono text-xs text-neutral-400">
                              [{a.target_symbol}]
                            </span>
                          ) : null}
                          {(() => {
                            if (!a.target_symbol) return null;
                            const q = allocPrices[a.target_symbol];
                            const price = q?.price;
                            if (!price || price <= 0) return null;
                            const isMf = /^\d+$/.test(a.target_symbol);
                            const rawQty = a.amount / price;
                            const wholeQty = Math.floor(rawQty);
                            const cost = wholeQty * price;
                            const leftover = a.amount - cost;
                            return (
                              <div className="text-[11px] text-neutral-500 mt-0.5">
                                @ {formatCurrency(price)} · buys{" "}
                                <span className="text-emerald-400">
                                  {isMf
                                    ? `${formatNumber(rawQty, 3)} units`
                                    : `${wholeQty} ${
                                        wholeQty === 1 ? "share" : "shares"
                                      }`}
                                </span>
                                {!isMf && wholeQty > 0
                                  ? ` (${formatCurrency(cost)}, ${formatCurrency(
                                      leftover,
                                    )} left)`
                                  : null}
                              </div>
                            );
                          })()}
                        </span>
                        <span className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="tabular-nums">
                            {formatCurrency(a.amount)}
                          </span>
                          <button
                            onClick={() => removeAllocation(a.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs"
                          >
                            Delete
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {showAlloc ? (
                  <form
                    onSubmit={(e) => submitAllocation(b.id, e)}
                    className="rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-2"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                      <SelectField
                        className="md:col-span-1"
                        label="Type"
                        value={allocForm.asset_type}
                        onChange={(v) =>
                          setAllocForm({
                            ...allocForm,
                            asset_type: v,
                            target_symbol: "",
                            label: "",
                          })
                        }
                        options={[
                          { value: "stock", label: "Stock" },
                          { value: "etf", label: "ETF" },
                          { value: "mf", label: "MF" },
                        ]}
                      />
                      <div className="md:col-span-3 flex flex-col text-xs gap-1">
                        <span className="text-neutral-400">
                          Symbol (auto-detect)
                        </span>
                        <SymbolSearch
                          assetType={allocForm.asset_type}
                          value={allocForm.target_symbol}
                          onChange={(symbol) =>
                            setAllocForm({
                              ...allocForm,
                              target_symbol: symbol,
                            })
                          }
                          onSelect={(r: SymbolSearchResult) =>
                            setAllocForm({
                              ...allocForm,
                              target_symbol: r.symbol,
                              label: allocForm.label.trim() || r.name,
                            })
                          }
                          placeholder="Search e.g. INFY, parag, niftybees"
                        />
                      </div>
                      <Field
                        className="md:col-span-2"
                        label="Amount"
                        type="number"
                        value={allocForm.amount}
                        onChange={(v) =>
                          setAllocForm({ ...allocForm, amount: v })
                        }
                        required
                      />
                      <Field
                        className="md:col-span-6"
                        label="Plan label"
                        value={allocForm.label}
                        onChange={(v) =>
                          setAllocForm({ ...allocForm, label: v })
                        }
                        placeholder="Auto-filled from search; editable"
                        required
                      />
                    </div>
                    <ErrorMessage error={allocError} />
                    <div className="flex gap-2">
                      <SubmitButton busy={allocBusy} label="Plan allocation" />
                      <button
                        type="button"
                        onClick={() => {
                          setAllocBrokerId(null);
                          setAllocError(null);
                        }}
                        className="rounded-md border border-neutral-700 hover:bg-neutral-800 px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setAllocBrokerId(b.id);
                      setAllocForm({
                        label: "",
                        amount: "",
                        target_symbol: "",
                        asset_type: "stock",
                      });
                      setAllocError(null);
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    + Plan allocation
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ErrorMessage error={!showFundForm ? fundError : null} />
    </section>
  );
}

function SmallStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "negative";
}) {
  const valueColor = tone === "negative" ? "text-rose-400" : "text-neutral-100";
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}
