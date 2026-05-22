"use client";

import { useState } from "react";
import type { HoldingRow } from "@/lib/db";
import { formatCurrency, formatPercent, toInr } from "@/lib/format";
import type { PriceQuote } from "@/lib/prices";
import { updateHolding } from "@/lib/api-client";

interface Props {
  rows: HoldingRow[];
  quotes: Record<string, PriceQuote>;
  usdInr: number | null;
  extraColumns?: { key: keyof HoldingRow; label: string }[];
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
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="text-left px-4 py-2">Symbol</th>
              <th className="text-left px-4 py-2">Name</th>
              {extraColumns?.map((c) => (
                <th key={String(c.key)} className="text-left px-4 py-2">
                  {c.label}
                </th>
              ))}
              <th className="text-right px-4 py-2">Qty</th>
              <th className="text-right px-4 py-2">Avg Buy</th>
              <th className="text-right px-4 py-2">Price</th>
              <th className="text-right px-4 py-2">Value</th>
              <th className="text-right px-4 py-2">Gain</th>
              {showActions && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
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
                <tr key={r.id} className="border-t border-neutral-800">
                  <td className="px-4 py-2 font-mono text-xs">{r.symbol}</td>
                  <td className="px-4 py-2 text-neutral-300">{r.name}</td>
                  {extraColumns?.map((c) => (
                    <td key={String(c.key)} className="px-4 py-2 text-neutral-400">
                      {(r[c.key] as string | number | null) ?? "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums">
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
                        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm w-24 text-right"
                      />
                    ) : (
                      r.quantity
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
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
                        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm w-28 text-right"
                      />
                    ) : costUnknown ? (
                      <span className="italic text-neutral-500">unknown</span>
                    ) : (
                      formatCurrency(r.avg_buy_price, r.currency)
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {price !== null ? formatCurrency(price, r.currency) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {current !== null ? formatCurrency(current, r.currency) : "—"}
                    {showInrEquiv ? (
                      <div className="text-[10px] text-neutral-500">
                        ≈ {formatCurrency(currentInr!, "INR")}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${tone}`}
                  >
                    {gain !== null ? (
                      <>
                        <div>{formatCurrency(gain, r.currency)}</div>
                        <div className="text-xs">
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
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(r.id)}
                            disabled={busy}
                            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 mr-3"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-neutral-400 hover:text-neutral-200"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {onUpdate && (
                            <button
                              onClick={() => startEdit(r)}
                              className="text-emerald-400 hover:text-emerald-300 mr-3"
                            >
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(r.id)}
                              className="text-rose-400 hover:text-rose-300"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
