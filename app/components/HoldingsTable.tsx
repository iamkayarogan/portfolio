"use client";

import { Fragment, useState } from "react";
import type { HoldingRow } from "@/lib/db";
import { formatCurrency, formatPercent, toInr } from "@/lib/format";
import type { PriceQuote } from "@/lib/prices";
import { updateHolding } from "@/lib/api-client";

interface ExtraColumn {
  key: string;
  label: string;
  format?: (
    value: HoldingRow[keyof HoldingRow] | undefined,
    row: HoldingRow,
  ) => React.ReactNode;
}

interface Props {
  rows: HoldingRow[];
  quotes: Record<string, PriceQuote>;
  usdInr: number | null;
  extraColumns?: ExtraColumn[];
  holdingMeta?: (row: HoldingRow) => React.ReactNode;
  onUpdate?: (updated: HoldingRow) => void;
  onDelete?: (id: number) => void;
}

interface EditState {
  quantity: string;
  avg_buy_price: string;
}

export default function HoldingsTable({
  rows,
  quotes,
  usdInr,
  extraColumns,
  holdingMeta,
  onUpdate,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>({ quantity: "", avg_buy_price: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(r: HoldingRow) {
    setEditingId(r.id);
    setEdit({
      quantity: String(r.quantity),
      avg_buy_price: String(r.avg_buy_price),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(id: number) {
    const qty = Number(edit.quantity);
    const buy = Number(edit.avg_buy_price);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be > 0");
      return;
    }
    if (!Number.isFinite(buy) || buy < 0) {
      setError("Avg buy must be ≥ 0");
      return;
    }
    setBusy(true);
    try {
      const saved = await updateHolding(id, {
        quantity: qty,
        avg_buy_price: buy,
      });
      onUpdate?.(saved);
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 p-8 text-center text-neutral-500 text-sm">
        No holdings yet. Add one above.
      </div>
    );
  }

  const showActions = !!onUpdate || !!onDelete;

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-rose-400 px-1">{error}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-xs">
          <thead className="bg-neutral-900 text-neutral-400 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">Holding</th>
              {extraColumns?.map((c) => (
                <th key={String(c.key)} className="text-left px-3 py-2">
                  {c.label}
                </th>
              ))}
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Avg Buy</th>
              <th className="text-right px-3 py-2">Price</th>
              <th className="text-right px-3 py-2">Value</th>
              <th className="text-right px-3 py-2">Gain</th>
              {showActions && <th className="px-3 py-2 w-px" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const totalCols =
                1 + (extraColumns?.length ?? 0) + 5 + (showActions ? 1 : 0);
              const isEditing = editingId === r.id;
              const q = quotes[r.id];
              const price = q?.price ?? r.current_price ?? null;
              const costUnknown = r.avg_buy_price === 0;
              const invested = r.quantity * r.avg_buy_price;
              const current = price !== null ? r.quantity * price : null;
              const gain =
                costUnknown || current === null ? null : current - invested;
              const gainPct =
                gain !== null && invested > 0 ? (gain / invested) * 100 : null;
              const tone =
                gain === null ? "" : gain >= 0 ? "text-emerald-400" : "text-rose-400";
              const currentInr =
                current !== null ? toInr(current, r.currency, usdInr) : null;
              const showInrEquiv =
                r.currency === "USD" && currentInr !== null && usdInr;

              return (
                <Fragment key={r.id}>
                <tr className="border-t border-neutral-800">
                  <td className="px-3 py-2 max-w-[260px]">
                    <div
                      className="font-mono text-[11px] text-neutral-100 truncate"
                      title={r.symbol}
                    >
                      {r.symbol}
                    </div>
                    <div
                      className="text-neutral-400 text-[11px] truncate"
                      title={r.name}
                    >
                      {r.name}
                    </div>
                  </td>
                  {extraColumns?.map((c) => {
                    const rawValue =
                      c.key in r
                        ? (r as unknown as Record<string, unknown>)[c.key]
                        : undefined;
                    return (
                      <td
                        key={c.key}
                        className="px-3 py-2 text-neutral-400 whitespace-nowrap max-w-[140px] truncate"
                        title={
                          typeof rawValue === "string" ||
                          typeof rawValue === "number"
                            ? String(rawValue)
                            : undefined
                        }
                      >
                        {c.format
                          ? c.format(
                              rawValue as HoldingRow[keyof HoldingRow] | undefined,
                              r,
                            )
                          : ((rawValue as string | number | null) ?? "—")}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right tabular-nums">
                    {isEditing ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={edit.quantity}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            quantity: e.target.value.replace(/[^\d.-]/g, ""),
                          })
                        }
                        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs w-20 text-right"
                      />
                    ) : (
                      r.quantity
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={edit.avg_buy_price}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            avg_buy_price: e.target.value.replace(/[^\d.-]/g, ""),
                          })
                        }
                        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs w-24 text-right"
                      />
                    ) : costUnknown ? (
                      <span className="italic text-neutral-500">unknown</span>
                    ) : (
                      formatCurrency(r.avg_buy_price, r.currency)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {price !== null ? formatCurrency(price, r.currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {current !== null ? formatCurrency(current, r.currency) : "—"}
                    {showInrEquiv ? (
                      <div className="text-[10px] text-neutral-500">
                        ≈ {formatCurrency(currentInr!, "INR")}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${tone}`}
                  >
                    {gain !== null ? (
                      <>
                        <div>{formatCurrency(gain, r.currency)}</div>
                        <div className="text-[10px]">
                          {gainPct !== null ? formatPercent(gainPct) : ""}
                        </div>
                      </>
                    ) : costUnknown ? (
                      <span
                        className="italic text-neutral-500"
                        title="Cost basis unknown — gain not calculated"
                      >
                        n/a
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {showActions && (
                    <td className="px-3 py-2 text-right whitespace-nowrap w-px">
                      {isEditing ? (
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => saveEdit(r.id)}
                            disabled={busy}
                            title="Save"
                            className="h-6 w-6 grid place-items-center rounded text-emerald-400 hover:bg-neutral-800 disabled:opacity-50"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEdit}
                            title="Cancel"
                            className="h-6 w-6 grid place-items-center rounded text-neutral-400 hover:bg-neutral-800"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-1">
                          {onUpdate && (
                            <button
                              onClick={() => startEdit(r)}
                              title="Edit"
                              className="h-6 w-6 grid place-items-center rounded text-emerald-400 hover:bg-neutral-800"
                            >
                              ✎
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(r.id)}
                              title="Delete"
                              className="h-6 w-6 grid place-items-center rounded text-rose-400 hover:bg-neutral-800"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                {holdingMeta && !isEditing ? (
                  <tr className="border-t-0">
                    <td
                      colSpan={totalCols}
                      className="px-3 pb-2 text-[10px] text-neutral-500 whitespace-nowrap overflow-x-auto"
                    >
                      {holdingMeta(r)}
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
