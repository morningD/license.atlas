// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/badge";
import type { TrackerIndexEntry, TrackerSubmission } from "@/lib/types";
import { TimelineStrip } from "./timeline-strip";
import { ReviewDetailTabs } from "./review-detail-tabs";

// Translate a TrackerStatus into the current language's label (falls back to capitalized status).
export function statusLabel(t: (k: string) => string, status: string): string {
  const key = `tracker.status-${status}`;
  const translated = t(key);
  return translated !== key ? translated : status.charAt(0).toUpperCase() + status.slice(1);
}

type TimelineSource = "review" | "discuss" | "all";

function defaultTimelineSource(timeline: TrackerSubmission["timeline"]): TimelineSource {
  const reviewCount = timeline.filter((e) => e.source !== "license-discuss").length;
  if (reviewCount > 0) return "review";
  const discussCount = timeline.filter((e) => e.source === "license-discuss").length;
  return discussCount > 0 ? "discuss" : "all";
}

export const TrackerCard = memo(function TrackerCard({
  s, expanded, onToggleExpand,
}: {
  s: TrackerSubmission | TrackerIndexEntry;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}) {
  const { t } = useLang();
  const full = "timeline" in s;
  const submitter = full ? s.submitter?.name || t("tracker.unknown") : s.submitter || t("tracker.unknown");
  const msgs = s.stats?.total_messages || 0;
  const days = s.stats?.duration_days || 0;
  const fullTimeline = full ? s.timeline : undefined;
  const timeline = useMemo(() => fullTimeline || [], [fullTimeline]);
  const participantCount = full ? s.participants.length : 0;
  const detailCount = full
    ? timeline.length + participantCount + (s.license_texts?.length || 0) + (s.board_vote ? 1 : 0)
    : ((s.timeline_meta?.count || 0) + (s.text_meta?.count || 0) + (s.has_vote ? 1 : 0));
  const loadingDetails = expanded && !full;

  // Lifted tab + focus + source-filter state so strip-node clicks can drive the detail panel.
  const [tab, setTab] = useState<"timeline" | "participants" | "texts" | "vote">("timeline");
  const [src, setSrc] = useState<TimelineSource>("review");
  const [focusEventIdx, setFocusEventIdx] = useState<number | null>(null);
  const sourceTouchedRef = useRef(false);

  useEffect(() => {
    if (full && timeline.length > 0 && !sourceTouchedRef.current) {
      setSrc(defaultTimelineSource(timeline));
    }
  }, [full, timeline]);

  function setTimelineSource(next: TimelineSource) {
    sourceTouchedRef.current = true;
    setSrc(next);
  }

  // Clicking a strip node: force-open this card, switch to timeline tab, ensure the event's
  // source is visible, and flash the event row.
  function handleNodeClick(targetTab: string, idx: number) {
    if (!expanded) onToggleExpand(s.id);
    setTab("timeline");
    setFocusEventIdx(idx);
    // Ensure the clicked event's source is visible: if current src filters it out, widen to "all".
    const ev = timeline[idx];
    if (ev && src !== "all") {
      const isDiscuss = ev.source === "license-discuss";
      if (src === "review" && isDiscuss) setTimelineSource("all");
      if (src === "discuss" && !isDiscuss) setTimelineSource("all");
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`ev-${s.id}-${idx}`);
      flash(el);
    });
  }

  function focusTimelineEvent(idx: number) {
    setTab("timeline");
    setFocusEventIdx(idx);
    const ev = timeline[idx];
    if (ev && src !== "all") {
      const isDiscuss = ev.source === "license-discuss";
      if (src === "review" && isDiscuss) setTimelineSource("all");
      if (src === "discuss" && !isDiscuss) setTimelineSource("all");
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`ev-${s.id}-${idx}`);
      flash(el);
    });
  }

  function flash(el: HTMLElement | null) {
    if (!el) return;
    el.scrollIntoView({ behavior: "auto", block: "center" });
    el.classList.remove("tracker-flash");
    void el.offsetWidth;
    el.classList.add("tracker-flash");
    setTimeout(() => el.classList.remove("tracker-flash"), 1700);
  }

  // Clicking the vote node → expand + vote tab.
  function handleVoteClick() {
    if (!expanded) onToggleExpand(s.id);
    setTab("vote");
    setFocusEventIdx(null);
  }

  return (
    <div
      id={`card-${s.id}`}
      className={`relative z-0 mb-3 rounded-2xl border border-zinc-200/60 bg-white/60 p-5 backdrop-blur-xl transition hover:z-30 hover:shadow-lg focus-within:z-30 dark:border-zinc-800/60 dark:bg-zinc-900/40 ${expanded ? "" : "cursor-pointer hover:-translate-y-px"}`}
    >
      <div className="flex items-start justify-between gap-3" onClick={() => !expanded && onToggleExpand(s.id)}>
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {s.name} <span className="text-xs font-normal text-zinc-400">{s.spdx_id ? `(${s.spdx_id})` : ""}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>👤 {submitter}</span>
            {days > 0 && <span>📅 {days} {t("tracker.days")}</span>}
            {msgs > 0 && <span>💬 {msgs} {t("tracker.events")}</span>}
            {full && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand(s.id); setTab("participants"); }}
                className="cursor-pointer hover:text-[#7c3aed] dark:hover:text-[#a78bfa]"
              >
                👥 {participantCount} {t("tracker.participants")}
              </button>
            )}
            {!full && detailCount > 0 && <span>⌛ {detailCount} {t("tracker.events")}</span>}
          </div>
        </div>
        <Badge variant="tag" themeKey={`review-${s.status}`}>{statusLabel(t, s.status)}</Badge>
      </div>

      {full && timeline.length > 0 && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <TimelineStrip timeline={timeline} submitter={submitter} vote={s.board_vote} onNodeClick={handleNodeClick} onVoteClick={handleVoteClick} />
        </div>
      )}

      <button
        className="mt-3 border-none bg-none p-0 text-sm font-medium text-[#7c3aed] hover:underline dark:text-[#a78bfa]"
        onClick={() => onToggleExpand(s.id)}
      >
        {loadingDetails ? t("tracker.loadingDetails") : expanded ? t("tracker.collapse") : t("tracker.expand")}
      </button>

      {loadingDetails && (
        <div className="mt-4 border-t border-zinc-200/60 pt-4 text-sm text-zinc-500 dark:border-zinc-800/60 dark:text-zinc-400">
          {t("tracker.loadingDetails")}
        </div>
      )}

      {expanded && full && (
        <ReviewDetailTabs
          s={s}
          tab={tab}
          setTab={setTab}
          src={src}
          setSrc={setTimelineSource}
          focusEventIdx={focusEventIdx}
          focusTimelineEvent={focusTimelineEvent}
          clearFocus={() => setFocusEventIdx(null)}
        />
      )}
    </div>
  );
});
