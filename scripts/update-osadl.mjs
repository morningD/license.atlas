// SPDX-License-Identifier: MulanPSL-2.0

// Full-chain orchestrator: refresh OSADL checklist data in KB, rebuild the
// normalized KB sidecar, then sync the compact outputs into LicenseAtlas.
// Run: node scripts/update-osadl.mjs [--kb-path <path>] [--force] [--only SPDX]
//   --kb-path        override KB path (default ../KB)
//   --force          re-download OSADL files even when timestamps match
//   --only SPDX      refresh one checklist after metadata/lists
//   --metadata-only  refresh metadata/lists/notes only, skip per-license files
//   --skip-crawl     skip KB crawl, rebuild/sync existing KB data
//   --skip-test      skip KB OSADL tests
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const SKIP_CRAWL = args.includes("--skip-crawl");
const SKIP_TEST = args.includes("--skip-test");
const flagIdx = process.argv.indexOf("--kb-path");
const KB_ROOT = flagIdx !== -1 && process.argv[flagIdx + 1]
  ? resolve(process.argv[flagIdx + 1])
  : resolve(ROOT, "..", "KB");

if (!existsSync(KB_ROOT)) {
  console.error(`✗ KB not found: ${KB_ROOT}`);
  process.exit(1);
}

function run(cmd, cwd) {
  console.log(`\n▶ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function shellQuote(s) {
  return `"${String(s).replace(/(["\\$`])/g, "\\$1")}"`;
}

function passThroughCrawlArgs() {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force" || a === "--metadata-only") {
      out.push(a);
    } else if (a === "--only") {
      const v = args[i + 1];
      if (!v || v.startsWith("--")) {
        console.error("✗ Missing value for --only");
        process.exit(1);
      }
      out.push(a, shellQuote(v));
      i++;
    } else if (a === "--kb-path") {
      i++;
    }
  }
  return out.join(" ");
}

console.log(`Orchestrating OSADL checklist update in KB: ${KB_ROOT}`);
console.log(`Crawl mode: ${SKIP_CRAWL ? "SKIPPED" : "INCREMENTAL (timestamp-gated)"}`);

if (!SKIP_CRAWL) {
  run(`node crawlers/osadl_checklists_crawl.js ${passThroughCrawlArgs()}`, KB_ROOT);
} else {
  console.log("\n↷ Skipping OSADL crawl (--skip-crawl)");
}

run(`node scripts/build-osadl-checklists.mjs --atlas-index ${shellQuote(resolve(ROOT, "src", "data", "licenses-index.json"))}`, KB_ROOT);

if (!SKIP_TEST) {
  run("npm run test:osadl", KB_ROOT);
} else {
  console.log("\n↷ Skipping KB OSADL tests (--skip-test)");
}

console.log("\n▶ Syncing OSADL data to license-atlas...");
run(`node scripts/sync-osadl.mjs --kb-path ${shellQuote(KB_ROOT)}`, ROOT);

console.log("\n✅ OSADL checklist full-chain update complete.");
