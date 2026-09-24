"use client";

import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/badge";
import { useRouter } from "next/navigation";
import { resolveTrackerEntry, hasReviewContent } from "@/lib/tracker-match";
import { statusLabel } from "@/components/tracker/tracker-card";
import { formatTrackerDate } from "@/lib/tracker-date";
import { cleanTrackerPoint } from "@/lib/tracker-point";

function sourceLabel(source: string | undefined, t: (key: string) => string): string {
  if (source === "license-discuss") return t("tracker.source-discuss");
  if (source === "osi_api") return t("tracker.source-api");
  return t("tracker.source-review");
}

type TrackerEntry = {
  id: string;
  name?: string;
  spdx_id?: string;
  status: string;
  submitter?: string;
  stats?: { total_messages?: number; duration_days?: number; date_range?: string[] };
  has_vote?: boolean;
  has_timeline?: boolean;
  review_dates?: {
    first_submitted?: string;
    decision?: string;
    decision_status?: "approved" | "rejected" | "";
  };
  timeline_meta?: { count?: number; first?: string; last?: string };
  latest_event?: {
    date?: string;
    type?: string;
    source?: string;
    sender?: string;
    subject?: string;
    sentiment?: string;
    point?: string;
    point_zh?: string;
  } | null;
};

export function LicenseReviewBlock({ license }: {
  license: { spdx_id?: string; slug?: string; family?: string; title?: string };
}) {
  const { t, lang } = useLang();
  const router = useRouter();

  const entry = resolveTrackerEntry(license) as TrackerEntry | null;
  if (!entry) return null; // not reviewed by OSI
  // Legacy entry with no timeline/vote (e.g. BSD-2-Clause) → nothing to link to.
  if (!hasReviewContent(entry)) return null;

  const { status, submitter, stats, has_timeline, has_vote } = entry;
  const days = stats?.duration_days || 0;
  const msgs = stats?.total_messages || 0;
  const reviewDates = entry.review_dates || {};
  const firstSubmitted = reviewDates.first_submitted;
  const decisionDate = reviewDates.decision;
  const decisionLabel = reviewDates.decision_status === "rejected"
    ? t("review.rejectedDate")
    : reviewDates.decision_status === "approved"
      ? t("review.approvedDate")
      : "";
  const decisionIcon = reviewDates.decision_status === "rejected" ? "✗" : "✓";
  const latest = entry.latest_event;
  const latestPoint = latest ? cleanTrackerPoint(lang === "zh" ? latest.point_zh || latest.point : latest.point) : "";

  // Compressed strip: a visual tease of the timeline shape.
  // Derive node count from timeline_meta.count (capped for layout).
  const tlMeta = entry.timeline_meta || {};
  const rawCount = tlMeta.count || 0;
  const nodeCount = Math.min(rawCount, 24);

  const focusKey = entry.id || entry.spdx_id || "";
  function viewFull() {
    router.push(`/tracker?focus=${encodeURIComponent(focusKey)}`);
  }

  return (
    <section className="detail-enter-3 relative z-0 mt-6 mb-8 rounded-2xl border border-zinc-200/60 bg-white/60 p-5 backdrop-blur-xl hover:z-30 focus-within:z-30 dark:border-zinc-800/60 dark:bg-zinc-900/40">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {t("review.title")}
          </h2>
        </div>
        <Badge variant="tag" themeKey={`review-${status}`}>{statusLabel(t, status)}</Badge>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
        <span>👤 {submitter}</span>
        {firstSubmitted && <span>🗓️ {t("review.firstSubmitted")}: {formatTrackerDate(firstSubmitted)}</span>}
        {decisionDate && decisionLabel && <span>{decisionIcon} {decisionLabel}: {formatTrackerDate(decisionDate)}</span>}
        {days > 0 && <span>📅 {days} {t("tracker.days")}</span>}
        {msgs > 0 && <span>💬 {msgs} {t("tracker.events")}</span>}
        {has_vote && <span>🗳️ {t("tracker.tabVote")}</span>}
      </div>

      {has_timeline && nodeCount > 0 && (
        <button
          onClick={viewFull}
          className="group flex w-full items-center gap-2 rounded-lg bg-violet-50/50 p-2 text-left dark:bg-violet-900/10"
          aria-label={t("tracker.viewFull")}
        >
          <span className="shrink-0 rounded-md bg-[#7c3aed]/10 px-2 py-0.5 text-xs font-semibold text-[#6d28d9] dark:bg-[#a78bfa]/15 dark:text-[#c4b5fd]">
            {rawCount} {t("tracker.events")}
          </span>
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {Array.from({ length: nodeCount }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-violet-400/70 transition-transform group-hover:scale-125 dark:bg-violet-400/50"
                style={{ opacity: 0.35 + 0.65 * (i / Math.max(1, nodeCount - 1)) }}
              />
            ))}
            {rawCount > 24 && (
              <span className="ml-1 text-xs text-zinc-400">+{rawCount - 24}</span>
            )}
          </span>
        </button>
      )}

      {latestPoint && (
        <div className="mt-3 rounded-lg border border-violet-100/70 bg-violet-50/40 px-3 py-2 text-xs leading-relaxed text-zinc-700 dark:border-violet-900/30 dark:bg-violet-900/10 dark:text-zinc-300">
          <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span>{t("review.latest")}</span>
            {latest?.sender && <span>👤 {latest.sender}</span>}
            {latest?.date && <span>📅 {formatTrackerDate(latest.date)}</span>}
            {latest?.source && <span>{sourceLabel(latest.source, t)}</span>}
          </div>
          <span className="block min-h-[3.75rem]">{latestPoint}</span>
        </div>
      )}

      <button
        onClick={viewFull}
        className="mt-3 text-sm font-medium text-[#7c3aed] transition-colors hover:text-[#6d28d9] dark:text-[#a78bfa]"
      >
        {t("tracker.viewFull")}
      </button>
    </section>
  );
}
