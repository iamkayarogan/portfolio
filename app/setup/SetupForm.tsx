"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900/60 p-6 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold">Set up your password</h1>
          <p className="text-xs text-neutral-400 mt-1">
            One-time setup. This password protects the entire app.
          </p>
        </div>
        <label className="flex flex-col text-xs gap-1">
          <span className="text-neutral-400">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            minLength={6}
            required
            className="bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs gap-1">
          <span className="text-neutral-400">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            className="bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-medium px-4 py-2 text-sm"
        >
          {busy ? "Setting up…" : "Create password"}
        </button>
      </form>
    </div>
  );
}
