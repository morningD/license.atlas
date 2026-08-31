// Full-chain orchestrator: refresh OSI sources in KB, rebuild tracker, then sync to Atlas.
// Run: node scripts/update-tracker.mjs [--full] [--kb-path <path>] [--month YYYY-MM]
//   --full        apply all available LLM batch outputs (kept for compatibility)
//   --kb-path     override KB path (default ../KB)
//   --month       refresh one or more OSI archive months (repeatable)
//   --since       refresh months from YYYY-MM through current month
//   --recent N    refresh the last N months (default 2)
//   --skip-mail   skip mail archive/index/pending discovery steps
//   --skip-status-agent  skip Agent status adjudication steps
//   --status-agent-mode <verify|verify-or-submit|local>  status adjudication runner mode (default verify-or-submit)
//   --strict-manual-pending  fail on any blocking manual-review item (default: allow the
//                 known evidence-conflict gray-zone items tracked in the baseline)
//   --rebaseline  adopt the current manual-review item set as the new known-baseline
//                 (use after human review of new gray-zone conflicts), then continue
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const args = process.argv.slice(2);
const FULL = args.includes("--full");
const SKIP_MAIL = args.includes("--skip-mail");
const SKIP_STATUS_AGENT = args.includes("--skip-status-agent");
// Known gray-zone evidence conflicts (curated-vs-mail vs OSI API discrepancies) stay
// under manual-review tracking by design; blocking on them every run just wedges the
// orchestrator. Opt back into the old strict behavior with --strict-manual-pending.
const ALLOW_MANUAL_PENDING = !args.includes("--strict-manual-pending");
const statusModeIdx = args.indexOf("--status-agent-mode");
const STATUS_AGENT_MODE = statusModeIdx !== -1 && args[statusModeIdx + 1] && !args[statusModeIdx + 1].startsWith("--")
  ? args[statusModeIdx + 1]
  : "verify-or-submit";
const flagIdx = process.argv.indexOf("--kb-path");
const KB_ROOT = flagIdx !== -1 && process.argv[flagIdx + 1]
  ? resolve(process.argv[flagIdx + 1])
  : resolve(ROOT, "..", "KB");

if (!existsSync(KB_ROOT)) {
  console.error(`✗ KB not found: ${KB_ROOT}`);
  process.exit(1);
}

function run(cmd, cwd, env) {
  console.log(`\n▶ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit", ...(env ? { env } : {}) });
}

function shellQuote(s) {
  return `"${String(s).replace(/(["\\$`])/g, "\\$1")}"`;
}

// LLM env for status adjudication retries: prefer variables already in the
// environment; otherwise read the zhipuai-coding-plan key from the global
// opencode config (same provider the interactive flow uses).
function llmEnv() {
  const out = { ...process.env };
  if (!out.ANTHROPIC_API_KEY && !out.ANTHROPIC_AUTH_TOKEN) {
    let key = null;
    try {
      const cfg = JSON.parse(readFileSync(join(out.HOME || "", ".config/opencode/opencode.json"), "utf8"));
      const provider = cfg.provider?.["zhipuai-coding-plan"];
      key = provider?.apiKey || provider?.options?.apiKey;
    } catch {}
    if (!key) return null;
    out.ANTHROPIC_API_KEY = key;
    out.ANTHROPIC_AUTH_TOKEN = key;
  }
  if (!out.ANTHROPIC_BASE_URL) out.ANTHROPIC_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
  if (!out.STATUS_ADJUDICATION_MODEL) out.STATUS_ADJUDICATION_MODEL = "glm-4.6";
  if (!out.POINTS_MODEL) out.POINTS_MODEL = "glm-4.6";
  return out;
}

const MANUAL_REVIEW_PATH = join(KB_ROOT, "data", "osi", "status-adjudication", "manual-review.json");
// Baseline of known gray-zone manual-review submission ids (evidence conflicts that
// were human-reviewed and intentionally kept as-is). Runs pass these silently but
// HARD FAIL on manual-review ids outside the baseline: a brand-new evidence conflict
// means the adjudication touched something no human has reviewed yet.
const BASELINE_PATH = join(ROOT, "scripts", "tracker-manual-baseline.json");
const REBASELINE = args.includes("--rebaseline");

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set();
  return new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")).ids || []);
}

function writeBaseline(ids) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ schema_version: 1, updated_at: new Date().toISOString(), ids: [...ids].sort() }, null, 2) + "\n");
}

function manualReviewIds() {
  if (!existsSync(MANUAL_REVIEW_PATH)) return [];
  const mr = JSON.parse(readFileSync(MANUAL_REVIEW_PATH, "utf8"));
  return [...new Set((mr.items || []).map(it => it.submission_id))];
}

// Fail on manual-review items that are not in the known baseline. Resolved items
// leaving the baseline are fine; on success the baseline is pruned to the current
// set so reappearing ids (evidence changed again) re-trigger review.
function checkManualBaseline() {
  const current = manualReviewIds();
  if (REBASELINE) {
    writeBaseline(current);
    console.log(`\n📌 Rebaselined manual-review set: ${current.length} id(s) adopted`);
    return;
  }
  const baseline = readBaseline();
  const fresh = current.filter(id => !baseline.has(id));
  if (fresh.length) {
    throw new Error(
      `New manual-review item(s) outside the known baseline (needs human review): ${fresh.join(", ")}\n` +
      `Review them, then rerun with --rebaseline to adopt. Details: ${MANUAL_REVIEW_PATH}`
    );
  }
  if (current.length !== baseline.size) {
    const kept = new Set(current);
    const pruned = [...baseline].filter(id => !kept.has(id));
    console.log(`\nℹ️ ${pruned.length} baseline id(s) resolved and pruned: ${pruned.join(", ")}`);
    writeBaseline(current);
  }
}

// Submissions whose adjudication output is missing or invalid (stale input_hash,
// unknown evidence refs, schema violations) and can be fixed by re-running the LLM.
function staleAdjudicationIds() {
  if (!existsSync(MANUAL_REVIEW_PATH)) return [];
  const mr = JSON.parse(readFileSync(MANUAL_REVIEW_PATH, "utf8"));
  return (mr.items || [])
    .filter(it => /^(Invalid adjudication output|Missing agent status adjudication output)/.test(it.reason || ""))
    .map(it => it.submission_id);
}

// Apply adjudications, auto-retrying stale (missing/invalid) outputs via the LLM.
// The model occasionally emits schema-inconsistent output (e.g. conflicts without
// requires_manual_review), so give each id a few passes before giving up.
function applyWithRetry() {
  const applyCmd = `node scripts/apply-status-adjudications.mjs${ALLOW_MANUAL_PENDING ? " --allow-manual-pending" : ""}`;
  run(applyCmd, KB_ROOT);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const stale = staleAdjudicationIds();
    if (!stale.length) return;
    console.log(`\n♻️  ${stale.length} stale adjudication output(s) [${stale.join(", ")}]; re-running LLM (attempt ${attempt}/3)`);
    const env = llmEnv();
    if (!env) throw new Error("Cannot retry stale adjudications: no ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN in env and no zhipuai-coding-plan key in ~/.config/opencode/opencode.json");
    execSync(`node scripts/run-status-adjudication.mjs --mode local --ids ${shellQuote(stale.join(","))}`, {
      cwd: KB_ROOT,
      stdio: "inherit",
      env,
    });
    run(applyCmd, KB_ROOT);
  }
  const remaining = staleAdjudicationIds();
  if (remaining.length) {
    throw new Error(`${remaining.length} adjudication(s) still invalid after 3 LLM retries: ${remaining.join(", ")}`);
  }
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

// 3.5 Point extraction for new timeline events. extract-full-bodies rebuilds
// the per-submission packages from the fresh v2 (new mail lands there first),
// then extract-all-points summarizes only events missing from the manifest.
// Without this step new posts reach the coverage gate with no point and fail it.
// Both call the LLM, so they need the key env (falls back to the opencode
// config the same way adjudication retries do).
{
  const env = llmEnv();
  if (!env) throw new Error("Point extraction needs ANTHROPIC_API_KEY (or a zhipuai-coding-plan key in ~/.config/opencode/opencode.json)");
  run("node scripts/extract-full-bodies.mjs", KB_ROOT, env);
  run("node scripts/extract-all-points.mjs", KB_ROOT, env);
}

// 4. Enrich
run("node scripts/enrich-license-tracker.mjs", KB_ROOT);

// 4.5. Agent status adjudication. Rules only prepare evidence; final status is
// supplied by the adjudicator output and applied before sync. Stale outputs
// (input_hash drift after rebuild) are automatically re-adjudicated by the LLM.
if (!SKIP_STATUS_AGENT) {
  run("node scripts/prepare-status-adjudication.mjs", KB_ROOT);
  run(`node scripts/run-status-adjudication.mjs --mode ${shellQuote(STATUS_AGENT_MODE)}`, KB_ROOT);
  applyWithRetry();
  run(`node scripts/verify-status-adjudications.mjs --require-all${ALLOW_MANUAL_PENDING ? " --allow-manual-pending" : ""}`, KB_ROOT);
  checkManualBaseline();
} else {
  console.log("\n↷ Skipping Agent status adjudication (--skip-status-agent)");
}

// 5. Quality gates: validate tracker semantics, point style, and manifest coverage.
run("node scripts/test-tracker-data.mjs", KB_ROOT);
run("node scripts/check-point-style.mjs --since 2026-01-01", KB_ROOT);
run("node scripts/check-point-manifest-coverage.mjs", KB_ROOT);
run(`node scripts/check-tracker-license-texts.mjs --tracker "${resolve(KB_ROOT, "data", "osi", "license-review-tracker-v2.json")}"`, ROOT);

// 6. Sync to atlas
console.log("\n▶ Syncing to license-atlas...");
run(`node scripts/sync-tracker.mjs --kb-path "${KB_ROOT}"`, ROOT);

console.log("\n✅ Tracker full-chain update complete.");
