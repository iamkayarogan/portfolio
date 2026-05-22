"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/stocks", label: "Stocks" },
  { href: "/etfs", label: "ETFs" },
  { href: "/mutual-funds", label: "Mutual Funds" },
  { href: "/debt", label: "Debt" },
  { href: "/commodities", label: "Commodities" },
];

export default function Tabs() {
  const pathname = usePathname() || "/";
  return (
    <nav className="flex gap-1 flex-wrap">
      {TABS.map((t) => {
        const active =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              active
                ? "bg-emerald-500 text-neutral-950 font-medium"
                : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
