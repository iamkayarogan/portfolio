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

const EMPTY = {
  symbol: "",
  name: "",
  currency: "INR",
  quantity: "",
  avg_buy_price: "",
};

export default function EtfsManager({ initial, initialQuotes, usdInr }: Props) {
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
        asset_type: "etf",
        symbol: form.symbol.trim(),
        name: form.name.trim(),
        quantity: Number(form.quantity),
        avg_buy_price: Number(form.avg_buy_price),
        currency: form.currency,
      });
      setRows((prev) =>
        [...prev, saved].sort((a, b) => a.symbol.localeCompare(b.symbol)),
      );
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
    if (!confirm("Delete this ETF holding?")) return;
    try {
      await deleteHolding(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const etfSlices = aggregate(rows, initialQuotes, usdInr, (r) => r.symbol);

  return (
    <section className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">ETFs</h1>
          <p className="text-sm text-neutral-400">{rows.length} holdings</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium px-3 py-1.5 text-sm"
        >
          {showForm ? "Cancel" : "+ Add ETF"}
        </button>
      </header>

      <SummaryStats rows={rows} quotes={initialQuotes} usdInr={usdInr} />

      {showForm && (
      <form
        onSubmit={submit}
        className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3"
      >
        <h2 className="text-sm font-medium text-neutral-300">Add ETF</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-4 flex flex-col text-xs gap-1">
            <span className="text-neutral-400">Search</span>
            <SymbolSearch
              assetType="etf"
              value={form.symbol}
              onChange={(symbol) => setForm({ ...form, symbol })}
              onSelect={(r: SymbolSearchResult) =>
                setForm({
                  ...form,
                  symbol: r.symbol,
                  name: r.name,
                  currency: r.currency,
                })
              }
              placeholder="Search by name or ticker (e.g. niftybees, VOO)"
            />
          </div>
          <Field
            className="md:col-span-2"
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <Field
            className="md:col-span-2"
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(v) => setForm({ ...form, quantity: v })}
            required
          />
          <Field
            className="md:col-span-2"
            label="Avg buy price"
            type="number"
            value={form.avg_buy_price}
            onChange={(v) => setForm({ ...form, avg_buy_price: v })}
            required
          />
          <Field
            className="md:col-span-2"
            label="Currency"
            value={form.currency}
            onChange={(v) => setForm({ ...form, currency: v.toUpperCase() })}
          />
        </div>
        <ErrorMessage error={error} />
        <SubmitButton busy={busy} label="Add ETF" />
      </form>
      )}

      {etfSlices.length > 0 && (
        <PieCard title="Per-ETF allocation">
          <AllocationPie slices={etfSlices} />
        </PieCard>
      )}

      <HoldingsTable
        rows={rows}
        quotes={initialQuotes}
        usdInr={usdInr}
        onUpdate={(updated) => {
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          router.refresh();
        }}
        onDelete={remove}
      />
    </section>
  );
}
