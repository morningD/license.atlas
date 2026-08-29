// Resolve a license-atlas license → OSI tracker index entry.
// Multi-level matching because many tracker submissions have no SPDX id
// (still under OSI review). KB is the source of truth and cannot be edited,
// so the bridging happens here.

import trackerIndex from "@/data/tracker-index.json";

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

type TrackerIndex = { _meta?: Record<string, unknown> } & Record<string, TrackerEntry>;

const INDEX = trackerIndex as unknown as TrackerIndex;
const norm = (s: string) => (s || "").trim().toLowerCase();

// family → tracker index key (normalized id). Built once.
// Covers cases where one OSI submission reviews a whole family of licenses
// (e.g. all ModelGo variants are reviewed together under one thread).
const FAMILY_MAP: Record<string, string> = {
  modelgo: "modelgo-attribution-v2",
};

// name/slug → index key. Last-resort fallback for entries whose Atlas title/slug
// differs from the OSI tracker id. Only add explicit, verified mappings here.
const NAME_MAP: Record<string, string> = {
  "toppers license agreement": "toppers-license",
  "jabber open source license": "jabberpl",
  "collaborative virtual workspace license": "cvw",
  "the beer-ware license": "beer-ware-license",
  "transitive grace period public licence 1.0": "transitive-grace-period",
  "mulan public license version 2": "mulan-public-license-v2-resubmission",
  "3d slicer license 1.0": "3d-slicer-license",
  "libpng license": "libpng-v2",
  "server side public license, v 1": "sspl-v1",
  "educational community license v1.0": "educational-community-license-1",
  "convertible free software license v1.1": "c-fsl-v1-1",
};

const SLUG_MAP: Record<string, string> = {
  "toppers-license": "toppers-license",
  "jabber-open-source-license": "jabberpl",
  "cvwl": "cvw",
  "beerware": "beer-ware-license",
  "tgppl-1.0": "transitive-grace-period",
  "mulanpubl-2.0": "mulan-public-license-v2-resubmission",
  "3d-slicer-1.0": "3d-slicer-license",
  "libpng": "libpng-v2",
  "sspl-1.0": "sspl-v1",
  "ecl-1.0": "educational-community-license-1",
  "c-fsl-1.1": "c-fsl-v1-1",
  "los-alamos-national-labs-bsd-3-variant": "los-alamos-national-labs-bsd-3-variant",
  // The 2026 python-2-0 thread reviewed the PSF-2.0 text family as a set
  // ("Python-2.0.1, PSF-2.0, and CNRI-Python-GPL-Compatible"); the OSI API
  // models all of them under the single Python-2.0 entry.
  "psf-2.0": "python-2-0",
  "python-2.0.1": "python-2-0",
  "cnri-python-gpl-compatible": "python-2-0",
};

/**
 * Find the tracker entry for a license. Returns null when the license was
 * not reviewed by OSI (no entry / legacy entry with no content to show).
 */
export function resolveTrackerEntry(license: {
  spdx_id?: string;
  slug?: string;
  family?: string;
  title?: string;
}): TrackerEntry | null {
  // 1. SPDX id (the common path).
  if (license.spdx_id) {
    const hit = INDEX[norm(license.spdx_id)];
    if (hit) return hit;
  }
  // 2. Direct slug/id match, then explicit slug aliases.
  if (license.slug) {
    const slug = norm(license.slug);
    const hit = INDEX[slug];
    if (hit) return hit;
    const key = SLUG_MAP[slug];
    if (key && INDEX[key]) return INDEX[key];
  }
  // 3. Family mapping (e.g. ModelGo).
  if (license.family) {
    const key = FAMILY_MAP[norm(license.family)];
    if (key && INDEX[key]) return INDEX[key];
  }
  // 4. Explicit name mapping.
  if (license.title) {
    const key = NAME_MAP[norm(license.title)];
    if (key && INDEX[key]) return INDEX[key];
  }
  return null;
}

/** Whether a tracker entry has any review content worth linking to. */
export function hasReviewContent(e: TrackerEntry): boolean {
  if (!e) return false;
  if (e.has_timeline && (e.timeline_meta?.count || 0) > 0) return true;
  if (e.has_vote) return true;
  return false;
}
