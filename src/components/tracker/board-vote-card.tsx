// SPDX-License-Identifier: MulanPSL-2.0

"use client";

import { useLang } from "@/lib/i18n";
import { formatTrackerDate } from "@/lib/tracker-date";
import { describeVote } from "@/lib/tracker-vote";
import type { TrackerBoardVote, TrackerStatus } from "@/lib/types";

export function BoardVoteCard({ v, status }: { v: TrackerBoardVote; status: TrackerStatus }) {
  const { t } = useLang();
  void status;
  const oc = v.outcome;
  const ocLabel = oc === "rejected" ? t("tracker.voteRejected") : oc === "approved" ? t("tracker.voteApproved") : "";
  const ocCls = oc === "rejected"
    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
    : oc === "approved"
    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
    : "";
  const voteShape = describeVote(v);
  const hasMotionMeta = !!(v.motion_by || v.second_by);
  const hasVoteDetail = !!(v.motion_text || hasMotionMeta || voteShape.kind !== "none");
  const hasOutcomeOnly = !hasVoteDetail && !!ocLabel;
  const motionLc = (v.motion_text || "").toLowerCase();
  const withhold = /\b(withholds?\s+(?:its\s+)?approval|did\s+not\s+approve|do\s+not\s+approve|decline|reject)\b/.test(motionLc);
  const tallyNote = oc === "rejected" && withhold && voteShape.kind === "exact" && voteShape.yes > (voteShape.no || 0)
    ? <div className="my-2 rounded-lg border-l-[3px] border-red-500 bg-red-50 p-3 text-sm dark:bg-red-900/10">
        ⚠️ {t("tracker.voteRejectNote", { yes: voteShape.yes, no: voteShape.no || 0 })}
      </div>
    : null;

  return (
    <div className="mt-3 rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50/40 to-cyan-50/40 p-4 dark:border-violet-800/40 dark:from-violet-900/10 dark:to-cyan-900/10">
      <div className="mb-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
        🗳️ {t("tracker.voteHeader")} — {formatTrackerDate(v.date)}
        {ocLabel && <span className={`ml-2 rounded px-2 py-0.5 text-xs font-bold ${ocCls}`}>{ocLabel}</span>}
      </div>
      {hasMotionMeta && (
        <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
          {v.motion_by && <><strong>{t("tracker.motion")}:</strong> {v.motion_by}<br /></>}
          {v.second_by && <><strong>{t("tracker.second")}:</strong> {v.second_by}</>}
        </div>
      )}
      {v.motion_text && <div className="my-2 text-sm text-zinc-500 dark:text-zinc-400">{v.motion_text}</div>}
      {tallyNote}
      {voteShape.kind === "exact" ? (
        <div className="flex gap-4 text-sm font-semibold">
          <span className="text-green-600 dark:text-green-400">✓ {voteShape.yes} {t("tracker.yes")}</span>
          <span className="text-red-600 dark:text-red-400">✗ {voteShape.no} {t("tracker.no")}</span>
          <span className="text-zinc-400">○ {voteShape.abstain} {t("tracker.abstain")}</span>
        </div>
      ) : voteShape.kind === "unanimous" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="text-green-600 dark:text-green-400">✓ {t("tracker.voteUnanimous")}</span>
          {voteShape.abstain != null && <span className="text-zinc-400">○ {voteShape.abstain} {t("tracker.abstain")}</span>}
          <span className="text-xs font-normal text-zinc-400">{t("tracker.voteExactCountsNotRecorded")}</span>
        </div>
      ) : voteShape.kind === "majority" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="text-green-600 dark:text-green-400">✓ {t("tracker.voteMajority")}</span>
          {voteShape.abstain != null && <span className="text-zinc-400">○ {voteShape.abstain} {t("tracker.abstain")}</span>}
          <span className="text-xs font-normal text-zinc-400">{t("tracker.voteExactCountsNotRecorded")}</span>
        </div>
      ) : hasOutcomeOnly ? (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={oc === "rejected" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
            {oc === "rejected" ? "✗" : "✓"} {ocLabel}
          </span>
          <span className="text-xs font-normal text-zinc-400">{t("tracker.voteRecordOnly")}</span>
        </div>
      ) : null}
      {v.minutes_url && (
        <div className="mt-2 text-xs">
          <a href={v.minutes_url} target="_blank" rel="noopener noreferrer" className="text-[#7c3aed] hover:underline dark:text-[#a78bfa]">
            {t("tracker.minutes")} ↗
          </a>
        </div>
      )}
    </div>
  );
}
