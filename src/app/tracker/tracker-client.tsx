"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n";
import type { TrackerData, TrackerIndex, TrackerIndexEntry, TrackerIndexMeta } from "@/lib/types";
import { TrackerCard, statusLabel } from "@/components/tracker/tracker-card";

function submitterName(entry: TrackerIndexEntry | TrackerData["submissions"][number]) {
  return typeof entry.submitter === "string" ? entry.submitter : entry.submitter?.name || "";
}

export function TrackerClient() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const [indexEntries, setIndexEntries] = useState<TrackerIndexEntry[] | null>(null);
  const [indexMeta, setIndexMeta] = useState<TrackerIndexMeta | null>(null);
  const [data, setData] = useState<TrackerData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const fullLoadRef = useRef<Promise<TrackerData> | null>(null);
  const dataRef = useRef<TrackerData | null>(null);
  const indexLoadedRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const ensureFullData = useCallback((showErrorOnFailure = false) => {
    if (dataRef.current) return Promise.resolve(dataRef.current);
    if (fullLoadRef.current) return fullLoadRef.current;
    fullLoadRef.current = fetch(`${window.location.origin}/license.atlas/data/tracker.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: TrackerData) => {
        dataRef.current = d;
        setData(d);
        return d;
      })
      .catch((err) => {
        if (showErrorOnFailure || !indexLoadedRef.current) setLoadError(true);
        throw err;
      })
      .finally(() => {
        fullLoadRef.current = null;
      });
    return fullLoadRef.current;
  }, []);

  // Load the lightweight tracker index first (~315KB), then warm full details in background.
  useEffect(() => {
    let cancelled = false;
    import("@/data/tracker-index.json")
      .then((mod) => {
        if (cancelled) return;
        const idx = mod.default as unknown as TrackerIndex;
        setIndexMeta(idx._meta ?? null);
        const entries = Object.entries(idx)
          .filter(([key]) => key !== "_meta")
          .map(([, value]) => value as TrackerIndexEntry)
          .filter((entry, i, arr) => arr.findIndex((x) => x.id === entry.id) === i);
        setIndexEntries(entries);
        indexLoadedRef.current = true;
        setTimeout(() => {
          if (!cancelled) ensureFullData(false).catch(() => {});
        }, 0);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ensureFullData]);

  // Focus handling: expand + scroll + flash when ?focus=<spdx|id> present.
  const focusKey = searchParams.get("focus");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!focusKey) return;
    if (!data) {
      ensureFullData(true).catch(() => {});
      return;
    }
    const norm = (s: string) => s.trim().toLowerCase();
    const sub = data.submissions.find(
      (s) => norm(s.spdx_id) === norm(focusKey) || norm(s.id) === norm(focusKey)
    );
    if (!sub) return;
    setExpandedIds((prev) => new Set(prev).add(sub.id));
    // Wait for the card to expand + render before scrolling. Two rAFs: first
    // commits the expand state, second positions after layout settles.
    const scrollToCard = () => {
      const el = document.getElementById(`card-${sub.id}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
        el.classList.remove("tracker-flash");
        void el.offsetWidth;
        el.classList.add("tracker-flash");
        setTimeout(() => el.classList.remove("tracker-flash"), 1700);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToCard));
    // Clear the focus param WITHOUT triggering a navigation/rerender
    // (router.replace would reset scroll). replaceState silently drops ?focus.
    if (window.history?.replaceState) {
      window.history.replaceState({}, "", `${window.location.pathname}`);
    }
  }, [data, focusKey, ensureFullData]);

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > window.innerHeight;
      setShowBackToTop((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const STATUS_ORDER = ["all", "approved", "rejected", "pending", "withdrawn", "superseded", "legacy"];

  const fullById = useMemo(() => {
    const map = new Map<string, TrackerData["submissions"][number]>();
    for (const s of data?.submissions || []) map.set(s.id, s);
    return map;
  }, [data]);
  const visibleEntries = useMemo(() => {
    const base = data?.submissions ?? indexEntries ?? [];
    return base.filter((s) => {
      if ("timeline" in s) return !(s.status === "legacy" && (!s.timeline || s.timeline.length === 0));
      return !(s.status === "legacy" && !s.has_timeline);
    });
  }, [data, indexEntries]);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of visibleEntries) c[s.status] = (c[s.status] || 0) + 1;
    return c;
  }, [visibleEntries]);
  const searchRows = useMemo(
    () =>
      visibleEntries.map((s) => ({
        submission: s,
        hay: [
          s.name,
          s.id,
          s.spdx_id,
          ...("aliases" in s ? (s.aliases || []) : []),
          submitterName(s),
          ...("participants" in s ? s.participants.map((p) => p.name) : []),
          ...("timeline" in s ? s.timeline.map((e) => `${e.sender || ""} ${e.subject || ""} ${e.snippet || ""}`) : []),
        ].join(" ").toLowerCase(),
      })),
    [visibleEntries],
  );

  const filtered = useMemo(() => {
    let rows = activeFilter === "all"
      ? searchRows
      : searchRows.filter(({ submission }) => submission.status === activeFilter);
    if (deferredQuery) rows = rows.filter(({ hay }) => hay.includes(deferredQuery));
    const order: Record<string, number> = { pending: 0, rejected: 1, withdrawn: 2, superseded: 3, approved: 4, legacy: 5 };
    const arr = rows.map(({ submission }) => submission);
    switch (sortBy) {
      case "recent": arr.sort((a, b) => (b.stats?.date_range?.[1] || "").localeCompare(a.stats?.date_range?.[1] || "")); break;
      case "status": arr.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (b.stats?.date_range?.[0] || "").localeCompare(a.stats?.date_range?.[0] || "")); break;
      case "date-desc": arr.sort((a, b) => (b.stats?.date_range?.[0] || "").localeCompare(a.stats?.date_range?.[0] || "")); break;
      case "date-asc": arr.sort((a, b) => (a.stats?.date_range?.[0] || "").localeCompare(b.stats?.date_range?.[0] || "")); break;
      case "msgs": arr.sort((a, b) => (b.stats?.total_messages || 0) - (a.stats?.total_messages || 0)); break;
      case "duration": arr.sort((a, b) => (b.stats?.duration_days || 0) - (a.stats?.duration_days || 0)); break;
      case "name": arr.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return arr;
  }, [searchRows, activeFilter, deferredQuery, sortBy]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  if (loadError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-zinc-500">
        {t("tracker.loadError")}
      </div>
    );
  }
  if (!indexEntries) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-zinc-500">
        {t("tracker.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {showBackToTop && (
        <button
          type="button"
          aria-label={t("tracker.backToTop")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/70 bg-white/90 text-lg font-semibold text-zinc-600 shadow-lg shadow-zinc-900/10 backdrop-blur transition hover:border-[#7c3aed] hover:text-[#7c3aed] dark:border-zinc-700/70 dark:bg-zinc-900/90 dark:text-zinc-300"
        >
          ↑
        </button>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="bg-gradient-to-r from-[#7c3aed] to-zinc-950 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:to-zinc-50">
            {t("tracker.title")}
          </h1>
          <p className="mt-2 min-h-[3.75rem] max-w-3xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t("tracker.subtitlePre")}
            <a
              href="https://opensource.org/about"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7c3aed] hover:underline dark:text-[#a78bfa]"
            >
              OSI
            </a>
            {t("tracker.subtitlePost")}
          </p>
        </div>
        <p className="shrink-0 pb-1 font-mono text-xs text-zinc-400 dark:text-zinc-500">
          {t("tracker.dataUpdated", {
            time: new Date(data?.meta?.generated_at ?? indexMeta?.generated_at ?? "")
              .toISOString()
              .slice(0, 13)
              .replace("T", " ") + ":00 UTC",
          })}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tracker.search")}
          className="w-64 rounded-lg border border-zinc-200/60 bg-white/60 px-3 py-2 text-sm outline-none backdrop-blur focus:border-[#a78bfa] focus:ring-2 focus:ring-violet-200 dark:border-zinc-700/60 dark:bg-zinc-900/40"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-zinc-200/60 bg-white/60 px-2.5 py-2 text-sm dark:border-zinc-700/60 dark:bg-zinc-900/40"
        >
          <option value="recent">{t("tracker.sortRecent")}</option>
          <option value="status">{t("tracker.sortStatus")}</option>
          <option value="date-desc">{t("tracker.sortNewest")}</option>
          <option value="date-asc">{t("tracker.sortOldest")}</option>
          <option value="msgs">{t("tracker.sortMostDiscussed")}</option>
          <option value="duration">{t("tracker.sortLongest")}</option>
          <option value="name">{t("tracker.sortName")}</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_ORDER.filter((st) => st === "all" || (statusCounts[st] || 0) > 0).map((st) => {
          const count = st === "all" ? visibleEntries.length : statusCounts[st] || 0;
          const label = st === "all" ? t("tracker.all") : statusLabel(t, st);
          const active = st === activeFilter;
          const color =
            st === "all" ? "#7c3aed" : st === "approved" ? "#3DA639" : st === "rejected" ? "#B11107"
            : st === "pending" ? "#7c3aed" : st === "withdrawn" ? "#d97706" : st === "superseded" ? "#0284c7" : "#71717a";
          return (
            <button
              key={st}
              onClick={() => setActiveFilter(st)}
              style={active ? { background: color, borderColor: color, color: "#fff" } : {}}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active ? "" : "border-zinc-200/60 bg-white/60 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:hover:text-zinc-200"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-zinc-400">{t("tracker.noResults")}</div>
      ) : (
        filtered.map((s) => (
          <TrackerCard
            key={s.id}
            s={("timeline" in s) ? s : fullById.get(s.id) || s}
            expanded={expandedIds.has(s.id)}
            onToggleExpand={(id) => {
              toggleExpand(id);
              if (!data) ensureFullData(true).catch(() => {});
            }}
          />
        ))
      )}

    </div>
  );
}
