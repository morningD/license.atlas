"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "@/lib/i18n";
import { formatTrackerDate, formatTrackerShortDate } from "@/lib/tracker-date";
import { describeVote, voteCompactLabel } from "@/lib/tracker-vote";
import type { TrackerTimelineEvent, TrackerBoardVote } from "@/lib/types";

// Sentiment → parent tint color (mirrors KB SENT_TINT + SENT_COLOR).
const SENT_TINT: Record<string, string> = {
  positive: "positive", support: "positive",
  negative: "negative", oppose: "negative", critical: "negative",
  question: "question", mixed: "mixed", neutral: "neutral",
};
const SENT_HEX: Record<string, string> = {
  positive: "#10b981", negative: "#ef4444", question: "#8b5cf6",
};
const SENT_BADGE_STYLE: Record<string, { background: string; color: string }> = {
  positive: { background: "rgba(16,185,129,0.14)", color: "#059669" },
  support: { background: "rgba(16,185,129,0.14)", color: "#059669" },
  negative: { background: "rgba(239,68,68,0.14)", color: "#dc2626" },
  oppose: { background: "rgba(239,68,68,0.14)", color: "#dc2626" },
  critical: { background: "rgba(249,115,22,0.14)", color: "#ea580c" },
  question: { background: "rgba(139,92,246,0.14)", color: "#7c3aed" },
  mixed: { background: "rgba(245,158,11,0.14)", color: "#d97706" },
  neutral: { background: "rgba(100,116,139,0.12)", color: "#64748b" },
};
const TYPE_COLOR: Record<string, string> = {
  board_decision: "var(--c-approved, #3DA639)",
  withdrawal: "var(--c-withdrawn, #d97706)",
  revision: "var(--c-superseded, #0284c7)",
  submission: "var(--c-approved, #3DA639)",
  feedback: "var(--c-legacy, #71717a)",
};

function eventTypeLabel(type: string, t: (key: string) => string): string {
  const key = `tracker.type-${type}`;
  const translated = t(key);
  return translated !== key ? translated : type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sentimentLabel(sentiment: string, t: (key: string) => string): string {
  const key = `tracker.sentiment-${sentiment}`;
  const translated = t(key);
  return translated !== key ? translated : sentiment;
}

interface TipState {
  x: number; y: number;
  type: string; typeColor: string; stripeColor: string;
  date: string; sender: string; snip: string;
  submitter?: boolean; sentiment?: string;
}

const TIP_W = 340;
const TIP_OFFSET = 14;

function voteTally(vote: TrackerBoardVote): string {
  return voteCompactLabel(vote);
}

function voteSummary(vote: TrackerBoardVote, t: (key: string) => string): string {
  const outcome = vote.outcome === "rejected" ? t("tracker.voteRejected") : vote.outcome === "approved" ? t("tracker.voteApproved") : t("tracker.voteHeader");
  const shape = describeVote(vote);
  let tally = "";
  if (shape.kind === "exact") {
    tally = `${shape.yes} ${t("tracker.yes")} / ${shape.no} ${t("tracker.no")} / ${shape.abstain} ${t("tracker.abstain")}`;
  } else if (shape.kind === "unanimous") {
    tally = shape.abstain != null ? `${t("tracker.voteUnanimous")} (${shape.abstain} ${t("tracker.abstain")}; ${t("tracker.voteExactCountsNotRecorded")})` : `${t("tracker.voteUnanimous")} (${t("tracker.voteExactCountsNotRecorded")})`;
  } else if (shape.kind === "majority") {
    tally = shape.abstain != null ? `${t("tracker.voteMajority")} (${shape.abstain} ${t("tracker.abstain")}; ${t("tracker.voteExactCountsNotRecorded")})` : `${t("tracker.voteMajority")} (${t("tracker.voteExactCountsNotRecorded")})`;
  }
  const motion = vote.motion_text || "";
  return [outcome, tally, motion].filter(Boolean).join("\n");
}

export function TimelineStrip({
  timeline, submitter, vote, onNodeClick, onVoteClick,
}: {
  timeline: TrackerTimelineEvent[];
  submitter: string;
  vote: TrackerBoardVote | null;
  onNodeClick?: (tab: string, idx: number) => void;
  onVoteClick?: () => void;
}) {
  const { lang, t } = useLang();
  const [tip, setTip] = useState<TipState | null>(null);

  // Clamp tooltip within viewport so it never clips off-screen.
  const tipLeft = tip ? Math.min(tip.x + TIP_OFFSET, window.innerWidth - TIP_W - TIP_OFFSET) : 0;
  const tipTop = tip ? Math.min(tip.y + TIP_OFFSET, window.innerHeight - 160) : 0;

  // Merge timeline events and the board vote into one date-ordered sequence so
  // the vote renders at its chronological position (e.g. between months of
  // pre-vote discussion and later re-submission threads), not appended at the
  // end. Same-date items keep events before the vote (the vote concludes the
  // day). Votes without a date stay at the end.
  type RenderItem =
    | { kind: "event"; ev: TrackerTimelineEvent; idx: number; date: string }
    | { kind: "vote"; date: string };
  const items: RenderItem[] = timeline
    .map((ev, idx) => ({ kind: "event" as const, ev, idx, date: ev.date || "" }));
  if (vote) items.push({ kind: "vote", date: vote.date || "9999-12-31" });
  items.sort((a, b) =>
    a.date.localeCompare(b.date)
    || (a.kind === "vote" ? 1 : 0) - (b.kind === "vote" ? 1 : 0));

  const nodes = items.map((item, pos) => {
    if (item.kind === "vote") {
      const isLast = pos >= items.length - 1;
      return (
        <span key="board-vote" style={{ display: "inline-flex", alignItems: "center" }}>
          {!isLast && <span className="tl-arrow">→</span>}
          <span
            className={`tl-node vote-${vote!.outcome || "neutral"}`}
            onMouseEnter={(e) => setTip({
              x: e.clientX, y: e.clientY,
              type: t("tracker.voteHeader"), typeColor: TYPE_COLOR.board_decision,
              stripeColor: vote!.outcome === "rejected" ? "#ef4444" : TYPE_COLOR.board_decision,
              date: formatTrackerDate(vote!.date),
              sender: "", snip: voteSummary(vote!, t), sentiment: "",
            })}
            onMouseMove={(e) => tip && setTip({ ...tip, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTip(null)}
            onClick={(e) => { e.stopPropagation(); onVoteClick?.(); }}
          >
            {voteTally(vote!) ? `🗳️ ${voteTally(vote!)}` : vote!.outcome === "rejected" ? "🗳️ ✗" : vote!.outcome === "approved" ? "🗳️ ✓" : "🗳️"}
          </span>
        </span>
      );
    }
    const ev = item.ev;
    const i = item.idx;
    const d = formatTrackerShortDate(ev.date);
    const rawType = ev.type || "feedback";
    const label = rawType === "board_decision" ? "✓" : rawType === "withdrawal" ? "✗" : "";
    const typeLabel = eventTypeLabel(rawType, t);
    const colorKey =
      rawType === "board_decision" ? "board_decision"
      : rawType === "withdrawal" ? "withdrawal"
      : rawType === "revision" ? "revision"
      : rawType === "submission" ? "submission" : "feedback";
    const typeColor = TYPE_COLOR[colorKey];
    const sentiment = rawType === "feedback" && ev.sentiment ? ev.sentiment.toLowerCase() : "";
    const tint = SENT_TINT[sentiment] || "neutral";
    const sentClass = tint && tint !== "neutral" ? ` sent-${tint}` : "";
    const nodeHex = tint && tint !== "neutral" ? SENT_HEX[tint] : typeColor;
    const snip = (lang === "zh" ? ev.point_zh || ev.snippet : ev.snippet) || ev.subject || "";
    const isSubmitter = !!(submitter && ev.sender && ev.sender !== "Unknown" && ev.sender === submitter);
    const next = items[pos + 1];
    const isLast = !next;
    const crossesYear = next && ev.date && next.date &&
      ev.date.slice(0, 4) !== next.date.slice(0, 4);

    return (
      <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
        <span
          className={`tl-node ${rawType}${sentClass}${isSubmitter ? " tl-submitter" : ""}`}
          onMouseEnter={(e) => setTip({
            x: e.clientX, y: e.clientY,
            type: typeLabel, typeColor, stripeColor: nodeHex,
            date: formatTrackerDate(ev.date),
            sender: ev.sender && ev.sender !== "Unknown" ? ev.sender : "",
            snip, submitter: isSubmitter, sentiment,
          })}
          onMouseMove={(e) => tip && setTip({ ...tip, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setTip(null)}
          onClick={(e) => { e.stopPropagation(); onNodeClick?.("timeline", i); }}
        >
          {d}{label ? " " + label : ""}
        </span>
        {!isLast && (
          <span className={`tl-arrow${crossesYear ? " tl-cross-year" : ""}`}>
            {crossesYear ? "⇒" : "→"}
          </span>
        )}
      </span>
    );
  });

  return (
    <div className="timeline-strip">
      {nodes}
      {tip && createPortal(
        <div
          className="tl-tip show"
          style={{
            position: "fixed", left: tipLeft, top: tipTop,
            borderColor: tip.stripeColor, zIndex: 9999,
            width: TIP_W, pointerEvents: "none",
          }}
        >
          <div className="tt-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span className="tt-type" style={{ color: tip.typeColor }}>
                {tip.type}
              </span>
              {tip.sentiment && (
                <span
                  className="tt-sentiment"
                  style={{
                    ...(SENT_BADGE_STYLE[tip.sentiment] || SENT_BADGE_STYLE.neutral),
                    borderRadius: 999,
                    padding: "1px 7px",
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    textTransform: "uppercase",
                  }}
                >
                  {sentimentLabel(tip.sentiment, t)}
                </span>
              )}
            </span>
            <span className="tt-date" style={{ color: "#94a3b8" }}>{tip.date}</span>
          </div>
          {tip.sender && <div className="tt-sender" style={{ fontWeight: 600 }}>👤 {tip.sender}</div>}
          <div className="tt-snip" style={{ color: "#64748b", whiteSpace: "pre-wrap" }}>{tip.snip}</div>
        </div>,
        document.body
      )}
    </div>
  );
}
