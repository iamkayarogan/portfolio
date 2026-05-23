"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HoldingRow } from "@/lib/db";
import type { PriceQuote } from "@/lib/prices";
import { createHolding, deleteHolding } from "@/lib/api-client";
import { aggregate } from "@/lib/aggregate";
import SymbolSearch, {
  type SymbolSearchResult,
} from "@/app/components/SymbolSearch";
import HoldingsTable from "@/app/components/HoldingsTable";
import AllocationPie from "@/app/components/AllocationPie";
import SummaryStats from "@/app/components/SummaryStats";
import {
  Field,
  ErrorMessage,
  SubmitButton,
  PieCard,
} from "@/app/components/FormField";

interface Props {
  initial: HoldingRow[];
  initialQuotes: Record<string, PriceQuote>;
  usdInr: number | null;
}

const EMPTY = { symbol: "", name: "", quantity: "", avg_buy_price: "" };

function categoryBucket(rawCategory: string | null): string {
  if (!rawCategory) return "Uncategorized";
  const c = rawCategory.toLowerCase();
  if (c.includes("equity")) return "Equity";
  if (c.includes("debt") || c.includes("bond") || c.includes("gilt"))
    return "Debt";
  if (c.includes("hybrid")) return "Hybrid";
  if (c.includes("liquid") || c.includes("overnight") || c.includes("money"))
    return "Liquid / Money Market";
  if (c.includes("index") || c.includes("etf")) return "Index / ETF FoF";
  if (c.includes("solution")) return "Solution Oriented";
  return rawCategory;
}

export default function MfsManager({ initial, initialQuotes, usdInr }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await createHolding({
        asset_type: "mf",
        symbol: form.symbol.trim(),
        name: form.name.trim(),
        quantity: Number(form.quantity),
        avg_buy_price: Number(form.avg_buy_price),
        currency: "INR",
      });
      setRows((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ ...EMPTY });
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this MF holding?")) return;
    try {
      await deleteHolding(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const typeSlices = aggregate(
    rows,
    initialQuotes,
    usdInr,
    (r) => categoryBucket(r.fund_type),
  );

  return (
    <section className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">Mutual Funds</h1>
          <p className="text-sm text-neutral-400">{rows.length} holdings</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium px-3 py-1.5 text-sm"
        >
          {showForm ? "Cancel" : "+ Add fund"}
        </button>
      </header>

      <SummaryStats rows={rows} quotes={initialQuotes} usdInr={usdInr} />

      {showForm && (
      <form
        onSubmit={submit}
        className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3"
      >
        <h2 className="text-sm font-medium text-neutral-300">Add mutual fund</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-4 flex flex-col text-xs gap-1">
            <span className="text-neutral-400">Search</span>
            <SymbolSearch
              assetType="mf"
              value={form.symbol}
              onChange={(symbol) => setForm({ ...form, symbol })}
              onSelect={(r: SymbolSearchResult) =>
                setForm({ ...form, symbol: r.symbol, name: r.name })
              }
              placeholder="Single keyword (e.g. parag, bluechip, axis)"
            />
          </div>
          <Field
            className="md:col-span-2"
            label="Fund name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <Field
            className="md:col-span-3"
            label="Units"
            type="number"
            value={form.quantity}
            onChange={(v) => setForm({ ...form, quantity: v })}
            required
          />
          <Field
            className="md:col-span-3"
            label="Avg NAV (per unit)"
            type="number"
            value={form.avg_buy_price}
            onChange={(v) => setForm({ ...form, avg_buy_price: v })}
            required
          />
        </div>
        <ErrorMessage error={error} />
        <SubmitButton busy={busy} label="Add fund" />
      </form>
      )}

      {typeSlices.length > 0 && (
        <PieCard title="Allocation by fund type">
          <AllocationPie slices={typeSlices} />
        </PieCard>
      )}

      <HoldingsTable
        rows={rows}
        quotes={initialQuotes}
        usdInr={usdInr}
        extraColumns={[{ key: "fund_type", label: "Category" }]}
        onUpdate={(updated) => {
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          router.refresh();
        }}
        onDelete={remove}
      />
    </section>
  );
}
