// SPDX-License-Identifier: MulanPSL-2.0

import type { TrackerBoardVote } from "@/lib/types";

// OSI minutes sometimes record only a qualitative outcome ("Passed unanimously",
// "passed by majority") without exact yes/no/abstain counts. The KB pipeline uses
// -1 as a sentinel for "unknown count". This module turns a board vote into a
// display shape so the UI never shows a raw -1.

export type VoteShape =
  | { kind: "exact"; yes: number; no: number; abstain: number; unanimous: boolean }
  // Unanimous passage, total voter count not recorded. abstain is known if >= 0.
  | { kind: "unanimous"; abstain: number | null }
  // Passed by majority, exact yes/no not recorded. abstain is known if >= 0.
  | { kind: "majority"; abstain: number | null }
  | { kind: "none" };

export function describeVote(vote: TrackerBoardVote | null | undefined): VoteShape {
  if (!vote?.vote) return { kind: "none" };
  const v = vote.vote;
  if (v.yes >= 0 && v.abstain >= 0) {
    return {
      kind: "exact",
      yes: v.yes,
      no: v.no,
      abstain: v.abstain,
      unanimous: !!v.unanimous && v.no === 0 && v.abstain === 0,
    };
  }
  const abstain = v.abstain >= 0 ? v.abstain : null;
  if (v.unanimous) return { kind: "unanimous", abstain };
  return { kind: "majority", abstain };
}

// Compact label for the timeline vote node, e.g. "✓9 ✗0 △0". Empty string when
// the exact tally is unknown (caller renders a check/cross glyph instead).
export function voteCompactLabel(vote: TrackerBoardVote | null | undefined): string {
  const shape = describeVote(vote);
  if (shape.kind === "exact") return `✓${shape.yes} ✗${shape.no} △${shape.abstain}`;
  return "";
}

// Whether the vote has any recorded detail (exact counts or a qualitative outcome).
export function hasVoteDetail(vote: TrackerBoardVote | null | undefined): boolean {
  return describeVote(vote).kind !== "none";
}
