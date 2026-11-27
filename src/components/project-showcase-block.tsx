// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import { useLang } from "@/lib/i18n";
import type { ProjectShowcaseItem, ProjectShowcaseRecord } from "@/lib/types";

interface Props {
  entry: ProjectShowcaseRecord | null;
}

function sourceLabel(source: string, t: (key: string) => string) {
  if (source === "github") return t("detail.showcaseGitHub");
  if (source === "huggingface") return t("detail.showcaseHf");
  return t("detail.showcaseKaggle");
}

function compactNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return value.toLocaleString();
}

function metricLabel(source: string, item: ProjectShowcaseItem, t: (key: string) => string) {
  if (source === "github") return `${compactNumber(item.metric.stars || 0)} ${t("detail.showcaseStars")}`;
  if (source === "huggingface" && item.rank_basis === "likes_fallback") return `${compactNumber(item.metric.likes || 0)} ${t("detail.showcaseLikes")}`;
  if (source === "huggingface") return `${compactNumber(Math.round(item.metric.trendingScore || 0))} ${t("detail.showcaseTrend")}`;
  return `${compactNumber(item.metric.votes || 0)} ${t("detail.showcaseVotes")}`;
}

function displayName(item: ProjectShowcaseItem) {
  const name = item.name || "";
  if (!name.includes("/")) return name;
  return name.split("/").filter(Boolean).at(-1) || name;
}

function FallbackIcon({ label, source }: { label: string; source: string }) {
  const tint = source === "github"
    ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
    : source === "huggingface"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
  return (
    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${tint}`}>
      {label.trim().slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}

function SourceList({ source, items }: { source: string; items: ProjectShowcaseItem[] }) {
  const { t } = useLang();
  return (
    <section className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        {sourceLabel(source, t)}
      </h3>
      <div className="space-y-1">
        {items.map((item) => {
          const label = displayName(item);
          const content = (
            <div className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-white/80 dark:hover:bg-zinc-800/70">
              {item.icon_url ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] dark:border-zinc-700 dark:bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.icon_url}
                    alt=""
                    className="h-full w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </span>
              ) : (
                <FallbackIcon label={label} source={source} />
              )}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-xs font-medium leading-5 text-zinc-900 dark:text-zinc-100" title={item.name}>
                  {label}
                </div>
                <div className="shrink-0 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                  {metricLabel(source, item, t)}
                </div>
              </div>
            </div>
          );
          return item.url ? (
            <a key={`${source}-${item.rank}-${item.name}`} href={item.url} target="_blank" rel="noopener noreferrer" className="block">
              {content}
            </a>
          ) : (
            <div key={`${source}-${item.rank}-${item.name}`}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}

export function ProjectShowcaseBlock({ entry }: Props) {
  const { t } = useLang();
  if (!entry) return null;
  const sources = ["github", "huggingface", "kaggle"].filter((key) => (entry.sources[key] || []).length > 0);
  if (!sources.length) return null;

  return (
    <aside className="detail-enter-2 space-y-3">
      <div className="relative rounded-2xl border border-zinc-200 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              {t("detail.popularProjects")}
            </h2>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-zinc-500 dark:text-zinc-400" title={entry.title}>
              {entry.title}
            </p>
          </div>
          <span className="pointer-events-none shrink-0 text-3xl leading-none" aria-hidden="true">🏆</span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {sources.map((source) => (
            <SourceList key={source} source={source} items={entry.sources[source]} />
          ))}
        </div>
      </div>
    </aside>
  );
}
