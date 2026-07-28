// Full-chain orchestrator: refresh OSI sources in KB, rebuild tracker, then sync to Atlas.
// Run: node scripts/update-tracker.mjs [--full] [--kb-path <path>] [--month YYYY-MM]
//   --full        apply all available LLM batch outputs (kept for compatibility)
//   --kb-path     override KB path (default ../KB)
//   --month       refresh one or more OSI archive months (repeatable)
//   --since       refresh months from YYYY-MM through current month
//   --recent N    refresh the last N months (default 2)
//   --skip-mail   skip mail archive/index/pending discovery steps
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const FULL = args.includes("--full");
const SKIP_MAIL = args.includes("--skip-mail");
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

function passThroughMailArgs() {
  const out = [];
  const flagsWithValues = new Set(["--month", "--since", "--recent", "--lists", "--list"]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!flagsWithValues.has(a)) continue;
    const v = args[i + 1];
    if (!v || v.startsWith("--")) continue;
    out.push(a, shellQuote(v));
    i++;
  }
  if (!out.length) out.push("--recent", "2");
  return out.join(" ");
}

function pendingSinceArg() {
  const sinceIdx = args.indexOf("--since");
  if (sinceIdx >= 0 && args[sinceIdx + 1] && !args[sinceIdx + 1].startsWith("--")) {
    return `--since ${shellQuote(args[sinceIdx + 1])}`;
  }
  const months = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--month" && args[i + 1] && !args[i + 1].startsWith("--")) {
      months.push(args[i + 1]);
      i++;
    }
  }
  if (months.length) return `--since ${shellQuote(months.sort()[0])}`;
  return "";
}

console.log(`Orchestrating tracker rebuild in KB: ${KB_ROOT}`);
console.log(`LLM mode: ${FULL ? "FULL (re-extract all)" : "INCREMENTAL (new URLs only)"}`);

// 1. Refresh public OSI mailing-list archives and indexes. This covers both
// license-review and license-discuss; the latter joins tracker timelines via
// thread-clusters when linked to an existing/new submission.
if (!SKIP_MAIL) {
  run(`node scripts/update-mail-archives.mjs ${passThroughMailArgs()}`, KB_ROOT);
  run("PLAYWRIGHT_CHANNEL=msedge node crawlers/osi_crawl.js --source minutes", KB_ROOT);
  run("node scripts/rebuild-mail-indexes.mjs", KB_ROOT);
  run(`node scripts/update-pending-submissions.mjs ${pendingSinceArg()}`, KB_ROOT);
} else {
  console.log("\n↷ Skipping mail archive/index refresh (--skip-mail)");
}

// 2. LLM extraction merge (opinion/sentiment). apply-llm-batches is incremental:
// it only consumes batch outputs that already exist under /tmp/llm-batches.
run("node scripts/apply-llm-batches.mjs" + (FULL ? "" : ""), KB_ROOT);

// 3. Build base tracker
run("node scripts/build-license-review-tracker.mjs", KB_ROOT);

// 4. Enrich
run("node scripts/enrich-license-tracker.mjs", KB_ROOT);

// 5. Quality gates: validate tracker semantics, point style, and manifest coverage.
run("node scripts/test-tracker-data.mjs", KB_ROOT);
run("node scripts/check-point-style.mjs --since 2026-01-01", KB_ROOT);
run("node scripts/check-point-manifest-coverage.mjs", KB_ROOT);
run(`node scripts/check-tracker-license-texts.mjs --tracker "${resolve(KB_ROOT, "data", "osi", "license-review-tracker-v2.json")}"`, ROOT);

// 6. Sync to atlas
console.log("\n▶ Syncing to license-atlas...");
run(`node scripts/sync-tracker.mjs --kb-path "${KB_ROOT}"`, ROOT);

console.log("\n✅ Tracker full-chain update complete.");
