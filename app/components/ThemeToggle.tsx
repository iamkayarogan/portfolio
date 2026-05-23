"use client";

import { useState } from "react";

interface Props {
  initialTheme: "light" | "dark";
}

export default function ThemeToggle({ initialTheme }: Props) {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.cookie = `pf_theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    if (next === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="rounded-md border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 text-neutral-300 px-2 py-1.5 text-sm w-9 grid place-items-center"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
