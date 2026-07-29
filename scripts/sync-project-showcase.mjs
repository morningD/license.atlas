import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
  return resolve(ROOT, "..", "KB");
}

const KB_ROOT = resolveKbPath();
const KB_DIR = resolve(KB_ROOT, "data", "project-showcase");
const KB_FULL = resolve(KB_DIR, "project-showcase.json");
const KB_INDEX = resolve(KB_DIR, "project-showcase-index.json");
const KB_MATCH = resolve(KB_DIR, "match-report.json");

const ATLAS_FULL = resolve(ROOT, "public", "data", "project-showcase.json");
const ATLAS_INDEX = resolve(ROOT, "src", "data", "project-showcase-index.json");
const ATLAS_META = resolve(ROOT, "src", "data", "project-showcase-meta.json");

function stablePayload(...values) {
  return JSON.stringify(values.map((value) => {
    const copy = JSON.parse(JSON.stringify(value));
    if (copy.meta) delete copy.meta.generated_at;
    if (copy.generated_at) delete copy.generated_at;
    if (copy._meta) delete copy._meta.generated_at;
    return copy;
  }));
}

if (!(existsSync(KB_FULL) && existsSync(KB_INDEX) && existsSync(KB_MATCH))) {
  if (existsSync(ATLAS_FULL) && existsSync(ATLAS_INDEX) && existsSync(ATLAS_META)) {
    const meta = JSON.parse(readFileSync(ATLAS_META, "utf8"));
    console.log(`✓ Project showcase KB data not found at ${KB_DIR}`);
    console.log(`  Using committed Atlas sidecar data (hash ${meta.source_hash || "unknown"}).`);
    process.exit(0);
  }
  console.error(`✗ Project showcase KB data not found at ${KB_DIR}`);
  process.exit(1);
}

const full = JSON.parse(readFileSync(KB_FULL, "utf8"));
const index = JSON.parse(readFileSync(KB_INDEX, "utf8"));
const match = JSON.parse(readFileSync(KB_MATCH, "utf8"));

const sourceHash = createHash("sha1")
  .update(stablePayload(full, index, match))
  .digest("hex")
  .slice(0, 16);

if (existsSync(ATLAS_META)) {
  const meta = JSON.parse(readFileSync(ATLAS_META, "utf8"));
  if (meta.source_hash === sourceHash) {
    console.log(`✓ Project showcase unchanged (hash ${sourceHash}), skip sync`);
    process.exit(0);
  }
}

const meta = {
  source_hash: sourceHash,
  generated_at: full.meta?.generated_at || "",
  source: full.meta?.source || "Project Showcase",
  thresholds: full.meta?.thresholds || {},
  record_count: full.meta?.record_count || 0,
  match_counts: match.counts || {},
};

mkdirSync(dirname(ATLAS_FULL), { recursive: true });
mkdirSync(dirname(ATLAS_INDEX), { recursive: true });
copyFileSync(KB_FULL, ATLAS_FULL);
writeFileSync(ATLAS_INDEX, JSON.stringify(index, null, 2));
writeFileSync(ATLAS_META, JSON.stringify(meta, null, 2));

console.log(`✓ Synced ${meta.record_count} project showcase records`);
console.log(`  source_hash: ${sourceHash}`);
