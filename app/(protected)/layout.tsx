import Link from "next/link";
import { cookies } from "next/headers";
import Tabs from "@/app/components/Tabs";
import LogoutButton from "@/app/components/LogoutButton";
import RefreshButton from "@/app/components/RefreshButton";
import ThemeToggle from "@/app/components/ThemeToggle";
import { requireAuth } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  const cookieStore = await cookies();
  const theme =
    cookieStore.get("pf_theme")?.value === "light" ? "light" : "dark";
  return (
    <>
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-semibold tracking-tight text-lg">
            Portfolio Tracker
          </Link>
          <div className="flex items-center gap-4">
            <Tabs />
            <RefreshButton />
            <ThemeToggle initialTheme={theme} />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </>
  );
}
