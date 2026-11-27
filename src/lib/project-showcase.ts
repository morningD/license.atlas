// SPDX-License-Identifier: MulanPSL-2.0

import projectShowcaseIndex from "@/data/project-showcase-index.json";
import type { License, ProjectShowcaseIndex, ProjectShowcaseRecord } from "@/lib/types";

const showcase = projectShowcaseIndex as ProjectShowcaseIndex;

function norm(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export const projectShowcaseMeta = showcase._meta;

export function resolveProjectShowcase(license: Pick<License, "slug" | "spdx_id">): ProjectShowcaseRecord | null {
  return showcase.by_slug[license.slug] || showcase.by_slug[norm(license.spdx_id)] || null;
}
