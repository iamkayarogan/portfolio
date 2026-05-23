"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stamp, setStamp] = useState<string | null>(null);

  function refresh() {
    startTransition(() => {
      router.refresh();
      setStamp(new Date().toLocaleTimeString());
    });
  }

  return (
    <button
      onClick={refresh}
      disabled={isPending}
      title={stamp ? `Last refreshed ${stamp}` : "Refresh prices"}
      className="rounded-md border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 text-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 whitespace-nowrap"
    >
      {isPending ? "Refreshing…" : "↻ Refresh"}
    </button>
  );
}
