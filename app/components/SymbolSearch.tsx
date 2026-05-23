"use client";

import { useEffect, useState } from "react";
import type { AssetType } from "@/lib/db";

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  type: AssetType;
}

interface Props {
  assetType: AssetType;
  value: string;
  onChange: (symbol: string) => void;
  onSelect: (result: SymbolSearchResult) => void;
  placeholder?: string;
}

export default function SymbolSearch({
  assetType,
  value,
  onChange,
  onSelect,
  placeholder,
}: Props) {
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?type=${assetType}&q=${encodeURIComponent(q)}`,
        );
        if (cancelled) return;
        const data = (await res.json()) as SymbolSearchResult[];
        setResults(Array.isArray(data) ? data : []);
        setHighlight(0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, assetType]);

  const showDropdown = focused && value.trim().length >= 2;

  function pick(r: SymbolSearchResult) {
    onSelect(r);
    setFocused(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlight]) pick(results[highlight]);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 150);
        }}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm font-mono"
        required
      />
      {showDropdown ? (
        <div
          className="absolute top-full left-0 right-0 z-20 mt-1 max-h-80 overflow-auto rounded-md border border-neutral-800 bg-neutral-900 shadow-xl"
          role="listbox"
        >
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-500">
              No matches. Try a fuller keyword.
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.symbol}-${i}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${
                  i === highlight ? "bg-neutral-800" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm">{r.symbol}</div>
                  <div className="text-xs text-neutral-400 truncate">
                    {r.name}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 whitespace-nowrap">
                  {r.exchange} · {r.currency}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
