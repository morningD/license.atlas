// Sync the core LicenseAtlas license corpus from the sibling KB checkout.
// This covers the main license full texts and cleaned metadata, distinct from
// sidecars such as tracker, OSADL, and project showcase data.
// Run: node scripts/sync-license-corpus.mjs [--kb-path <path>]
// New hand-discovered license slugs are blocked by default. Trusted paths:
// - Structured sources such as ScanCode LicenseDB (after KB clean/dedupe).
// - Slugs present in KB custom-license confirmed manifests — HF and GitHub
//   customs now land there via GLM --llm-review (validated 2026-08-24), so
//   they count as reviewed and sync without manual allowlisting.
// Anything else still needs --allow-new-licenses / --allow-new-license <slug>.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const allowNewLicenses = process.argv.includes("--allow-new-licenses");
const allowedNewSlugs = new Set(
  process.argv
    .flatMap((arg, i, arr) => {
      if (arg === "--allow-new-license" && arr[i + 1] && !arr[i + 1].startsWith("-")) return [arr[i + 1]];
      if (arg.startsWith("--allow-new-license=")) return [arg.split("=", 2)[1]];
      return [];
    })
    .filter(Boolean),
);

function resolveKbPath() {
  const flagIdx = process.argv.indexOf("--kb-path");
  if (flagIdx !== -1) {
    const kbPathArg = process.argv[flagIdx + 1];
    if (!kbPathArg || kbPathArg.startsWith("-")) {
      console.error("✗ Missing value for --kb-path");
      process.exit(1);
    }
    return resolve(kbPathArg);
  }
  if (process.env.KB_PATH) return resolve(process.env.KB_PATH);
  return resolve(ROOT, "..", "KB");
}

const KB_ROOT = resolveKbPath();

// Slugs with a confirmed custom-license entry (GLM-reviewed or human-confirmed)
// in KB: hf-custom-licenses and gh-custom-licenses manifests.
function confirmedCustomSlugs() {
  const slugs = new Set();
  const manifests = [
    join(KB_ROOT, "data", "hf-hub-stats", "hf-custom-licenses", "confirmed", "manifest.json"),
    join(KB_ROOT, "data", "github-stats", "gh-custom-licenses", "confirmed", "manifest.json"),
  ];
  for (const path of manifests) {
    if (!existsSync(path)) continue;
    try {
      const entries = JSON.parse(readFileSync(path, "utf8"));
      for (const e of entries || []) {
        const file = e.cleaned_file || "";
        if (!e.is_standard && file) slugs.add(file.replace(/^confirmed\//, "").replace(/\.md$/, ""));
      }
    } catch {}
  }
  return slugs;
}

const CONFIRMED_CUSTOM_SLUGS = confirmedCustomSlugs();

function sha1File(...files) {
  const h = createHash("sha1");
  for (const file of files) h.update(readFileSync(file));
  return h.digest("hex").slice(0, 16);
}

function sha1Text(text) {
  return createHash("sha1").update(text).digest("hex").slice(0, 16);
}

function countBy(arr, getKeys) {
  const out = {};
  for (const item of arr) {
    const keys = getKeys(item);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      out[key] = (out[key] || 0) + 1;
    }
  }
  return out;
}

function recomputeStats(licenses, sourceStats) {
  return {
    ...sourceStats,
    total: licenses.length,
    osi_approved: licenses.filter((l) => l.osi_approved).length,
    fsf_libre: licenses.filter((l) => l.fsf_libre).length,
    proprietary: licenses.filter((l) => l.proprietary).length,
    by_type: countBy(licenses, (l) => l.type || "other"),
    by_source: countBy(licenses, (l) => (l.sources || []).map((s) => s.name)),
  };
}

function isTrustedStructuredNewLicense(license) {
  const sourceNames = (license.sources || []).map((source) => source.name || "");
  if (sourceNames.some((name) => name === "scancode-licensedb.aboutcode.org")) return true;
  // OSI review corpus merges (KB merge-osi-review-into-corpus.mjs): entries
  // built from OSI mailing-list review threads, structured and LLM-enriched.
  if (sourceNames.some((name) => name === "lists.opensource.org")) return true;
  return CONFIRMED_CUSTOM_SLUGS.has(license.slug);
}

const KB_DIR = resolve(KB_ROOT, "data", "licenses", "cleaned");
const KB_LICENSES = resolve(KB_DIR, "licenses.json");
const KB_INDEX = resolve(KB_DIR, "licenses-index.json");
const KB_STATS = resolve(KB_DIR, "stats.json");

const ATLAS_LICENSES = resolve(ROOT, "src", "data", "licenses.json");
const ATLAS_INDEX = resolve(ROOT, "src", "data", "licenses-index.json");
const ATLAS_STATS = resolve(ROOT, "src", "data", "stats.json");

const required = [KB_LICENSES, KB_INDEX, KB_STATS];
if (!required.every(existsSync)) {
  if ([ATLAS_LICENSES, ATLAS_INDEX, ATLAS_STATS].every(existsSync)) {
    console.log(`✓ KB cleaned license corpus not found at ${KB_DIR}`);
    console.log("  Using committed Atlas license corpus.");
    process.exit(0);
  }
  console.error(`✗ KB cleaned license corpus missing under ${KB_DIR}`);
  process.exit(1);
}

const sourceHash = sha1File(KB_LICENSES, KB_INDEX, KB_STATS);
const existingHash = [ATLAS_LICENSES, ATLAS_INDEX, ATLAS_STATS].every(existsSync)
  ? sha1File(ATLAS_LICENSES, ATLAS_INDEX, ATLAS_STATS)
  : "";

if (sourceHash === existingHash) {
  console.log(`✓ License corpus unchanged (hash ${sourceHash}), skip sync`);
  process.exit(0);
}

mkdirSync(dirname(ATLAS_LICENSES), { recursive: true });
let licenses = JSON.parse(readFileSync(KB_LICENSES, "utf8"));
let index = JSON.parse(readFileSync(KB_INDEX, "utf8"));
let stats = JSON.parse(readFileSync(KB_STATS, "utf8"));
let effectiveSourceHash = sourceHash;

if (!allowNewLicenses && existsSync(ATLAS_INDEX)) {
  const atlasIndex = JSON.parse(readFileSync(ATLAS_INDEX, "utf8"));
  const atlasSlugs = new Set(atlasIndex.map((license) => license.slug));
  const newLicenses = index.filter((license) => !atlasSlugs.has(license.slug));
  const trustedNewLicenses = newLicenses.filter(isTrustedStructuredNewLicense);
  const trustedNewSlugs = new Set(trustedNewLicenses.map((license) => license.slug));
  const blockedNewLicenses = newLicenses.filter((license) =>
    !trustedNewSlugs.has(license.slug) && !allowedNewSlugs.has(license.slug)
  );

  if (blockedNewLicenses.length > 0 && allowedNewSlugs.size === 0) {
    console.error(`✗ Refusing to sync ${blockedNewLicenses.length} new license slug(s) before confirmation.`);
    console.error("  Run the KB dedupe + LLM cleanup + confirmation workflow first, then rerun with --allow-new-license <slug> for each confirmed new slug, or --allow-new-licenses after reviewing all.");
    console.error("  New candidates:");
    for (const license of blockedNewLicenses) {
      const sources = (license.sources || []).map((source) => `${source.name}: ${source.url}`).join(" | ");
      console.error(`  - ${license.slug} :: ${license.title}${sources ? ` (${sources})` : ""}`);
    }
    process.exit(2);
  }

  if (blockedNewLicenses.length > 0 && allowedNewSlugs.size > 0) {
    const keep = new Set([...atlasSlugs, ...trustedNewSlugs, ...allowedNewSlugs]);
    const before = licenses.length;
    licenses = licenses.filter((license) => keep.has(license.slug));
    index = index.filter((license) => keep.has(license.slug));
    stats = recomputeStats(licenses, stats);
    effectiveSourceHash = sha1Text(JSON.stringify({ licenses, index, stats }));
    console.log(`✓ Allowlisted ${newLicenses.filter((license) => allowedNewSlugs.has(license.slug)).length} confirmed new license slug(s)`);
    console.log(`  Filtered out ${before - licenses.length} unconfirmed new slug(s) from this sync`);
  } else if (allowedNewSlugs.size) {
    console.log(`✓ Allowlisted ${newLicenses.filter((license) => allowedNewSlugs.has(license.slug)).length} confirmed new license slug(s)`);
  }
  if (trustedNewLicenses.length) {
    console.log(`✓ Accepted ${trustedNewLicenses.length} trusted ScanCode new license slug(s) after KB clean/dedupe`);
  }
}

writeFileSync(ATLAS_LICENSES, JSON.stringify(licenses, null, 2) + "\n");
writeFileSync(ATLAS_INDEX, JSON.stringify(index, null, 2) + "\n");
writeFileSync(ATLAS_STATS, JSON.stringify(stats, null, 2) + "\n");
writeFileSync(
  resolve(ROOT, "src", "data", "license-corpus-meta.json"),
  JSON.stringify({
    source_hash: effectiveSourceHash,
    generated_at: stats.updated || new Date().toISOString().slice(0, 10),
    total: Array.isArray(licenses) ? licenses.length : stats.total,
  }, null, 2),
);

console.log(`✓ Synced ${Array.isArray(licenses) ? licenses.length : stats.total} licenses -> src/data/licenses*.json + stats.json`);
console.log(`  source_hash: ${effectiveSourceHash}`);
