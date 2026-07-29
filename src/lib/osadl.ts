import osadlIndexJson from "@/data/osadl-checklists-index.json";
import type { License, OsadlChecklistEntry, OsadlIndex, OsadlIndexMeta } from "@/lib/types";

const osadlIndex = osadlIndexJson as OsadlIndex;

function normSpdx(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

// OSADL tracks current SPDX license-expression IDs. LicenseAtlas still keeps
// several deprecated SPDX IDs as canonical detail pages because they are common
// search targets. The deprecated GNU IDs without a suffix correspond to the
// modern "-only" form, not "-or-later".
const DEPRECATED_SPDX_OSADL_MAP: Record<string, string> = {
  "gpl-1.0": "gpl-1.0-only",
  "gpl-2.0": "gpl-2.0-only",
  "gpl-3.0": "gpl-3.0-only",
  "lgpl-2.0": "lgpl-2.0-only",
  "lgpl-2.1": "lgpl-2.1-only",
};

export const osadlMeta: OsadlIndexMeta = osadlIndex._meta;

const SCANCODE_SLUG_OSADL_MAP: Record<string, string> = {
  "bsla-no-advert": "licenseref-scancode-bsla-no-advert",
  "info-zip-2003-05": "licenseref-scancode-info-zip-2003-05",
  "ppp": "licenseref-scancode-ppp",
  "bzip2-libbzip-1.0.5": "bzip2-1.0.5",
};

export function resolveOsadlChecklist(
  license: Pick<License, "spdx_id" | "slug">,
): OsadlChecklistEntry | null {
  const key = normSpdx(license.spdx_id);
  const slug = normSpdx(license.slug);
  return (key && (osadlIndex.by_spdx[key] || osadlIndex.by_spdx[DEPRECATED_SPDX_OSADL_MAP[key]]))
    || osadlIndex.by_spdx[SCANCODE_SLUG_OSADL_MAP[slug]]
    || null;
}
