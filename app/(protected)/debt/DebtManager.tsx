"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetType, HoldingRow } from "@/lib/db";
import type { PriceQuote } from "@/lib/prices";
import { createHolding, deleteHolding } from "@/lib/api-client";
import { aggregate } from "@/lib/aggregate";
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

interface Props {
  initial: HoldingRow[];
  initialQuotes: Record<string, PriceQuote>;
  usdInr: number | null;
}

type DebtKind = "bond" | "fd" | "rd";

const KIND_LABEL: Record<DebtKind, string> = {
  bond: "Bonds",
  fd: "Fixed Deposits",
  rd: "Recurring Deposits",
};

const EMPTY = {
  kind: "fd" as DebtKind,
  name: "",
  symbol: "",
  principal: "",
  quantity: "1",
  interest_rate: "",
  maturity_date: "",
  currency: "INR",
};

export default function DebtManager({
  initial,
  initialQuotes,
  usdInr,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isBond = form.kind === "bond";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const quantity = isBond ? Number(form.quantity) : 1;
      const principalPerUnit = Number(form.principal);
      const sym =
        form.symbol.trim() ||
        (isBond ? form.name.trim() : `${form.kind}-${Date.now()}`);
      const saved = await createHolding({
        asset_type: form.kind as AssetType,
        symbol: sym,
        name: form.name.trim(),
        quantity,
        avg_buy_price: principalPerUnit,
        currency: form.currency,
        interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
        maturity_date: form.maturity_date || null,
      });
      setRows((prev) =>
        [...prev, saved].sort((a, b) =>
          a.asset_type === b.asset_type
            ? a.name.localeCompare(b.name)
            : a.asset_type.localeCompare(b.asset_type),
        ),
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
    if (!confirm("Delete this debt holding?")) return;
    try {
      await deleteHolding(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const slices = aggregate(
    rows,
    initialQuotes,
    usdInr,
    (r) => r.asset_type,
    (_r, k) => KIND_LABEL[k as DebtKind] ?? k,
  );

  return (
    <section className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">Debt</h1>
          <p className="text-sm text-neutral-400">{rows.length} holdings</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium px-3 py-1.5 text-sm"
        >
          {showForm ? "Cancel" : "+ Add debt"}
        </button>
      </header>

      <SummaryStats rows={rows} quotes={initialQuotes} usdInr={usdInr} />

      {showForm && (
      <form
        onSubmit={submit}
        className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3"
      >
        <h2 className="text-sm font-medium text-neutral-300">Add debt instrument</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <SelectField
            className="md:col-span-2"
            label="Type"
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={[
              { value: "fd", label: "Fixed Deposit" },
              { value: "rd", label: "Recurring Deposit" },
              { value: "bond", label: "Bond" },
            ]}
          />
          <Field
            className="md:col-span-4"
            label={isBond ? "Bond name" : "Bank / Issuer"}
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            placeholder={
              isBond ? "e.g. NHAI 2032 Tax-Free Bond" : "e.g. HDFC Bank FD"
            }
          />
          {isBond && (
            <Field
              className="md:col-span-2"
              label="ISIN / Symbol (optional)"
              value={form.symbol}
              onChange={(v) => setForm({ ...form, symbol: v })}
              placeholder="INE…"
            />
          )}
          {isBond && (
            <Field
              className="md:col-span-2"
              label="Quantity"
              type="number"
              value={form.quantity}
              onChange={(v) => setForm({ ...form, quantity: v })}
              required
            />
          )}
          <Field
            className="md:col-span-2"
            label={isBond ? "Face value (per unit)" : "Principal"}
            type="number"
            value={form.principal}
            onChange={(v) => setForm({ ...form, principal: v })}
            required
          />
          <Field
            className="md:col-span-2"
            label="Interest rate (% p.a.)"
            type="number"
            value={form.interest_rate}
            onChange={(v) => setForm({ ...form, interest_rate: v })}
            placeholder="e.g. 7.25"
          />
          <Field
            className="md:col-span-2"
            label="Maturity date"
            type="date"
            value={form.maturity_date}
            onChange={(v) => setForm({ ...form, maturity_date: v })}
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

      {slices.length > 0 && (
        <PieCard title="Allocation by instrument">
          <AllocationPie slices={slices} />
        </PieCard>
      )}

      <HoldingsTable
        rows={rows}
        quotes={initialQuotes}
        usdInr={usdInr}
        extraColumns={[
          { key: "asset_type", label: "Type" },
          { key: "interest_rate", label: "Rate %" },
          { key: "maturity_date", label: "Maturity" },
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
