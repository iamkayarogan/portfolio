"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CommodityForm,
  CommodityMetal,
  HoldingRow,
} from "@/lib/db";
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
  SelectField,
  ErrorMessage,
  SubmitButton,
  PieCard,
} from "@/app/components/FormField";
import { formatCurrency } from "@/lib/format";

interface Props {
  initial: HoldingRow[];
  initialQuotes: Record<string, PriceQuote>;
  usdInr: number | null;
  rates: { goldPerGram: number | null; silverPerGram: number | null; source: string };
}

const EMPTY = {
  metal: "gold" as CommodityMetal,
  form: "physical" as CommodityForm,
  name: "",
  symbol: "",
  quantity: "",
  avg_buy_price: "",
  currency: "INR",
};

export default function CommoditiesManager({
  initial,
  initialQuotes,
  usdInr,
  rates,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isEtf = form.form === "etf";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sym = isEtf
        ? form.symbol.trim()
        : form.symbol.trim() || `${form.metal}-${form.form}-${Date.now()}`;
      const saved = await createHolding({
        asset_type: "commodity",
        symbol: sym,
        name:
          form.name.trim() ||
          `${form.metal === "gold" ? "Gold" : "Silver"} (${form.form})`,
        quantity: Number(form.quantity),
        avg_buy_price: Number(form.avg_buy_price),
        currency: form.currency,
        commodity_metal: form.metal,
        commodity_form: form.form,
      });
      setRows((prev) => [...prev, saved]);
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
    if (!confirm("Delete this commodity holding?")) return;
    try {
      await deleteHolding(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const metalSlices = aggregate(
    rows,
    initialQuotes,
    usdInr,
    (r) => r.commodity_metal,
    (_r, k) => (k === "gold" ? "Gold" : "Silver"),
  );
  const formSlices = aggregate(
    rows,
    initialQuotes,
    usdInr,
    (r) => r.commodity_form,
    (_r, k) =>
      k === "physical" ? "Physical" : k === "digital" ? "Digital" : "ETF",
  );

  return (
    <section className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">Commodities</h1>
          <p className="text-sm text-neutral-400">{rows.length} holdings</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-neutral-400">
            Spot ({rates.source}):{" "}
            <span className="text-neutral-200">
              Gold {rates.goldPerGram ? formatCurrency(rates.goldPerGram) : "—"} / g
            </span>
            {" · "}
            <span className="text-neutral-200">
              Silver {rates.silverPerGram ? formatCurrency(rates.silverPerGram) : "—"} / g
            </span>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium px-3 py-1.5 text-sm whitespace-nowrap"
          >
            {showForm ? "Cancel" : "+ Add commodity"}
          </button>
        </div>
      </header>

      <SummaryStats rows={rows} quotes={initialQuotes} usdInr={usdInr} />

      {showForm && (
      <form
        onSubmit={submit}
        className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3"
      >
        <h2 className="text-sm font-medium text-neutral-300">Add commodity</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <SelectField
            className="md:col-span-2"
            label="Metal"
            value={form.metal}
            onChange={(v) => setForm({ ...form, metal: v })}
            options={[
              { value: "gold", label: "Gold" },
              { value: "silver", label: "Silver" },
            ]}
          />
          <SelectField
            className="md:col-span-2"
            label="Form"
            value={form.form}
            onChange={(v) => setForm({ ...form, form: v, symbol: "", name: "" })}
            options={[
              { value: "physical", label: "Physical" },
              { value: "digital", label: "Digital" },
              { value: "etf", label: "ETF" },
            ]}
          />
          {isEtf ? (
            <div className="md:col-span-4 flex flex-col text-xs gap-1">
              <span className="text-neutral-400">Search ETF</span>
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
                placeholder="e.g. goldbees, silverbees"
              />
            </div>
          ) : (
            <Field
              className="md:col-span-4"
              label="Name / Source"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder={
                form.form === "physical"
                  ? "e.g. Jewellery, Coin"
                  : "e.g. SafeGold, MMTC-PAMP"
              }
              required
            />
          )}
          <Field
            className="md:col-span-2"
            label={isEtf ? "Units" : "Quantity (grams)"}
            type="number"
            value={form.quantity}
            onChange={(v) => setForm({ ...form, quantity: v })}
            required
          />
          <Field
            className="md:col-span-2"
            label={isEtf ? "Avg buy price" : "Avg buy price (per gram)"}
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
        <SubmitButton busy={busy} label="Add" />
      </form>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metalSlices.length > 0 && (
            <PieCard title="Allocation by metal">
              <AllocationPie slices={metalSlices} />
            </PieCard>
          )}
          {formSlices.length > 1 && (
            <PieCard title="Allocation by form">
              <AllocationPie slices={formSlices} />
            </PieCard>
          )}
        </div>
      )}

      <HoldingsTable
        rows={rows}
        quotes={initialQuotes}
        usdInr={usdInr}
        extraColumns={[
          { key: "commodity_metal", label: "Metal" },
          { key: "commodity_form", label: "Form" },
        ]}
        onUpdate={(updated) => {
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          router.refresh();
        }}
        onDelete={remove}
      />
    </section>
  );
}
