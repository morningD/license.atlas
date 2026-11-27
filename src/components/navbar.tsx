// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useLang } from "@/lib/i18n";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const next = stored === "dark" || (!stored && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(next);
    setMounted(true);
    document.documentElement.classList.toggle("dark", next);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-[#7c3aed] dark:text-zinc-400 dark:hover:text-[#a78bfa]"
      aria-label="Toggle dark mode"
      suppressHydrationWarning
    >
      {mounted && dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function Navbar() {
  const { lang, setLang, t } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function resetHomeSearch() {
    window.dispatchEvent(new Event("license-atlas:reset-home"));
  }

  const brandName = mounted && lang === "zh"
    ? <span className="font-serif tracking-widest">许可图鉴</span>
    : "LicenseAtlas";

  return (
    <header className="sticky top-0 z-[100] border-b border-zinc-200/60 bg-white/70 backdrop-blur-lg dark:border-zinc-800/60 dark:bg-zinc-950/70">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" onClick={resetHomeSearch} className="flex min-w-0 items-center gap-2 font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          <svg width="24" height="24" viewBox="0 0 32 32" className="shrink-0">
            <defs><linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
            <rect width="32" height="32" rx="8" fill="url(#logo-bg)"/>
            <text x="16" y="21.5" textAnchor="middle" fontFamily="system-ui,-apple-system,sans-serif" fontWeight="800" fontSize="14" fill="white" letterSpacing="-0.5">LA</text>
          </svg>
          <span className="hidden bg-gradient-to-r from-[#7c3aed] to-zinc-950 bg-clip-text text-transparent dark:to-zinc-50 sm:inline">
            {brandName}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
          <Link
            href="/"
            onClick={resetHomeSearch}
            className="text-zinc-600 transition-colors hover:text-[#7c3aed] dark:text-zinc-400 dark:hover:text-[#a78bfa]"
          >
            {t("nav.browse")}
          </Link>
          <Link
            href="/about"
            className="text-zinc-600 transition-colors hover:text-[#7c3aed] dark:text-zinc-400 dark:hover:text-[#a78bfa]"
          >
            {t("nav.about")}
          </Link>
          <Link
            href="/tracker"
            className="rounded-full border border-[#3da639]/20 bg-[#3da639]/[0.08] px-3 py-1 text-xs font-semibold text-[#2f7d32] transition-colors hover:border-[#3da639]/40 hover:bg-[#3da639]/[0.14] dark:border-[#3da639]/25 dark:bg-[#3da639]/[0.12] dark:text-[#78d672] dark:hover:bg-[#3da639]/20"
          >
            <span className="hidden sm:inline">{t("nav.tracker")}</span>
            <span className="sm:hidden">Tracker</span>
          </Link>
          <a
            href="https://github.com/morningD/license.atlas"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-zinc-500 transition-colors hover:text-[#7c3aed] dark:text-zinc-400 dark:hover:text-[#a78bfa] sm:inline"
            aria-label="GitHub"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <button
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="rounded-lg px-1.5 py-0.5 text-xs font-bold text-zinc-500 transition-colors hover:text-[#7c3aed] dark:text-zinc-400 dark:hover:text-[#a78bfa]"
            aria-label={t("lang.switchTo")}
          >
            {lang === "en" ? "中" : "EN"}
          </button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
