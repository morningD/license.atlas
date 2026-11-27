// SPDX-License-Identifier: MulanPSL-2.0

// Sync OSADL checklist data from KB -> license-atlas.
// Hash-gated and safe for CI: if KB is unavailable but committed outputs exist,
// keep using the committed sidecar data.
// Run: node scripts/sync-osadl.mjs [--kb-path <path>]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const INDEX_SCHEMA_VERSION = 2;

function resolveKbPath() {
  const flagIdx = process.argv.indexOf("--kb-path");
  if (flagIdx !== -1) {
    const kbPathArg = process.argv[flagIdx + 1];
    if (!kbPathArg || kbPathArg.startsWith("-")) {
      console.error("✗ Missing value for --kb-path");
      console.error("  Usage: node scripts/sync-osadl.mjs [--kb-path <path>]");
      process.exit(1);
    }
    return resolve(kbPathArg);
  }
  if (process.env.KB_PATH) return resolve(process.env.KB_PATH);
  return resolve(ROOT, "..", "KB");
}

const KB_ROOT = resolveKbPath();
const KB_DIR = resolve(KB_ROOT, "data", "osadl", "checklists");
const KB_FULL = resolve(KB_DIR, "osadl-checklists.json");
const KB_INDEX = resolve(KB_DIR, "osadl-checklists-index.json");
const KB_MATCH = resolve(KB_DIR, "match-report.json");

const ATLAS_FULL = resolve(ROOT, "public", "data", "osadl-checklists.json");
const ATLAS_INDEX = resolve(ROOT, "src", "data", "osadl-checklists-index.json");
const ATLAS_META = resolve(ROOT, "src", "data", "osadl-meta.json");
const ATLAS_LICENSES = resolve(ROOT, "src", "data", "licenses-index.json");

const DEPRECATED_SPDX_OSADL_MAP = {
  "gpl-1.0": "gpl-1.0-only",
  "gpl-2.0": "gpl-2.0-only",
  "gpl-3.0": "gpl-3.0-only",
  "lgpl-2.0": "lgpl-2.0-only",
  "lgpl-2.1": "lgpl-2.1-only",
};

const SCANCODE_SLUG_OSADL_MAP = {
  "bsla-no-advert": "licenseref-scancode-bsla-no-advert",
  "info-zip-2003-05": "licenseref-scancode-info-zip-2003-05",
  "ppp": "licenseref-scancode-ppp",
  "bzip2-libbzip-1.0.5": "bzip2-1.0.5",
};

function stablePayload(...values) {
  const copies = values.map((value) => {
    const copy = JSON.parse(JSON.stringify(value));
    if (copy.meta) delete copy.meta.generated_at;
    if (copy.generated_at) delete copy.generated_at;
    return copy;
  });
  return JSON.stringify(copies);
}

function normKey(value) {
  return String(value || "").trim().toLowerCase();
}

function capList(values, max) {
  return Array.isArray(values) ? values.slice(0, max) : [];
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function compactActions(actions, max) {
  return capList(actions, max).map((item) => ({
    text: item.text || "",
    use_case: item.use_case || null,
    condition: item.condition || null,
  }));
}

function compactRecord(record) {
  const summary = record.summary || {};
  return {
    spdx_id: record.spdx_id,
    slug: record.slug,
    source_urls: record.source_urls || {},
    has_raw_txt: !!record.has_raw_txt,
    copyleft: record.copyleft || "Unknown",
    source_disclosure: record.source_disclosure || "Unknown",
    patent_hints: summary.patent_hints || null,
    copyleft_clause: summary.copyleft_clause || null,
    raw_hash: record.raw_hash || "",
    use_cases: uniqueStrings(summary.use_cases),
    conditions: uniqueStrings(summary.conditions),
    obligations: compactActions(summary.obligations, 24),
    prohibitions: compactActions(summary.prohibitions, 16),
    compatibility_samples: {
      compatible: capList(summary.compatibility, 16),
      incompatible: capList(summary.incompatibility, 16),
      check_dependency: capList(summary.depending_compatibility, 16),
    },
    counts: {
      use_cases: summary.use_cases?.length || 0,
      conditions: summary.conditions?.length || 0,
      obligations: summary.obligations?.length || 0,
      prohibitions: summary.prohibitions?.length || 0,
    },
    compatibility_summary: record.compatibility_summary || {
      yes: 0,
      no: 0,
      same: 0,
      unknown: 0,
      check_dependency: 0,
    },
  };
}

const kbInputsPresent = existsSync(KB_FULL) && existsSync(KB_INDEX) && existsSync(KB_MATCH);

if (!kbInputsPresent) {
  if (existsSync(ATLAS_FULL) && existsSync(ATLAS_INDEX) && existsSync(ATLAS_META)) {
    const existing = JSON.parse(readFileSync(ATLAS_META, "utf8"));
    console.log(`✓ OSADL KB data not found at ${KB_DIR}`);
    console.log(`  Using committed OSADL sidecar data (hash ${existing?.source_hash || "unknown"}).`);
    process.exit(0);
  }
  console.error(`✗ OSADL KB data not found at ${KB_DIR}`);
  console.error("  Run KB `npm run crawl:osadl && npm run build:osadl`, pass --kb-path <path>, or commit Atlas sidecar outputs.");
  process.exit(1);
}

const full = JSON.parse(readFileSync(KB_FULL, "utf8"));
const kbIndex = JSON.parse(readFileSync(KB_INDEX, "utf8"));
const matchReport = JSON.parse(readFileSync(KB_MATCH, "utf8"));
const sourceHash = createHash("sha1")
  .update(stablePayload(full, kbIndex, matchReport))
  .digest("hex")
  .slice(0, 16);

if (existsSync(ATLAS_INDEX) && existsSync(ATLAS_META)) {
  try {
    const existing = JSON.parse(readFileSync(ATLAS_META, "utf8"));
    if (existing?.source_hash === sourceHash && existing?.index_schema_version === INDEX_SCHEMA_VERSION) {
      console.log(`✓ OSADL checklists unchanged (hash ${sourceHash}), skip sync`);
      process.exit(0);
    }
  } catch {
    // Regenerate below.
  }
}

const records = Array.isArray(full.records) ? full.records : [];
const bySpdx = {};
const compactRecords = records.map(compactRecord);
for (const record of compactRecords) {
  if (record.spdx_id) bySpdx[normKey(record.spdx_id)] = record;
}

function atlasDisplayMatchCounts() {
  if (!existsSync(ATLAS_LICENSES)) return matchReport.counts || {};
  const licenses = JSON.parse(readFileSync(ATLAS_LICENSES, "utf8"));
  const atlasSpdx = new Set(licenses.map((license) => normKey(license.spdx_id)).filter(Boolean));
  const atlasSlugs = new Set(licenses.map((license) => normKey(license.slug)).filter(Boolean));
  const reverseDeprecated = Object.fromEntries(
    Object.entries(DEPRECATED_SPDX_OSADL_MAP).map(([deprecated, current]) => [current, deprecated]),
  );
  const reverseSlug = Object.fromEntries(
    Object.entries(SCANCODE_SLUG_OSADL_MAP).map(([atlasSlug, osadlSpdx]) => [osadlSpdx, atlasSlug]),
  );

  let matched = 0;
  const unmatched = [];
  for (const record of compactRecords) {
    const spdx = normKey(record.spdx_id);
    const deprecatedSpdx = reverseDeprecated[spdx];
    const atlasSlug = reverseSlug[spdx];
    if (atlasSpdx.has(spdx) || (deprecatedSpdx && atlasSpdx.has(deprecatedSpdx)) || (atlasSlug && atlasSlugs.has(atlasSlug))) {
      matched++;
    } else {
      unmatched.push(record.spdx_id);
    }
  }

  return {
    ...(matchReport.counts || {}),
    matched,
    osadl_unmatched: unmatched.length,
    osadl_unmatched_ids: unmatched,
  };
}

const meta = {
  source_hash: sourceHash,
  index_schema_version: INDEX_SCHEMA_VERSION,
  generated_at: full.meta?.generated_at || "",
  source: full.meta?.source || "OSADL Open Source License Checklists",
  source_url: full.meta?.source_url || "",
  checklist_project_url: full.meta?.checklist_project_url || "",
  compatibility_notes_url: full.meta?.compatibility_notes_url || "",
  osloc2json_url: full.meta?.osloc2json_url || "",
  raw_data_license: full.meta?.raw_data_license || "Creative Commons Attribution 4.0 International license (CC-BY-4.0)",
  attribution: full.meta?.attribution || "",
  copyright: full.meta?.copyright || "",
  disclaimer: full.meta?.disclaimer || "",
  draft_note: full.meta?.draft_note || "",
  timestamp: full.meta?.timestamp || "",
  matrix_timestamp: full.meta?.matrix_timestamp || "",
  record_count: records.length,
  matrix_license_count: full.meta?.matrix_license_count || 0,
  match_counts: atlasDisplayMatchCounts(),
};

const atlasIndex = {
  _meta: meta,
  by_spdx: bySpdx,
};

mkdirSync(dirname(ATLAS_FULL), { recursive: true });
mkdirSync(dirname(ATLAS_INDEX), { recursive: true });
copyFileSync(KB_FULL, ATLAS_FULL);
writeFileSync(ATLAS_INDEX, JSON.stringify(atlasIndex, null, 2));
writeFileSync(ATLAS_META, JSON.stringify(meta, null, 2));

console.log(`✓ Synced ${records.length} OSADL checklist records -> public/data/osadl-checklists.json + src/data/osadl-checklists-index.json + src/data/osadl-meta.json`);
console.log(`  source_hash: ${sourceHash}`);
console.log(`  matched Atlas SPDX IDs: ${meta.match_counts?.matched || meta.match_counts?.matched_exact || 0}/${records.length}`);
